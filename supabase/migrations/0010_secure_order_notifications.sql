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
-- Khóa RLS cho bảng notifications & Xóa row test rác
-- ------------------------------------------------------------
-- 1. Xóa thông báo giả test cũ (id: 9a1305fc-2829-4c32-84f5-669b7a89d9cb)
delete from public.notifications where id = '9a1305fc-2829-4c32-84f5-669b7a89d9cb';

-- 2. Cập nhật RLS Policies cho notifications
drop policy if exists "admin read notifications" on notifications;
create policy "admin read notifications" on notifications
  for select to authenticated
  using (is_admin());

drop policy if exists "admin update notifications" on notifications;
create policy "admin update notifications" on notifications
  for update to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "admin delete notifications" on notifications;
create policy "admin delete notifications" on notifications
  for delete to authenticated
  using (is_admin());

drop policy if exists "user delete notifications" on notifications;
create policy "user delete notifications" on notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Khóa quyền insert: User thường chỉ chèn thông báo cho chính mình (is_admin = false), admin được chèn tất cả
drop policy if exists "authenticated insert notifications" on notifications;
create policy "authenticated insert notifications" on notifications
  for insert to authenticated
  with check ((is_admin = false and user_id = auth.uid()) or is_admin());

-- ------------------------------------------------------------
-- Khóa bảo mật RPC buy_with_wallet & refund_order + Sửa schema drift updated_at
-- ------------------------------------------------------------
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create or replace function buy_with_wallet(
  p_user_id      uuid,
  p_product_name text,
  p_plan_label   text,
  p_price        numeric,
  p_payment_code text,
  p_notes        text default null,
  p_product_id   uuid default null,
  p_plan_id      uuid default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_balance    numeric;
  v_real_price numeric := null;
begin
  -- 1. Yêu cầu auth.uid() trùng với p_user_id (chống giả mạo trừ tiền người khác)
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return 'unauthorized';
  end if;

  -- 2. Tra cứu giá thật từ DB (chống client sửa p_price thành 0đ hay 1đ)
  if p_plan_id is not null then
    select price into v_real_price
    from public.product_plans
    where id = p_plan_id and is_active = true;
  end if;

  if v_real_price is null and p_plan_label is not null then
    if p_product_id is not null then
      select price into v_real_price
      from public.product_plans
      where product_id = p_product_id and name = p_plan_label and is_active = true
      limit 1;
    elsif p_product_name is not null then
      select pp.price into v_real_price
      from public.product_plans pp
      join public.products p on p.id = pp.product_id
      where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true
      limit 1;
    end if;
  end if;

  if v_real_price is null then
    if p_product_id is not null then
      select base_price into v_real_price
      from public.products
      where id = p_product_id and is_active = true;
    elsif p_product_name is not null then
      select base_price into v_real_price
      from public.products
      where name = p_product_name and is_active = true;
    end if;
  end if;

  -- Ghi đè p_price bằng giá chuẩn từ DB nếu tìm thấy
  if v_real_price is not null then
    p_price := v_real_price;
  end if;

  -- 3. Khóa dòng profile để tránh race condition
  select balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    return 'no_profile';
  end if;

  if v_balance < p_price then
    return 'insufficient_balance';
  end if;

  -- 4. Trừ tiền ví
  update public.profiles
  set balance = balance - p_price,
      updated_at = now()
  where id = p_user_id;

  -- 5. Tạo đơn hàng với trạng thái pending_delivery
  insert into public.orders (user_id, product_name, plan_label, price, status, payment_code, notes)
  values (p_user_id, p_product_name, p_plan_label, p_price, 'pending_delivery', p_payment_code, p_notes);

  return 'success';
end$$;

create or replace function refund_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  if not is_admin() then
    return 'unauthorized';
  end if;

  select * into v_order from orders where id = p_order_id;

  if not found then
    return 'order_not_found';
  end if;

  if v_order.status not in ('pending_delivery', 'processing') then
    return 'invalid_status';
  end if;

  update public.profiles
  set balance = balance + v_order.price,
      updated_at = now()
  where id = v_order.user_id;

  update public.orders
  set status = 'refunded',
      updated_at = now()
  where id = p_order_id;

  return 'success';
end$$;

-- ------------------------------------------------------------
-- Hàm RPC cancel_and_refund_own_order (Khách hàng tự hủy đơn & hoàn tiền ví)
-- ------------------------------------------------------------
create or replace function cancel_and_refund_own_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  if auth.uid() is null then
    return 'unauthorized';
  end if;

  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;

  if not found then
    return 'order_not_found';
  end if;

  if v_order.status in ('cancelled', 'completed', 'refunded') then
    return 'cannot_cancel';
  end if;

  alter table public.profiles add column if not exists updated_at timestamptz not null default now();
  alter table public.orders add column if not exists updated_at timestamptz not null default now();

  if v_order.status = 'pending_payment' then
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'success';
  end if;

  if v_order.status in ('pending_delivery', 'processing') then
    update public.profiles
    set balance = balance + v_order.price,
        updated_at = now()
    where id = auth.uid();

    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    insert into public.notifications (type, title, message, order_id, user_id, is_admin, is_read)
    values (
      'system',
      'Hủy đơn & Hoàn tiền ví',
      'Bạn đã hủy đơn ' || v_order.payment_code || '. Số tiền ' || to_char(v_order.price, 'FM999,999,999') || 'đ đã được hoàn về ví số dư của bạn.',
      v_order.id,
      auth.uid(),
      false,
      false
    );

    insert into public.notifications (type, title, message, order_id, is_admin, is_read)
    values (
      'new_order',
      'Khách tự hủy đơn & Hoàn tiền ví',
      'Khách hàng đã tự hủy đơn ' || v_order.payment_code || ' (' || v_order.product_name || '). Tiền đã hoàn tự động về ví.',
      v_order.id,
      true,
      false
    );

    return 'refunded_success';
  end if;

  return 'cannot_cancel';
end$$;

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
