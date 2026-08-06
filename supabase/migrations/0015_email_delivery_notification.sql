-- ============================================================
-- BOW — Migration 0015: BỔ SUNG GỬI EMAIL THÔNG BÁO BÀN GIAO ĐƠN HÀNG
-- ============================================================

create or replace function public.tg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event        text;
  v_url          text;
  v_email_url    text;
  v_key          text;
  v_price        text := trim(to_char(new.price, 'FM999G999G999')) || 'đ';
  v_user_title   text;
  v_user_msg     text;
  v_adm_title    text;
  v_adm_msg      text;
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
    -- Đơn vừa chuyển sang pending_delivery
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
      return new;
    end if;

  else
    return new;
  end if;

  -- ── 2. THÊM THÔNG BÁO CHO CHUÔNG USER ──
  if new.user_id is not null then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
    values (v_event, v_user_title, v_user_msg, new.id, new.user_id, false, false);
  end if;

  -- ── 3. THÊM THÔNG BÁO CHO CHUÔNG ADMIN ──
  insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
  values (v_event, v_adm_title, v_adm_msg, new.id, null, true, false);

  -- ── 4. THÔNG BÁO TELEGRAM (SERVER-TO-SERVER) ──
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

  -- ── 5. GỬI EMAIL THÔNG BÁO BÀN GIAO ĐƠN HÀNG (KHI status = 'completed') ──
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    begin
      select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    exception when others then
      v_email_url := null;
    end;

    if v_email_url is not null and v_key is not null then
      begin
        perform net.http_post(
          url     := v_email_url,
          body    := jsonb_build_object('order_id', new.id),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Apikey ' || v_key
          )
        );
      exception when others then
        raise warning '[email_notify_order] http_post failed: %', sqlerrm;
      end;
    end if;
  end if;

  return new;
end$$;

-- ── 6. GẮN TRIGGER CHO CẢ INSERT VÀ UPDATE TRÊN BẢNG ORDERS ──
drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.tg_notify_order();

drop trigger if exists orders_notify_update on public.orders;
create trigger orders_notify_update
  after update on public.orders
  for each row execute function public.tg_notify_order();
