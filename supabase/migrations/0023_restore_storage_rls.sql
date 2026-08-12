-- ============================================================
-- BOW — Migration 0023: KHÔI PHỤC QUYỀN RLS CHO STORAGE ASSETS
--
-- Root cause:
-- Migration 0014 dùng `drop function public.is_admin() cascade`.
-- PostgreSQL đã xóa mọi RLS policy phụ thuộc vào is_admin(), bao gồm các policy
-- trên storage.objects làm thao tác upload bị lỗi "row-level security policy".
-- ============================================================

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Cho phép xem public các tệp trong bucket assets
drop policy if exists "assets public read" on storage.objects;
create policy "assets public read"
  on storage.objects for select
  using (bucket_id = 'assets');

-- Cho phép upload vào bucket assets với tài khoản Admin
drop policy if exists "assets admin insert" on storage.objects;
create policy "assets admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'assets' and public.is_admin());

-- Cho phép cập nhật tệp trong bucket assets với tài khoản Admin
drop policy if exists "assets admin update" on storage.objects;
create policy "assets admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'assets' and public.is_admin())
  with check (bucket_id = 'assets' and public.is_admin());

-- Cho phép xóa tệp trong bucket assets với tài khoản Admin
drop policy if exists "assets admin delete" on storage.objects;
create policy "assets admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'assets' and public.is_admin());
