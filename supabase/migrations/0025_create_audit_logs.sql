-- ============================================================
-- Migration 0025: Create Audit Logs table, RLS, Helper & Triggers
-- Append-Only Audit Logging System for BOW Admin & System Security
-- ============================================================

set search_path = public, auth;

-- 1. Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Hệ thống',
  actor_role text not null default 'system', -- 'admin', 'user', 'system'
  action text not null, -- 'create_order', 'status_change', 'handover', 'refund', 'wallet_change', 'create_product', 'update_product', 'delete_product', 'sepay_webhook', etc.
  entity_type text not null, -- 'order', 'product', 'user', 'wallet', 'system'
  entity_id text,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Indexes for high-performance querying & filtering
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor_role on public.audit_logs(actor_role);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_entity_type on public.audit_logs(entity_type);
create index if not exists idx_audit_logs_entity_id on public.audit_logs(entity_id);

-- 3. Enable RLS (Row Level Security) — Append-Only & Immutable
alter table public.audit_logs enable row level security;

-- Only Admin can READ all audit logs
drop policy if exists "admin read all audit_logs" on public.audit_logs;
create policy "admin read all audit_logs"
  on public.audit_logs
  for select
  using (public.is_admin());

-- System & authenticated/anon users can INSERT audit logs (Append-Only)
drop policy if exists "anyone insert audit_logs" on public.audit_logs;
create policy "anyone insert audit_logs"
  on public.audit_logs
  for insert
  with check (true);

-- NO UPDATE and NO DELETE policies exist, preserving audit log immutability!

-- 4. Helper Function: log_audit_event
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_description text,
  p_actor_id uuid default null,
  p_actor_name text default null,
  p_actor_role text default 'system',
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_act_id uuid := p_actor_id;
  v_act_name text := p_actor_name;
  v_act_role text := p_actor_role;
begin
  if v_act_id is null and auth.uid() is not null then
    v_act_id := auth.uid();
  end if;

  if v_act_name is null and v_act_id is not null then
    select coalesce(full_name, email, 'Thành viên') into v_act_name
    from public.profiles where id = v_act_id;
  end if;

  if v_act_name is null then
    v_act_name := 'Hệ thống';
  end if;

  if v_act_role = 'system' and v_act_id is not null then
    if is_admin() then
      v_act_role := 'admin';
    else
      v_act_role := 'user';
    end if;
  end if;

  insert into public.audit_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id, description, metadata
  )
  values (
    v_act_id, v_act_name, v_act_role, p_action, p_entity_type, p_entity_id, p_description, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- 5. Automated DB Trigger: Track Order status transitions & new order creation
create or replace function public.tg_audit_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_name text := 'Khách hàng';
  v_actor_role text := 'user';
begin
  if auth.uid() is not null then
    select coalesce(full_name, email, 'Thành viên') into v_actor_name
    from public.profiles where id = auth.uid();
    if is_admin() then
      v_actor_role := 'admin';
    end if;
  else
    v_actor_name := 'Hệ thống Webhook';
    v_actor_role := 'system';
  end if;

  if tg_op = 'INSERT' then
    perform public.log_audit_event(
      'create_order',
      'order',
      'Đã khởi tạo đơn hàng mới #' || coalesce(new.payment_code, new.id::text) || ' (' || coalesce(new.product_name, 'Sản phẩm') || ')',
      auth.uid(),
      v_actor_name,
      v_actor_role,
      coalesce(new.payment_code, new.id::text),
      jsonb_build_object('order_id', new.id, 'price', new.price, 'status', new.status, 'product_name', new.product_name)
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform public.log_audit_event(
      'order_status_' || new.status,
      'order',
      'Cập nhật trạng thái đơn #' || coalesce(new.payment_code, new.id::text) || ' từ "' || old.status || '" ➔ "' || new.status || '"',
      auth.uid(),
      v_actor_name,
      v_actor_role,
      coalesce(new.payment_code, new.id::text),
      jsonb_build_object('order_id', new.id, 'old_status', old.status, 'new_status', new.status, 'price', new.price)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_order_changes on public.orders;
create trigger trg_audit_order_changes
  after insert or update on public.orders
  for each row execute function public.tg_audit_order_changes();

-- 6. Automated DB Trigger: Track Profile Balance changes (Wallet Top-up / Wallet Payment)
create or replace function public.tg_audit_profile_balance_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_diff numeric;
  v_actor_name text := 'Hệ thống';
  v_actor_role text := 'system';
begin
  if old.balance is distinct from new.balance then
    v_diff := new.balance - old.balance;

    if auth.uid() is not null then
      select coalesce(full_name, email, 'Thành viên') into v_actor_name
      from public.profiles where id = auth.uid();
      if is_admin() then
        v_actor_role := 'admin';
      else
        v_actor_role := 'user';
      end if;
    end if;

    perform public.log_audit_event(
      'wallet_balance_change',
      'wallet',
      'Số dư ví của ' || coalesce(new.full_name, new.email, 'Thành viên') || ' ' || (case when v_diff >= 0 then 'tăng +' else 'giảm ' end) || to_char(v_diff, 'FM999,999,999') || 'đ (Số dư mới: ' || to_char(new.balance, 'FM999,999,999') || 'đ)',
      auth.uid(),
      v_actor_name,
      v_actor_role,
      new.id::text,
      jsonb_build_object('user_id', new.id, 'old_balance', old.balance, 'new_balance', new.balance, 'change', v_diff)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_profile_balance_changes on public.profiles;
create trigger trg_audit_profile_balance_changes
  after update on public.profiles
  for each row execute function public.tg_audit_profile_balance_changes();
