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

-- ============================================================
-- 4. Bật Realtime cho bảng orders (để client theo dõi live)
-- ============================================================
-- Lưu ý: Bạn cũng cần vào Supabase Dashboard > Database > Replication
-- và bật Realtime cho bảng orders
alter publication supabase_realtime add table orders;

-- ============================================================
-- 5. Hàm RPC buy_with_wallet — thanh toán bằng số dư ví
-- (nếu chưa có trong database — cần service_role key để gọi từ Backend)
-- ============================================================
create or replace function buy_with_wallet(
  p_user_id     uuid,
  p_product_name text,
  p_plan_label  text,
  p_price       numeric,
  p_payment_code text,
  p_notes       text default null
)
returns text language plpgsql security definer as $$
declare
  v_balance numeric;
begin
  -- Đọc số dư ví
  select balance into v_balance
  from public.profiles
  where id = p_user_id
  for update; -- khóa dòng để tránh race condition

  if v_balance is null then
    return 'no_profile';
  end if;

  if v_balance < p_price then
    return 'insufficient_balance';
  end if;

  -- Trừ tiền ví
  update public.profiles
  set balance = balance - p_price,
      updated_at = now()
  where id = p_user_id;

  -- Tạo đơn hàng với trạng thái pending_delivery (đã thanh toán, chờ bàn giao)
  insert into public.orders (user_id, product_name, plan_label, price, status, payment_code, notes)
  values (p_user_id, p_product_name, p_plan_label, p_price, 'pending_delivery', p_payment_code, p_notes);

  return 'success';
end$$;

-- ============================================================
-- 6. Hàm RPC refund_order — hoàn tiền về ví
-- ============================================================
create or replace function refund_order(p_order_id uuid)
returns text language plpgsql security definer as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id;

  if not found then
    return 'order_not_found';
  end if;

  if v_order.status not in ('pending_delivery', 'processing', 'completed') then
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
