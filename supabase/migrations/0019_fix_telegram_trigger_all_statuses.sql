-- ============================================================
-- BOW — Migration 0019: CẬP NHẬT TRIGGER TELEGRAM & THÔNG BÁO CHO TẤT CẢ TRẠNG THÁI
-- ============================================================

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
    if new.status = 'completed' and old.status is distinct from 'completed' then
      v_event := 'order_completed';
    elsif new.status = 'refunded' and old.status is distinct from 'refunded' then
      v_event := 'order_refunded';
    elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event := 'order_cancelled';
    elsif new.status = 'pending_delivery' and old.status is distinct from 'pending_delivery' then
      v_event := 'order_paid';
    else
      return new;
    end if;
  else
    return new;
  end if;

  -- ── 1. Notification cho chuông admin / user ──
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
  elsif v_event = 'order_completed' then
    insert into public.notifications(type, title, message, order_id, is_admin, is_read)
    values (
      'order_delivered', 'Đã bàn giao đơn hàng',
      'Đơn ' || new.payment_code || ' — ' || new.product_name || ' đã bàn giao thành công.',
      new.id, true, false
    );
  elsif v_event = 'order_refunded' then
    insert into public.notifications(type, title, message, order_id, is_admin, is_read)
    values (
      'order_refunded', 'Đã hoàn tiền đơn hàng',
      'Đơn ' || new.payment_code || ' — ' || new.product_name || ' đã được hoàn tiền về ví.',
      new.id, true, false
    );
  elsif v_event = 'order_cancelled' then
    insert into public.notifications(type, title, message, order_id, is_admin, is_read)
    values (
      'order_cancelled', 'Đơn hàng bị hủy',
      'Đơn ' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.',
      new.id, true, false
    );
  end if;

  -- ── 2. Gọi Netlify Function telegram-notify (nếu đã cấu hình Vault) ──
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'telegram_notify_url';
    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'internal_api_key';
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

-- Gắn trigger cho cả INSERT và UPDATE
drop trigger if exists orders_notify_insert on orders;
drop trigger if exists orders_notify_update on orders;

create trigger orders_notify_update
  after insert or update on orders
  for each row execute function public.tg_notify_order();
