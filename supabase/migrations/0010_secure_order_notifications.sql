-- ============================================================
-- BOW — Migration 0010: thông báo đơn hàng an toàn (server-side)
--
-- Mục tiêu bảo mật:
--   • Client KHÔNG còn tự gửi Telegram / tự tạo notification nữa
--     (trước đây client tự bịa customer_name / product_name / price).
--   • Nguồn thông báo DUY NHẤT là DB trigger — dữ liệu lấy trực tiếp
--     từ bảng orders (đáng tin), không ai giả mạo được.
--   • Trigger gọi Netlify Function telegram-notify server→server qua
--     pg_net, kèm secret INTERNAL_API_KEY đọc từ Supabase Vault
--     (secret KHÔNG nằm trong git, KHÔNG vào bundle JS).
--
-- Sự kiện:
--   • AFTER INSERT trên orders           -> 'new_order'
--   • AFTER UPDATE status -> 'cancelled'  -> 'order_cancelled'
--   (Đơn ví buy_with_wallet cũng INSERT vào orders nên được phủ luôn.)
--
-- Chạy trong Supabase Dashboard > SQL Editor. An toàn để chạy lại.
-- ============================================================

-- pg_net để trigger gọi HTTP server→server (non-blocking).
create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------
-- Hàm trigger: tạo notification tin cậy + gọi telegram-notify
-- ------------------------------------------------------------
create or replace function public.tg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event text;
  v_url   text;
  v_key   text;
  v_title text;
  v_price text := trim(to_char(new.price, 'FM999G999G999')) || 'đ';
begin
  -- Xác định sự kiện quan tâm
  if tg_op = 'INSERT' then
    v_event := 'new_order';
  elsif tg_op = 'UPDATE' then
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event := 'order_cancelled';
    else
      return new; -- thay đổi trạng thái khác: bỏ qua
    end if;
  else
    return new;
  end if;

  -- ── 1. Notification cho chuông admin (dữ liệu tin cậy từ NEW) ──
  if v_event = 'new_order' then
    v_title := case
      when new.status = 'pending_payment' then 'Đơn hàng mới (chờ thanh toán)'
      else 'Đơn hàng mới (đã thanh toán)'
    end;
    insert into public.notifications(type, title, message, order_id, is_admin, is_read)
    values (
      'new_order', v_title,
      'Đơn ' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price,
      new.id, true, false
    );
  else
    insert into public.notifications(type, title, message, order_id, is_admin, is_read)
    values (
      'order_cancelled', 'Đơn hàng bị hủy',
      'Đơn ' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.',
      new.id, true, false
    );
  end if;

  -- ── 2. Gọi Netlify Function telegram-notify (nếu đã cấu hình Vault) ──
  -- Secret không có trong git; admin nạp qua vault.create_secret (xem cuối file).
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'telegram_notify_url';
    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_url := null; -- Vault chưa sẵn sàng: bỏ qua Telegram, KHÔNG chặn đơn
  end;

  if v_url is not null and v_key is not null then
    begin
      perform net.http_post(
        url     := v_url,
        body    := jsonb_build_object('order_id', new.id, 'event', v_event),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Apikey ' || v_key
        )
      );
    exception when others then
      -- Non-blocking: lỗi gửi Telegram không được làm hỏng giao dịch đơn hàng
      raise warning '[tg_notify_order] http_post failed: %', sqlerrm;
    end;
  end if;

  return new;
end$$;

-- ------------------------------------------------------------
-- Gắn trigger
-- ------------------------------------------------------------
drop trigger if exists orders_notify_insert on orders;
create trigger orders_notify_insert
  after insert on orders
  for each row execute function public.tg_notify_order();

drop trigger if exists orders_notify_cancel on orders;
create trigger orders_notify_cancel
  after update of status on orders
  for each row execute function public.tg_notify_order();

-- ------------------------------------------------------------
-- CẤU HÌNH SAU KHI DEPLOY (chạy MỘT LẦN, KHÔNG commit secret vào git):
--
--   select vault.create_secret(
--     'https://<ten-site>.netlify.app/.netlify/functions/telegram-notify',
--     'telegram_notify_url'
--   );
--   select vault.create_secret('<chuoi-bi-mat-manh-ngau-nhien>', 'internal_api_key');
--
-- Đặt CÙNG chuỗi bí mật đó vào Netlify env: INTERNAL_API_KEY
-- (Site settings > Environment variables). Hai giá trị phải KHỚP nhau.
--
-- Cập nhật lại secret:  select vault.update_secret(id, 'gia-tri-moi') ...
-- ------------------------------------------------------------
