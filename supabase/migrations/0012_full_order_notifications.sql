-- ============================================================
-- BOW — Migration 0012: HỆ THỐNG THÔNG BÁO ĐẦY ĐỦ CHO USER & ADMIN & TELEGRAM
--
-- Sự kiện & Trạng thái:
--   1. INSERT (pending_payment): User + Admin Notification + Telegram (new_order)
--   2. INSERT (pending_delivery): User + Admin Notification + Telegram (new_order)
--   3. UPDATE -> pending_delivery: User + Admin Notification + Telegram (order_paid)
--   4. UPDATE -> completed: User + Admin Notification + Telegram (order_completed)
--   5. UPDATE -> cancelled: User + Admin Notification + Telegram (order_cancelled)
--   6. UPDATE -> refunded: User + Admin Notification + Telegram (order_refunded)
-- ============================================================

create or replace function public.tg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event      text;
  v_url        text;
  v_key        text;
  v_price      text := trim(to_char(new.price, 'FM999G999G999')) || 'đ';
  v_user_title text;
  v_user_msg   text;
  v_adm_title  text;
  v_adm_msg    text;
begin
  -- ── 1. PHÂN LOẠI SỰ KIỆN ──
  if tg_op = 'INSERT' then
    if new.status = 'pending_payment' then
      v_event      := 'new_order';
      v_user_title := 'Tạo đơn hàng thành công';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' (' || v_price || ') đã được tạo. Vui lòng thanh toán qua VietQR.';
      v_adm_title  := 'Đơn hàng mới (chờ chuyển khoản)';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price || ' (Chờ thanh toán).';
    else
      v_event      := 'new_order';
      v_user_title := 'Thanh toán ví thành công';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' (' || v_price || ') đã thanh toán bằng ví và đang chờ bàn giao.';
      v_adm_title  := 'Đơn hàng mới (đã thanh toán ví)';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price || ' (Đã trừ ví).';
    end if;

  elsif tg_op = 'UPDATE' then
    -- Đơn vừa chuyển sang pending_delivery (SePay nhận tiền hoặc Admin duyệt thủ công)
    if new.status = 'pending_delivery' and old.status is distinct from 'pending_delivery' then
      v_event      := 'order_paid';
      v_user_title := 'Xác nhận thanh toán thành công';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã nhận thanh toán thành công và đang chờ bàn giao.';
      v_adm_title  := 'Đã nhận thanh toán đơn hàng';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price || ' đã nhận tiền từ ngân hàng.';

    -- Đơn vừa chuyển sang completed (Admin bàn giao tài khoản)
    elsif new.status = 'completed' and old.status is distinct from 'completed' then
      v_event      := 'order_completed';
      v_user_title := '🎉 Đơn hàng đã bàn giao hoàn tất';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã được bàn giao! Vui lòng kiểm tra thông tin tài khoản.';
      v_adm_title  := 'Đã hoàn tất bàn giao đơn hàng';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đã bàn giao thành công.';

    -- Đơn bị hủy
    elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event      := 'order_cancelled';
      v_user_title := 'Đơn hàng đã bị hủy';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.';
      v_adm_title  := 'Đơn hàng bị hủy';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.';

    -- Đơn được hoàn tiền về ví
    elsif new.status = 'refunded' and old.status is distinct from 'refunded' then
      v_event      := 'order_refunded';
      v_user_title := '💸 Đã hoàn tiền vào số dư ví';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' đã được hoàn lại ' || v_price || ' vào số dư ví của bạn.';
      v_adm_title  := 'Đã hoàn tiền đơn hàng về ví';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đã hoàn tiền ' || v_price || ' về ví khách hàng.';
    else
      return new; -- các thay đổi khác không gửi thông báo
    end if;

  else
    return new;
  end if;

  -- ── 2. THÊM THÔNG BÁO CHO CHUÔNG USER (is_admin = false, user_id = new.user_id) ──
  if new.user_id is not null then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
    values (v_event, v_user_title, v_user_msg, new.id, new.user_id, false, false);
  end if;

  -- ── 3. THÊM THÔNG BÁO CHO CHUÔNG ADMIN (is_admin = true, user_id = null) ──
  insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
  values (v_event, v_adm_title, v_adm_msg, new.id, null, true, false);

  -- ── 4. GỌI NETLIFY FUNCTION TELEGRAM-NOTIFY (HTTP SERVER->SERVER) ──
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'telegram_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_url := null;
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
      raise warning '[tg_notify_order] http_post failed: %', sqlerrm;
    end;
  end if;

  return new;
end$$;

-- Gắn trigger cho cả INSERT và UPDATE trên orders
drop trigger if exists orders_notify_insert on orders;
create trigger orders_notify_insert
  after insert on orders
  for each row execute function public.tg_notify_order();

drop trigger if exists orders_notify_update on orders;
create trigger orders_notify_update
  after update of status on orders
  for each row execute function public.tg_notify_order();

-- ------------------------------------------------------------
-- Hàm RPC cancel_and_refund_own_order (Chuẩn hóa RLS & Trigger)
--   • User tự HỦY ĐƠN HÀNG của chính mình.
--   • Nếu đơn đã nhận tiền (pending_delivery), hệ thống TỰ ĐỘNG hoàn tiền về ví.
--   • Trigger tg_notify_order() ở trên sẽ tự động bắn thông báo
--     cho User + Admin + Telegram một cách tập trung, không trùng lặp.
-- ------------------------------------------------------------
create or replace function cancel_and_refund_own_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  -- 1. Yêu cầu người dùng đã đăng nhập
  if auth.uid() is null then
    return 'unauthorized';
  end if;

  -- 2. Đọc đơn hàng của chính user đó & khóa dòng chống race condition
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    return 'order_not_found';
  end if;

  -- Đơn đã hủy hoặc đã hoàn thành -> không thể hủy
  if v_order.status in ('cancelled', 'completed', 'refunded') then
    return 'cannot_cancel';
  end if;

  -- 3. Đơn chưa thanh toán: Chỉ đổi trạng thái hủy
  if v_order.status = 'pending_payment' then
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'success';
  end if;

  -- 4. Đơn đã thanh toán (pending_delivery hoặc processing): Hủy & Hoàn tiền ví tự động
  if v_order.status in ('pending_delivery', 'processing') then
    -- Hoàn tiền về ví khách hàng
    update public.profiles
    set balance = balance + v_order.price,
        updated_at = now()
    where id = auth.uid();

    -- Cập nhật đơn thành đã hủy (Trigger tg_notify_order sẽ tự động gửi thông báo)
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'refunded_success';
  end if;

  return 'invalid_status';
end$$;
