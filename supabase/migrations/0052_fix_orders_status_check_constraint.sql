-- ============================================================================
-- BOW — Migration 0052: FIX ORDERS STATUS CHECK CONSTRAINT
-- ============================================================================
--
-- VẤN ĐỀ:
-- Bảng `public.orders` có check constraint `orders_status_check` cũ chỉ chấp nhận
-- một tập hợp trạng thái hạn chế, khiến các RPC mua hàng:
-- - `buy_with_wallet` (chèn status = 'paid')
-- - `create_order_with_coupon` (chèn status = 'pending')
-- bị văng lỗi: "new row for relation 'orders' violates check constraint 'orders_status_check'"
--
-- GIẢI PHÁP:
-- Cập nhật `orders_status_check` cho phép đầy đủ tất cả các trạng thái hợp lệ trong vòng đời đơn hàng.
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Xóa ràng buộc cũ nếu có
alter table public.orders 
  drop constraint if exists orders_status_check;

-- 2. Tạo lại ràng buộc mới bao gồm tất cả các trạng thái hợp lệ của shop
alter table public.orders 
  add constraint orders_status_check check (
    status in (
      'pending',
      'pending_payment',
      'paid',
      'pending_delivery',
      'processing',
      'delivering',
      'completed',
      'cancelled',
      'refunded'
    )
  );
