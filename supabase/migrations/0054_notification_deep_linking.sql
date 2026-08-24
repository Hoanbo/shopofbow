-- ============================================================================
-- BOW — Migration 0054: NOTIFICATION DEEP LINKING & TARGET RESOLUTION
-- ============================================================================

set search_path = public, auth, extensions;

-- ────────────────────────────────────────────────────────────
-- 1. BỔ SUNG CỘT TARGET CHO PUBLIC.NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
alter table public.notifications
  add column if not exists ticket_id uuid references public.support_tickets(id) on delete set null,
  add column if not exists target_type text,
  add column if not exists target_id text;

-- Tạo index cho tra cứu target nhanh chóng
create index if not exists idx_notifications_target on public.notifications(target_type, target_id);
create index if not exists idx_notifications_ticket_id on public.notifications(ticket_id);

-- Backfill dữ liệu cũ
update public.notifications 
set target_type = 'order', 
    target_id = order_id::text 
where order_id is not null and target_type is null;

-- ────────────────────────────────────────────────────────────
-- 2. CẬP NHẬT TRIGGER BẢO VỆ CÁC TRƯỜNG BẤT BIẾN (IMMUTABLE GUARD)
-- ────────────────────────────────────────────────────────────
create or replace function public.trg_guard_notification_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Khóa toàn bộ các trường bất biến đối với user thường (chỉ cho phép thay đổi is_read)
  if new.user_id <> old.user_id then
    raise exception 'SECURITY: Không được phép thay đổi user_id của notification.';
  end if;

  if new.is_admin <> old.is_admin then
    raise exception 'SECURITY: Không được phép thay đổi cờ is_admin của notification.';
  end if;

  if new.type <> old.type then
    raise exception 'SECURITY: Không được phép thay đổi type của notification.';
  end if;

  if new.order_id is distinct from old.order_id then
    raise exception 'SECURITY: Không được phép thay đổi order_id của notification.';
  end if;

  if new.ticket_id is distinct from old.ticket_id then
    raise exception 'SECURITY: Không được phép thay đổi ticket_id của notification.';
  end if;

  if new.target_type is distinct from old.target_type then
    raise exception 'SECURITY: Không được phép thay đổi target_type của notification.';
  end if;

  if new.target_id is distinct from old.target_id then
    raise exception 'SECURITY: Không được phép thay đổi target_id của notification.';
  end if;

  if new.title <> old.title then
    raise exception 'SECURITY: Không được phép thay đổi title của notification.';
  end if;

  if new.message <> old.message then
    raise exception 'SECURITY: Không được phép thay đổi message của notification.';
  end if;

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. CẬP NHẬT CÁC TRIGGERS TỰ ĐỘNG GẮN TARGET_TYPE & TARGET_ID
-- ────────────────────────────────────────────────────────────

-- 3.1. Order Notifications Trigger
create or replace function public.tg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
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
  v_is_topup   boolean;
begin
  v_is_topup := (new.product_name = 'Nạp tiền vào ví')
                or (upper(coalesce(new.payment_code, '')) like 'BOWN%');
  if v_is_topup then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('pending', 'pending_payment') then
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
    if (new.status in ('pending_delivery', 'paid')) and (old.status is distinct from new.status and old.status not in ('pending_delivery', 'paid')) then
      v_event      := 'order_paid';
      v_user_title := 'Xác nhận thanh toán thành công';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã nhận thanh toán thành công và đang chờ bàn giao.';
      v_adm_title  := 'Đã nhận thanh toán đơn hàng';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price || ' đã nhận tiền từ ngân hàng.';

    elsif (new.status in ('processing', 'delivering')) and (old.status is distinct from new.status and old.status not in ('processing', 'delivering')) then
      v_event      := 'order_processing';
      v_user_title := 'Đơn hàng đang được xử lý';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đang được thiết lập. Vui lòng chờ trong giây lát.';
      v_adm_title  := 'Đơn hàng đang xử lý';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đang được xử lý.';

    elsif new.status = 'completed' and old.status is distinct from 'completed' then
      v_event      := 'order_completed';
      v_user_title := '🎉 Đơn hàng đã bàn giao hoàn tất';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã được bàn giao! Vui lòng kiểm tra thông tin tài khoản.';
      v_adm_title  := 'Đã hoàn tất bàn giao đơn hàng';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đã bàn giao thành công.';

    elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event      := 'order_cancelled';
      v_user_title := 'Đơn hàng đã bị hủy';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.';
      v_adm_title  := 'Đơn hàng bị hủy';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' đã bị hủy.';

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

  -- 1. Insert thông báo User (với target_type = 'order' và target_id = new.id)
  if new.user_id is not null then
    if not exists (
      select 1 from public.notifications
      where order_id = new.id and type = v_event and is_admin = false
    ) then
      insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id, created_at)
      values (v_event, v_user_title, v_user_msg, new.id, new.user_id, false, false, 'order', new.id::text, now());
    end if;
  end if;

  -- 2. Insert thông báo Admin (với target_type = 'order' và target_id = new.id)
  if not exists (
    select 1 from public.notifications
    where order_id = new.id and type = v_event and is_admin = true
  ) then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id, created_at)
    values (v_event, v_adm_title, v_adm_msg, new.id, null, true, false, 'order', new.id::text, now());
  end if;

  -- 3. Gửi Telegram webhook nếu có cấu hình
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
      null;
    end;
  end if;

  return new;
