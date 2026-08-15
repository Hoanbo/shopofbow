-- ============================================================================
-- BOW — Migration 0045: CHUẨN HÓA GHI NHẬN DOANH THU AFFILIATE
-- Chỉ ghi nhận Affiliate khi có người giới thiệu hợp lệ hoặc đơn sỉ CTV.
-- Khách mua trực tiếp không qua link tiếp thị sẽ không tạo dòng rác trong affiliate_conversions.
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Xóa các bản ghi rác "Tự mua trực tiếp" không có người giới thiệu và không phải CTV
delete from public.affiliate_conversions
where referrer_id is null and (is_ctv_order is null or is_ctv_order = false);

-- 2. Cập nhật RPC record_affiliate_conversion
create or replace function public.record_affiliate_conversion(
  p_order_id      uuid,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth as $$
declare
  v_order         record;
  v_referrer      record;
  v_buyer         record;
  v_product       record;
  v_clean_code    text;
  v_commission    numeric := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  -- 1. Tìm đơn hàng
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  -- Xác thực quyền: Chỉ người tạo đơn hoặc Admin mới được yêu cầu record
  if v_order.user_id <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden_order');
  end if;

  -- 2. Kiểm tra nếu đơn hàng đã được ghi nhận trước đó
  if exists (select 1 from public.affiliate_conversions where order_id = p_order_id) then
    return jsonb_build_object('success', true, 'already_recorded', true);
  end if;

  -- 3. Lấy thông tin người mua
  select * into v_buyer from public.profiles where id = v_order.user_id;

  -- Nếu là đơn hàng CTV mua sỉ -> Ghi nhận log sỉ (hoa hồng = 0đ)
  if v_buyer.role = 'ctv' then
    insert into public.affiliate_conversions (
      referrer_id, referee_id, order_id, product_name,
      order_amount, commission_amount, discount_amount, is_ctv_order, status
    ) values (
      null, v_order.user_id, p_order_id, v_order.product_name,
      v_order.price, 0, coalesce(v_order.discount_amount, 0), true, 'pending'
    );
    return jsonb_build_object('success', true, 'is_ctv_order', true);
  end if;

  -- 4. Xác định người giới thiệu
  if p_referral_code is null or trim(p_referral_code) = '' then
    if v_buyer.referred_by is not null then
      select * into v_referrer from public.profiles where id = v_buyer.referred_by;
    end if;
  else
    v_clean_code := upper(trim(p_referral_code));
    select * into v_referrer from public.profiles where upper(referral_code) = v_clean_code;
  end if;

  -- 5. Nếu không có người giới thiệu hoặc tự mua qua mã của chính mình -> KHÔNG GHI NHẬN VÀO BẢNG AFFILIATE
  if v_referrer.id is null or v_referrer.id = v_order.user_id then
    return jsonb_build_object('success', true, 'no_referrer', true);
  end if;

  -- 6. Tính toán hoa hồng chính xác từ Database sản phẩm
  select * into v_product
  from public.products
  where name = v_order.product_name or id in (select product_id from public.product_plans where name = v_order.plan_label limit 1)
  limit 1;

  if found and (v_product.affiliate_enabled is null or v_product.affiliate_enabled = true) and v_product.affiliate_reward > 0 then
    if v_product.affiliate_type = 'percent' or v_product.affiliate_type = 'percentage' then
      v_commission := round((v_order.price * v_product.affiliate_reward) / 100.0);
    else
      v_commission := v_product.affiliate_reward;
    end if;
  else
    v_commission := 0;
  end if;

  -- 7. Ghi nhận giao dịch affiliate thực tế
  insert into public.affiliate_conversions (
    referrer_id,
    referee_id,
    order_id,
    product_name,
    order_amount,
    commission_amount,
    discount_amount,
    is_ctv_order,
    status
  ) values (
    v_referrer.id,
    v_order.user_id,
    p_order_id,
    v_order.product_name,
    v_order.price,
    v_commission,
    coalesce(v_order.discount_amount, 0),
    false,
    case when v_order.status = 'completed' then 'completed' else 'pending' end
  );

  return jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer.id,
    'commission_amount', v_commission
  );
end;
$$;

grant execute on function public.record_affiliate_conversion(uuid, text) to authenticated;
