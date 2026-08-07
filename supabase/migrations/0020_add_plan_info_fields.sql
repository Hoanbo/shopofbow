-- ============================================================
-- BOW — Migration 0020: BỔ SUNG CÁC TRƯỜNG THÔNG TIN GÓI (PLAN INFORMATION)
-- ============================================================

alter table public.product_plans
  add column if not exists badge text,
  add column if not exists usage_type text,
  add column if not exists member_count int,
  add column if not exists profile_type text,
  add column if not exists short_description text,
  add column if not exists features text[],
  add column if not exists notes text;

comment on column public.product_plans.badge is 'Nhãn nổi bật (VD: PHỔ BIẾN, 5 THÀNH VIÊN, PROFILE RIÊNG)';
comment on column public.product_plans.usage_type is 'Loại sử dụng (VD: Profile riêng, Dùng chung, Cá nhân, Family)';
comment on column public.product_plans.member_count is 'Số lượng thành viên/người dùng (VD: 1, 5)';
comment on column public.product_plans.profile_type is 'Loại profile/tài khoản (VD: Slot riêng, Chính chủ, Cấp sẵn)';
comment on column public.product_plans.short_description is 'Mô tả ngắn gọn về gói';
comment on column public.product_plans.features is 'Danh sách tính năng nổi bật của gói';
comment on column public.product_plans.notes is 'Lưu ý quan trọng khi sử dụng gói';
