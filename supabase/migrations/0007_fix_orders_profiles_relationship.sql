-- ============================================================
-- BOW — Migration 0007: sửa PGRST201 (ambiguous relationship)
--
-- Vấn đề:
--   Sau 0006, cột orders.user_id có 2 khóa ngoại:
--     • orders_user_id_fkey     -> auth.users(id)   (từ 0004)
--     • orders_user_profile_fk  -> profiles(id)     (từ 0006)
--   Vì profiles.id cũng tham chiếu auth.users(id), PostgREST phát hiện
--   NHIỀU đường quan hệ giữa orders và profiles => lỗi PGRST201 khi embed
--   .select('*, profiles(...)').
--
-- Giải pháp (đúng chuẩn, không disable RLS, không workaround):
--   Giữ DUY NHẤT một FK: orders.user_id -> profiles(id).
--   Toàn vẹn tham chiếu tới auth.users vẫn được đảm bảo bắc cầu:
--     orders.user_id -> profiles.id -> auth.users.id (đều ON DELETE CASCADE).
--
-- Chạy trong Supabase Dashboard > SQL Editor. An toàn để chạy lại.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Đảm bảo mọi order đều có profile tương ứng (tránh vi phạm FK)
--    Backfill profile cho user cũ nếu còn thiếu.
-- ------------------------------------------------------------
insert into public.profiles (id, full_name, email)
select u.id, u.raw_user_meta_data->>'full_name', u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Đảm bảo FK orders.user_id -> profiles(id) tồn tại (idempotent)
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

-- ------------------------------------------------------------
-- 3. Bỏ FK thừa orders.user_id -> auth.users(id)
--    Tìm và drop bất kỳ FK nào trên cột user_id trỏ tới auth.users,
--    để không phụ thuộc vào tên constraint tự sinh.
-- ------------------------------------------------------------
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_class rel        on rel.oid = con.conrelid
    join pg_namespace nsp    on nsp.oid = rel.relnamespace
    join pg_class fref       on fref.oid = con.confrelid
    join pg_namespace fnsp   on fnsp.oid = fref.relnamespace
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'orders'
      and fnsp.nspname = 'auth'
      and fref.relname = 'users'
  loop
    execute format('alter table public.orders drop constraint %I;', fk.conname);
  end loop;
end$$;

-- ------------------------------------------------------------
-- 4. Yêu cầu PostgREST nạp lại schema cache (nếu chạy qua API)
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Kết quả:
--   • orders <-> profiles chỉ còn MỘT quan hệ  => hết PGRST201.
--   • RLS giữ nguyên: admin đọc tất cả (is_admin()), user đọc đơn của mình.
-- ------------------------------------------------------------
