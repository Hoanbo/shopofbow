-- ============================================================
-- BOW — Migration 0022: KHÔI PHỤC QUYỀN ADMIN ĐỌC TOÀN BỘ ĐƠN
--
-- Root cause:
-- Migration 0014 dùng `drop function public.is_admin() cascade`.
-- PostgreSQL vì thế xóa mọi RLS policy phụ thuộc vào is_admin(), bao gồm
-- policy admin trên orders/profiles. 0014 tạo lại hàm nhưng không tạo lại
-- các policy này, khiến admin chỉ thấy đơn của chính mình qua policy user.
--
-- Migration này không tắt RLS, không sửa/xóa dữ liệu và có thể chạy lại.
-- ============================================================

alter table public.orders enable row level security;
alter table public.profiles enable row level security;

-- Dọn các tên policy admin từ những migration trước, rồi tạo một policy
-- quản lý toàn bộ orders cho admin. Policy user hiện có được giữ nguyên.
drop policy if exists "admin all orders" on public.orders;
drop policy if exists "admin read all orders" on public.orders;
drop policy if exists "admin write all orders" on public.orders;
drop policy if exists "admin delete all orders" on public.orders;
drop policy if exists "admin manage all orders" on public.orders;

create policy "admin manage all orders"
  on public.orders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admin cần đọc profile của khách để Orders có thể nhúng email/tên khách.
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());
