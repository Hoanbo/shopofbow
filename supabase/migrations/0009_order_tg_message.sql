-- ============================================================
-- BOW — Migration 0009: lưu message_id Telegram trên đơn hàng
--
-- Dùng cho tính năng "nút xác nhận trong Telegram" (Hướng A):
--   - Khi gửi thông báo đơn QR, lưu message_id của tin nhắn Telegram.
--   - Khi webhook SePay tự xác nhận, dùng message_id này để SỬA lại
--     tin nhắn (gỡ nút, đổi thành "đã tự động xác nhận").
--
-- Chạy trong Supabase Dashboard > SQL Editor. An toàn để chạy lại.
-- ============================================================

alter table orders add column if not exists tg_message_id bigint;
