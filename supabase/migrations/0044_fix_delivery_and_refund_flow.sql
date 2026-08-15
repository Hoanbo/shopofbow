-- ============================================================================
-- BOW — Migration 0044: SỬA LỖI BÀN GIAO (DELIVERY_INFO) VÀ HOÀN TIỀN (REFUND_ORDER)
-- 1. Bổ sung cột delivery_info vào bảng orders
-- 2. Cập nhật hàm refund_order và cancel_and_refund_own_order với app.allow_balance_update
-- 3. Chuẩn hóa mã trả về 'refunded_success'
-- ============================================================================

set search_path = public, auth, extensions;

-- ── 1. BỔ SUNG CỘT DELIVERY_INFO VÀ CÁC CỘT QUẢN LÝ VÀO BẢNG ORDERS ──
alter table public.orders
  add column if not exists delivery_info text,
  add column if not exists account_details text,
  add column if not exists delivered_at timestamptz default null,
  add column if not exists refunded_at timestamptz default null;

-- Đồng bộ dữ liệu cũ giữa account_details và delivery_info
update public.orders
set delivery_info = account_details
where delivery_info is null and account_details is not null;

update public.orders
set account_details = delivery_info
where account_details is null and delivery_info is not null;

-- ── 2. NÂNG CẤP HÀM RPC REFUND_ORDER DÀNH CHO ADMIN ──
create or replace function public.refund_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order record;
  v_user  record;
begin
  -- 1. Kiểm tra quyền Admin
  if not public.is_admin() then
    return 'unauthorized';
  end if;

  -- 2. Lấy thông tin đơn hàng
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    return 'order_not_found';
  end if;

  -- Chỉ cho phép hoàn tiền nếu đơn chưa bị hủy hoặc chưa hoàn tiền
  if v_order.status in ('cancelled', 'refunded') then
    return 'already_cancelled_or_refunded';
  end if;

  if v_order.user_id is null then
    return 'no_user_to_refund';
  end if;

  -- 3. Mở cờ cho phép cập nhật số dư ví
  perform set_config('app.allow_balance_update', 'true', true);

  -- 4. Hoàn tiền 100% vào ví của khách hàng
  update public.profiles
  set balance = coalesce(balance, 0) + v_order.price,
      updated_at = now()
  where id = v_order.user_id;

  -- 5. Cập nhật trạng thái đơn hàng sang 'refunded'
  update public.orders
  set status = 'refunded',
      refunded_at = now(),
      updated_at = now()
  where id = p_order_id;

  -- 6. Hủy bỏ hoa hồng affiliate đang pending (nếu có)
  update public.affiliate_conversions
  set status = 'cancelled'
  where order_id = p_order_id and status = 'pending';

  -- 7. Gửi thông báo in-app đến khách hàng
  insert into public.notifications (
    user_id, title, message, type, order_id, is_admin, is_read, created_at
  ) values (
    v_order.user_id,
    '💸 Đơn hàng đã được hoàn tiền',
    'Đơn hàng #' || coalesce(v_order.payment_code, v_order.id::text) || ' (' || coalesce(v_order.product_name, 'Sản phẩm') || ') đã được hoàn ' || to_char(v_order.price, 'FM999,999,999') || 'đ về ví tài khoản của bạn.',
    'order_refunded',
    v_order.id,
    false,
    false,
    now()
  );

  -- 8. Ghi log audit an toàn
  perform public.log_audit_event(
    p_action      => 'order_refunded',
    p_entity_type => 'order',
    p_description => 'Admin đã hoàn tiền ' || to_char(v_order.price, 'FM999,999,999') || 'đ về ví cho đơn hàng #' || coalesce(v_order.payment_code, v_order.id::text),
    p_actor_id    => auth.uid(),
    p_entity_id   => v_order.id::text,
    p_metadata    => jsonb_build_object(
      'order_id', v_order.id,
      'payment_code', v_order.payment_code,
      'user_id', v_order.user_id,
      'refund_amount', v_order.price
    )
  );

  return 'refunded_success';
end;
$$;

grant execute on function public.refund_order(uuid) to authenticated;

-- ── 3. NÂNG CẤP HÀM RPC CANCEL_AND_REFUND_OWN_ORDER (USER TỰ HỦY ĐƠN) ──
create or replace function public.cancel_and_refund_own_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    return 'unauthorized';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    return 'order_not_found';
  end if;

  if v_order.status in ('cancelled', 'completed', 'refunded') then
    return 'cannot_cancel';
  end if;

  -- Nếu đơn chưa thanh toán (pending_payment) -> Chỉ cần hủy đơn
  if v_order.status = 'pending_payment' then
    update public.orders
    set status = 'cancelled', updated_at = now()
    where id = p_order_id;
    return 'cancelled_success';
  end if;

  -- Nếu đơn đã trừ tiền ví (pending_delivery) -> Hoàn tiền về ví
  if v_order.status = 'pending_delivery' then
    -- Mở cờ cho phép cập nhật số dư ví
    perform set_config('app.allow_balance_update', 'true', true);

    update public.profiles
    set balance = coalesce(balance, 0) + v_order.price,
        updated_at = now()
    where id = auth.uid();

    update public.orders
    set status = 'refunded',
        refunded_at = now(),
        updated_at = now()
    where id = p_order_id;

    -- Hủy conversion affiliate pending
    update public.affiliate_conversions
    set status = 'cancelled'
    where order_id = p_order_id and status = 'pending';

    -- Ghi nhận log audit
    perform public.log_audit_event(
      p_action      => 'order_cancelled_and_refunded_by_user',
      p_entity_type => 'order',
      p_description => 'Khách hàng tự hủy đơn #' || coalesce(v_order.payment_code, v_order.id::text) || ' và nhận lại ' || to_char(v_order.price, 'FM999,999,999') || 'đ vào ví',
      p_actor_id    => auth.uid(),
      p_entity_id   => v_order.id::text,
      p_metadata    => jsonb_build_object(
        'order_id', v_order.id,
        'payment_code', v_order.payment_code,
        'refund_amount', v_order.price
      )
    );

    return 'refunded_success';
  end if;

  return 'invalid_order_status';
end;
$$;

grant execute on function public.cancel_and_refund_own_order(uuid) to authenticated;
