-- ============================================================
-- BOW — Migration 0004: profiles, orders, và trigger tự động
-- Chạy script này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Bảng profiles — liên kết 1-1 với auth.users
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  balance     numeric(12,0) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Đảm bảo cột updated_at tồn tại trên bảng profiles (tránh schema drift)
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- RLS cho profiles
alter table profiles enable row level security;

-- User chỉ xem được profile của chính mình
drop policy if exists "user read own profile" on profiles;
create policy "user read own profile" on profiles
  for select using (auth.uid() = id);

-- User chỉ cập nhật profile của chính mình
drop policy if exists "user update own profile" on profiles;
create policy "user update own profile" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Authenticated users có thể insert profile của chính mình
drop policy if exists "user insert own profile" on profiles;
create policy "user insert own profile" on profiles
  for insert to authenticated with check (auth.uid() = id);

-- Admin (service role) có quyền đọc tất cả profiles
drop policy if exists "service role read all profiles" on profiles;
create policy "service role read all profiles" on profiles
  for select to service_role using (true);

-- ============================================================
-- 2. Trigger tự động tạo profile khi có user mới đăng ký
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Tạo profile cho các user đã tồn tại trong auth nhưng chưa có profile
insert into public.profiles (id, full_name)
select id, raw_user_meta_data->>'full_name'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ============================================================
-- 3. Bảng orders — lưu đơn hàng
-- ============================================================
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_name    text not null,
  plan_label      text not null,
  price           numeric(12,0) not null default 0,
  status          text not null default 'pending_payment',
  -- Trạng thái: pending_payment, pending_delivery, processing, completed, cancelled, refunded
  payment_code    text not null unique,
  notes           text,
  account_details text, -- Thông tin tài khoản bàn giao, chỉ chủ đơn hàng được đọc
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Đảm bảo cột updated_at tồn tại trên bảng orders (tránh schema drift)
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create index if not exists orders_user_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_at_idx on orders(created_at desc);

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- RLS cho orders
alter table orders enable row level security;

-- User chỉ xem được đơn hàng của mình
drop policy if exists "user read own orders" on orders;
create policy "user read own orders" on orders
  for select using (auth.uid() = user_id);

-- User có thể tạo đơn hàng cho chính mình
drop policy if exists "user insert own orders" on orders;
create policy "user insert own orders" on orders
  for insert to authenticated with check (auth.uid() = user_id);

-- User có thể cập nhật đơn hàng của mình (ví dụ: tự hủy)
drop policy if exists "user update own orders" on orders;
create policy "user update own orders" on orders
  for update to authenticated using (auth.uid() = user_id);

-- Admin có toàn quyền trên tất cả orders
drop policy if exists "admin all orders" on orders;
create policy "admin all orders" on orders
  for all to service_role using (true);

-- Bật Realtime cho bảng orders (an toàn khi chạy lại)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end$$;

