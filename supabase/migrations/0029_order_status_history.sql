-- ============================================================
-- Migration 0029: Create order_status_history table & automatic triggers
-- Timeline trạng thái đơn hàng theo thời gian thực cho BOW
-- ============================================================

set search_path = public, auth;

-- 1. Create order_status_history table
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null, -- 'pending_payment', 'pending_delivery', 'processing', 'completed', 'cancelled', 'refunded'
  changed_by text not null default 'system', -- 'system', 'user', 'admin'
  actor_name text,
  note text,
  created_at timestamptz not null default now()
);

-- 2. Indexes for fast timeline queries
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);
create index if not exists idx_order_status_history_created_at on public.order_status_history(created_at asc);

-- 3. Enable Row Level Security (RLS)
alter table public.order_status_history enable row level security;

-- Policy: User chỉ đọc được lịch sử đơn hàng của CHÍNH MÌNH. Admin đọc được tất cả.
drop policy if exists "user read own order_status_history" on public.order_status_history;
create policy "user read own order_status_history"
  on public.order_status_history
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
      and (o.user_id = auth.uid() or public.is_admin())
    )
  );

-- Policy: Đăng ký insert lịch sử
drop policy if exists "anyone insert order_status_history" on public.order_status_history;
create policy "anyone insert order_status_history"
  on public.order_status_history
  for insert
  with check (true);

-- 4. Automatic Database Trigger: Tự động ghi lại lịch sử mỗi khi trạng thái order thay đổi
create or replace function public.trg_record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_name text := 'Hệ thống';
  v_actor_role text := 'system';
begin
  -- Trigger khi INSERT đơn mới hoặc UPDATE status
  if (TG_OP = 'INSERT') or (OLD.status is distinct from NEW.status) then

    if auth.uid() is not null then
      select coalesce(full_name, email, 'Thành viên') into v_actor_name
      from public.profiles where id = auth.uid();

      if public.is_admin() then
        v_actor_role := 'admin';
      else
        v_actor_role := 'user';
      end if;
    end if;

    insert into public.order_status_history (
      order_id, status, changed_by, actor_name, created_at
    )
    values (
      NEW.id, NEW.status, v_actor_role, v_actor_name, coalesce(NEW.updated_at, now())
    );

  end if;
  return NEW;
end;
$$;

drop trigger if exists on_order_status_change_history on public.orders;
create trigger on_order_status_change_history
  after insert or update of status on public.orders
  for each row execute function public.trg_record_order_status_history();

-- 5. Backfill lịch sử ban đầu cho tất cả đơn hàng đã tồn tại
insert into public.order_status_history (order_id, status, changed_by, actor_name, created_at)
select id, 'pending_payment', 'system', 'Hệ thống', created_at
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
)
on conflict do nothing;
