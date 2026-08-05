-- ============================================================
-- BOW — Migration 0008: sửa lỗi set_updated_at() trên bảng không có updated_at
--
-- Lỗi gặp phải:
--   ERROR 42703: record "new" has no field "updated_at"
--   CONTEXT: PL/pgSQL function set_updated_at()
--
-- Nguyên nhân (drift schema): có trigger set_updated_at gắn trên một bảng
-- KHÔNG có cột updated_at (điển hình là `notifications` — bảng 0005 không có
-- cột này). Khi trigger notify_admin_new_order (0007) insert vào notifications,
-- trigger set_updated_at chạy và cố gán new.updated_at → crash, kéo theo hỏng
-- luôn việc tạo đơn hàng.
--
-- Giải pháp: làm set_updated_at() phòng thủ — chỉ gán updated_at khi cột tồn
-- tại (kiểm tra qua to_jsonb). An toàn cho mọi bảng, không phá vỡ các bảng có
-- updated_at thật. Đồng thời gỡ trigger set_updated_at thừa trên notifications.
--
-- Chạy trong Supabase Dashboard > SQL Editor. An toàn để chạy lại.
-- ============================================================

-- ------------------------------------------------------------
-- 1. set_updated_at() phòng thủ: chỉ đụng updated_at nếu cột tồn tại
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  -- Nếu row-type của bảng có cột updated_at thì cập nhật, ngược lại bỏ qua.
  if to_jsonb(new) ? 'updated_at' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_at', now()));
  end if;
  return new;
end$$;

-- ------------------------------------------------------------
-- 2. Gỡ trigger set_updated_at thừa trên notifications (nếu có drift)
--    notifications không có cột updated_at nên không cần trigger này.
-- ------------------------------------------------------------
drop trigger if exists notifications_set_updated_at on notifications;
drop trigger if exists set_updated_at on notifications;
drop trigger if exists set_notifications_updated_at on notifications;