-- ============================================================
-- 5. Hàm RPC buy_with_wallet — thanh toán bằng số dư ví (Bảo mật cao)
-- ============================================================
create or replace function buy_with_wallet(
  p_user_id      uuid,
  p_product_name text,
  p_plan_label   text,
  p_price        numeric,
  p_payment_code text,
  p_notes        text default null,
  p_product_id   uuid default null,
  p_plan_id      uuid default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_balance    numeric;
  v_real_price numeric := null;
begin
  -- 1. Bảo mật: Yêu cầu auth.uid() trùng với p_user_id (chống giả mạo trừ tiền người khác)
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return 'unauthorized';
  end if;

  -- 2. Bảo mật: Tra cứu giá thật từ DB (chống client sửa p_price thành 0đ hay 1đ)
  if p_plan_id is not null then
    select price into v_real_price
    from public.product_plans
    where id = p_plan_id and is_active = true;
  end if;

  if v_real_price is null and p_plan_label is not null then
    if p_product_id is not null then
      select price into v_real_price
      from public.product_plans
      where product_id = p_product_id and name = p_plan_label and is_active = true
      limit 1;
    elsif p_product_name is not null then
      select pp.price into v_real_price
      from public.product_plans pp
      join public.products p on p.id = pp.product_id
      where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true
      limit 1;
    end if;
  end if;

  if v_real_price is null then
    if p_product_id is not null then
      select base_price into v_real_price
      from public.products
      where id = p_product_id and is_active = true;
    elsif p_product_name is not null then
      select base_price into v_real_price
      from public.products
      where name = p_product_name and is_active = true;
    end if;
  end if;

  -- Ghi đè p_price bằng giá chuẩn từ DB nếu tìm thấy
  if v_real_price is not null then
    p_price := v_real_price;
  end if;

  -- 3. Đọc số dư ví & khóa dòng để tránh race condition
  select balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    return 'no_profile';
  end if;

  if v_balance < p_price then
    return 'insufficient_balance';
  end if;

  -- 4. Trừ tiền ví
  update public.profiles
  set balance = balance - p_price,
      updated_at = now()
  where id = p_user_id;

  -- 5. Tạo đơn hàng với trạng thái pending_delivery (đã thanh toán ví, chờ bàn giao)
  insert into public.orders (user_id, product_name, plan_label, price, status, payment_code, notes)
  values (p_user_id, p_product_name, p_plan_label, p_price, 'pending_delivery', p_payment_code, p_notes);

  return 'success';
end$$;

-- ============================================================
-- 6. Hàm RPC refund_order — hoàn tiền về ví (chỉ Admin)
-- ============================================================
create or replace function refund_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  -- Bảo mật: Chỉ Admin mới được thực hiện hoàn tiền
  if not is_admin() then
    return 'unauthorized';
  end if;

  select * into v_order from orders where id = p_order_id;

  if not found then
    return 'order_not_found';
  end if;

  if v_order.status not in ('pending_delivery', 'processing') then
    return 'invalid_status';
  end if;

  -- Hoàn tiền về ví
  update public.profiles
  set balance = balance + v_order.price,
      updated_at = now()
  where id = v_order.user_id;

  -- Cập nhật trạng thái đơn hàng
  update public.orders
  set status = 'refunded',
      updated_at = now()
  where id = p_order_id;

  return 'success';
end$$;

-- ============================================================
-- 7. Hàm RPC cancel_and_refund_own_order — User hủy đơn & nhận lại tiền vào ví
-- ============================================================
create or replace function cancel_and_refund_own_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  -- 1. Yêu cầu người dùng đã đăng nhập
  if auth.uid() is null then
    return 'unauthorized';
  end if;

  -- 2. Đọc đơn hàng của chính user đó & khóa dòng chống race condition
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    return 'order_not_found';
  end if;

  -- Đơn đã hủy hoặc đã hoàn thành -> không thể hủy
  if v_order.status in ('cancelled', 'completed', 'refunded') then
    return 'cannot_cancel';
  end if;

  -- Đảm bảo các cột updated_at tồn tại
  alter table public.profiles add column if not exists updated_at timestamptz not null default now();
  alter table public.orders add column if not exists updated_at timestamptz not null default now();

  -- 3. Đơn chưa thanh toán: Chỉ đổi trạng thái hủy
  if v_order.status = 'pending_payment' then
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'success';
  end if;

  -- 4. Đơn đã thanh toán (pending_delivery hoặc processing): Hủy & Hoàn tiền ví tự động
  if v_order.status in ('pending_delivery', 'processing') then
    -- Hoàn tiền về ví khách hàng
    update public.profiles
    set balance = balance + v_order.price,
        updated_at = now()
    where id = auth.uid();

    -- Cập nhật đơn thành đã hủy
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    -- Thông báo User
    insert into public.notifications (type, title, message, order_id, user_id, is_admin, is_read)
    values (
      'system',
      'Hủy đơn & Hoàn tiền ví',
      'Bạn đã hủy đơn ' || v_order.payment_code || '. Số tiền ' || to_char(v_order.price, 'FM999,999,999') || 'đ đã được hoàn về ví số dư của bạn.',
      v_order.id,
      auth.uid(),
      false,
      false
    );

    -- Thông báo Admin
    insert into public.notifications (type, title, message, order_id, is_admin, is_read)
    values (
      'new_order',
      'Khách tự hủy đơn & Hoàn tiền ví',
      'Khách hàng đã hủy đơn ' || v_order.payment_code || ' (' || v_order.product_name || '). Tiền đã hoàn tự động về ví khách hàng.',
      v_order.id,
      true,
      false
    );

    return 'refunded_success';
  end if;

  return 'cannot_cancel';
end$$;