end;
$$;

-- 3.2. Support Ticket Insert Trigger
create or replace function public.tg_notify_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_email text;
begin
  if tg_op = 'INSERT' then
    select coalesce(email, 'Khách hàng') into v_user_email from auth.users where id = new.user_id;
    
    insert into public.notifications(type, title, message, ticket_id, is_admin, is_read, target_type, target_id)
    values (
      'ticket_created',
      '🎫 Ticket mới ' || coalesce(new.ticket_number, ''),
      coalesce(v_user_email, 'Khách hàng') || ': ' || new.subject,
      new.id,
      true,
      false,
      'ticket',
      new.id::text
    );
  end if;
  return new;
end;
$$;

-- 3.3. Support Ticket Status Update Trigger
create or replace function public.tg_notify_support_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status_label text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.user_id is not null then
    v_status_label := case new.status
      when 'processing' then 'Đang xử lý'
      when 'resolved' then 'Đã giải quyết'
      when 'closed' then 'Đã đóng'
      else new.status
    end;

    insert into public.notifications(type, title, message, ticket_id, user_id, is_admin, is_read, target_type, target_id)
    values (
      'ticket_status',
      'Cập nhật Ticket ' || coalesce(new.ticket_number, ''),
      'Trạng thái yêu cầu hỗ trợ của bạn đã chuyển sang: ' || v_status_label,
      new.id,
      new.user_id,
      false,
      false,
      'ticket',
      new.id::text
    );
  end if;
  return new;
end;
$$;

-- 3.4. Support Message Insert Trigger
create or replace function public.tg_notify_support_message()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ticket record;
  v_short_msg text;
begin
  if tg_op = 'INSERT' then
    select id, ticket_number, user_id into v_ticket from public.support_tickets where id = new.ticket_id;
    if not found then return new; end if;

    v_short_msg := case when length(new.message) > 60 then substring(new.message from 1 for 60) || '...' else new.message end;

    if new.sender_role = 'user' then
      insert into public.notifications(type, title, message, ticket_id, is_admin, is_read, target_type, target_id)
      values (
        'ticket_message',
        '💬 Tin nhắn từ ' || coalesce(v_ticket.ticket_number, 'Ticket'),
        v_short_msg,
        v_ticket.id,
        true,
        false,
        'ticket',
        v_ticket.id::text
      );
    elsif new.sender_role = 'admin' and v_ticket.user_id is not null then
      insert into public.notifications(type, title, message, ticket_id, user_id, is_admin, is_read, target_type, target_id)
      values (
        'ticket_reply',
        'BOW đã phản hồi Ticket ' || coalesce(v_ticket.ticket_number, ''),
        v_short_msg,
        v_ticket.id,
        v_ticket.user_id,
        false,
        false,
        'ticket',
        v_ticket.id::text
      );
    end if;
  end if;
  return new;
end;
$$;

-- 3.5. Product Review Update Trigger
create or replace function public.tg_notify_product_review()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_prod_name text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.user_id is not null then
    select name into v_prod_name from public.products where id = new.product_id;
    v_prod_name := coalesce(v_prod_name, 'Sản phẩm');

    if new.status = 'approved' then
      insert into public.notifications(type, title, message, user_id, is_admin, is_read, target_type, target_id)
      values (
        'review_status',
        'Đánh giá đã được phê duyệt',
        'Đánh giá của bạn cho sản phẩm "' || v_prod_name || '" đã được phê duyệt và xuất hiện công khai!',
        new.user_id,
        false,
        false,
        'review',
        new.product_id::text
      );
    elsif new.status = 'rejected' then
      insert into public.notifications(type, title, message, user_id, is_admin, is_read, target_type, target_id)
      values (
        'review_status',
        'Cập nhật Đánh giá sản phẩm',
        'Đánh giá của bạn cho sản phẩm "' || v_prod_name || '" chưa được phê duyệt.',
        new.user_id,
        false,
        false,
        'review',
        new.product_id::text
      );
    end if;
  end if;
  return new;
end;
$$;
