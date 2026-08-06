-- ============================================================
-- BOW — Migration 0016: FIX TOÀN BỘ THÔNG BÁO CHUÔNG (ADMIN & USER) & BACKFILL DỮ LIỆU ĐƠN CŨ
-- ============================================================

-- ── 1. ĐẢM BẢO BẢNG NOTIFICATIONS CÓ RLS CHUẨN VÀ AN TOÀN ──
alter table public.notifications enable row level security;

drop policy if exists "admin read notifications" on public.notifications;
create policy "admin read notifications" on public.notifications
  for select to authenticated
  using (
    is_admin() or (user_id = auth.uid() and is_admin = false)
  );

drop policy if exists "user read own notifications" on public.notifications;
create policy "user read own notifications" on public.notifications
  for select to authenticated
  using (
    (user_id = auth.uid() and is_admin = false) or is_admin()
  );

drop policy if exists "admin update notifications" on public.notifications;
create policy "admin update notifications" on public.notifications
  for update to authenticated
  using (is_admin() or user_id = auth.uid());

drop policy if exists "user update notifications" on public.notifications;
create policy "user update notifications" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists "insert notifications" on public.notifications;
create policy "insert notifications" on public.notifications
  for insert to authenticated, service_role
  with check (true);

-- ── 2. GẮN TRIGGER DỮ LIỆU TRÊN BẢNG ORDERS ──
drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.tg_notify_order();

drop trigger if exists orders_notify_update on public.orders;
create trigger orders_notify_update
  after update on public.orders
  for each row execute function public.tg_notify_order();

-- ── 3. KHÔI PHỤC TOÀN BỘ DỮ LIỆU THÔNG BÁO CHO CÁC ĐƠN HÀNG CŨ (BACKFILL) ──

-- Xóa bớt thông báo trùng lặp (nếu có) trước khi nạp
delete from public.notifications where order_id is not null;

-- Tạo thông báo chuông cho Khách hàng (User)
insert into public.notifications (type, title, message, order_id, user_id, is_admin, is_read, created_at)
select
  case
    when status = 'completed' then 'order_completed'
    when status = 'cancelled' then 'order_cancelled'
    when status = 'refunded' then 'order_refunded'
    when status = 'pending_delivery' then 'order_paid'
    else 'new_order'
  end as type,
  case
    when status = 'completed' then '🎉 Đơn hàng đã bàn giao hoàn tất'
    when status = 'cancelled' then 'Đơn hàng đã bị hủy'
    when status = 'refunded' then '💸 Đã hoàn tiền vào số dư ví'
    when status = 'pending_delivery' then 'Xác nhận thanh toán thành công'
    else 'Tạo đơn hàng thành công'
  end as title,
  'Đơn hàng #' || payment_code || ' — ' || product_name || ' (' || trim(to_char(price, 'FM999G999G999')) || 'đ)' as message,
  id as order_id,
  user_id,
  false as is_admin,
  false as is_read,
  created_at
from public.orders
where user_id is not null;

-- Tạo thông báo chuông cho Admin
insert into public.notifications (type, title, message, order_id, user_id, is_admin, is_read, created_at)
select
  case
    when status = 'completed' then 'order_completed'
    when status = 'cancelled' then 'order_cancelled'
    when status = 'refunded' then 'order_refunded'
    when status = 'pending_delivery' then 'order_paid'
    else 'new_order'
  end as type,
  case
    when status = 'completed' then 'Đã hoàn tất bàn giao đơn hàng'
    when status = 'cancelled' then 'Đơn hàng bị hủy'
    when status = 'refunded' then 'Đã hoàn tiền đơn hàng về ví'
    when status = 'pending_delivery' then 'Đã nhận thanh toán đơn hàng'
    else 'Đơn hàng mới'
  end as title,
  'Đơn #' || payment_code || ' — ' || product_name || ' · ' || trim(to_char(price, 'FM999G999G999')) || 'đ' as message,
  id as order_id,
  null as user_id,
  true as is_admin,
  false as is_read,
  created_at
from public.orders;
