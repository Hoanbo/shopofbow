-- ============================================================
-- BOW — Migration 0006: sửa luồng đơn hàng / admin
--   1. Thêm cột email vào profiles (+ backfill + trigger)
--   2. Hàm is_admin() cho RLS
--   3. RLS cho admin đọc/sửa toàn bộ orders + đọc toàn bộ profiles
--   4. FK orders.user_id -> profiles(id) để PostgREST embed được
-- Chạy trong Supabase Dashboard > SQL Editor. An toàn để chạy lại.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cột email cho profiles
-- ------------------------------------------------------------
alter table profiles add column if not exists email text;

-- Backfill email từ auth.users cho các profile hiện có
update profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- Cập nhật trigger tạo profile để ghi luôn email khi có user mới
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end$$;

-- ------------------------------------------------------------
-- 2. Hàm nhận diện admin (khớp danh sách ở src/context/AuthContext.tsx)
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('hoankb4@gmail.com', 'admin@shopofbow.com'),
    false
  );
$$;

-- ------------------------------------------------------------
-- 3. RLS: admin toàn quyền trên orders, đọc toàn bộ profiles
-- ------------------------------------------------------------
drop policy if exists "admin read all orders" on orders;
create policy "admin read all orders" on orders
  for select to authenticated
  using (is_admin());

drop policy if exists "admin write all orders" on orders;
create policy "admin write all orders" on orders
  for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin read all profiles" on profiles;
create policy "admin read all profiles" on profiles
  for select to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- 4. FK orders.user_id -> profiles(id) để PostgREST embed profiles
--    (an toàn: trigger + backfill 0004 đảm bảo mọi user đều có profile)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_user_profile_fk'
  ) then
    alter table orders
      add constraint orders_user_profile_fk
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end$$;
