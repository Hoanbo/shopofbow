-- ============================================================================
-- BOW — Migration 0038: Cập nhật buy_with_wallet & create_order_with_coupon
-- Hỗ trợ đầy đủ: Giá Sỉ CTV + Giảm giá Chào mừng Đơn đầu + Đồng bộ p_plan_id
-- ============================================================================

-- 1. Nâng cấp RPC buy_with_wallet
create or replace function public.buy_with_wallet(
  p_user_id      uuid,
  p_product_name text,
  p_plan_label   text,
  p_price        numeric,
  p_payment_code text,
  p_notes        text    default null,
  p_product_id   uuid    default null,
  p_plan_id      uuid    default null,
  p_quantity     integer default 1,
  p_coupon_code  text    default null
)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_balance              numeric;
  v_user_role            text := 'member';
  v_unit_price           numeric := null;
  v_original_total       numeric;
  v_coupon_discount      numeric := 0;
  v_welcome_discount     numeric := 0;
  v_discount_amt         numeric := 0;
  v_final_total          numeric;
  v_coupon_record        record;
  v_coupon_id            uuid := null;
  v_coupon_code_snapshot text := null;
  v_order_id             uuid;
  v_valid_orders_count   integer := 0;
  v_user_used_count      integer := 0;
  v_clean_code           text;
  v_aff_enabled          boolean;
  v_aff_type             text;
  v_aff_discount         numeric;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return 'unauthorized';
  end if;

  -- 1. Lấy thông tin user role và số dư ví
  select coalesce(role, 'member'), balance
  into v_user_role, v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    return 'no_profile';
  end if;

  -- 2. Xác thực đơn giá từ Database (có tính đến Giá Sỉ CTV nếu role = 'ctv')
  if p_plan_id is not null then
    if v_user_role = 'ctv' then
      select coalesce(price_ctv, price) into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    else
      select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    end if;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if p_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, price) into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
      else
        select price into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
      end if;
    elsif p_product_name is not null then
      if v_user_role = 'ctv' then
        select coalesce(pp.price_ctv, pp.price) into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
      else
        select pp.price into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
      end if;
    end if;
  end if;

  if v_unit_price is null then
    if p_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where id = p_product_id and is_active = true;
      else
        select base_price into v_unit_price from public.products where id = p_product_id and is_active = true;
      end if;
    elsif p_product_name is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where name = p_product_name and is_active = true;
      else
        select base_price into v_unit_price from public.products where name = p_product_name and is_active = true;
      end if;
    end if;
  end if;

  if v_unit_price is not null then
    v_original_total := v_unit_price * p_quantity;
  else
    v_original_total := p_price;
  end if;

  -- 3. Tính ưu đãi chào mừng đơn đầu (Universal Welcome Discount) nếu là đơn đầu và không phải CTV
  if v_user_role <> 'ctv' then
    select count(*) into v_valid_orders_count
    from public.orders
    where user_id = p_user_id
      and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

    if v_valid_orders_count = 0 then
      if p_product_id is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where id = p_product_id;
      elsif p_product_name is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where name = p_product_name;
      end if;

      if (v_aff_enabled is null or v_aff_enabled = true) and v_aff_discount is not null and v_aff_discount > 0 then
        if v_aff_type = 'percentage' or v_aff_type = 'percent' then
          v_welcome_discount := round((v_original_total * v_aff_discount) / 100.0);
        else
          v_welcome_discount := v_aff_discount;
        end if;
        if v_welcome_discount > v_original_total then
          v_welcome_discount := v_original_total;
        end if;
      end if;
    end if;
  end if;

  -- 4. Nếu có coupon_code, kiểm tra điều kiện coupon
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));
    
    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update;

    if not found or not v_coupon_record.is_active then
      return 'invalid_coupon';
    end if;

    if v_coupon_record.start_at is not null and now() < v_coupon_record.start_at then
      return 'coupon_not_started';
    end if;

    if v_coupon_record.expires_at is not null and now() > v_coupon_record.expires_at then
      return 'coupon_expired';
    end if;

    if v_coupon_record.minimum_order_amount > 0 and v_original_total < v_coupon_record.minimum_order_amount then
      return 'coupon_min_amount_not_met';
    end if;

    if v_coupon_record.usage_limit is not null and v_coupon_record.used_count >= v_coupon_record.usage_limit then
      return 'coupon_usage_limit_reached';
    end if;

    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return 'coupon_user_limit_reached';
    end if;

    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return 'coupon_first_order_only';
      end if;
    end if;

    if v_coupon_record.discount_type = 'percentage' then
      v_coupon_discount := round((v_original_total * v_coupon_record.discount_value) / 100.0);
      if v_coupon_record.maximum_discount_amount is not null and v_coupon_record.maximum_discount_amount > 0 then
        if v_coupon_discount > v_coupon_record.maximum_discount_amount then
          v_coupon_discount := v_coupon_record.maximum_discount_amount;
        end if;
      end if;
    else
      v_coupon_discount := v_coupon_record.discount_value;
    end if;

    if v_coupon_discount > v_original_total then
      v_coupon_discount := v_original_total;
    end if;

    v_coupon_id := v_coupon_record.id;
    v_coupon_code_snapshot := v_coupon_record.code;
  end if;

  -- 5. Lấy mức giảm giá cao nhất giữa Coupon và Ưu đãi đơn đầu
  v_discount_amt := greatest(v_coupon_discount, v_welcome_discount);
  v_final_total := v_original_total - v_discount_amt;
  if v_final_total < 0 then v_final_total := 0; end if;

  -- 6. Kiểm tra số dư ví
  if v_balance < v_final_total then
    return 'insufficient_balance';
  end if;

  -- 7. Trừ tiền ví
  perform set_config('app.allow_balance_update', 'true', true);

  update public.profiles
  set balance = balance - v_final_total, updated_at = now()
  where id = p_user_id;

  -- 8. Tạo đơn hàng
  insert into public.orders (
    user_id,
    product_name,
    plan_label,
    price,
    original_price,
    discount_amount,
    coupon_id,
    coupon_code,
    status,
    payment_code,
    notes
  )
  values (
    p_user_id,
    p_product_name,
    p_plan_label,
    v_final_total,
    v_original_total,
    v_discount_amt,
    v_coupon_id,
    v_coupon_code_snapshot,
    'pending_delivery',
    p_payment_code,
    p_notes
  )
  returning id into v_order_id;

  -- 9. Ghi nhận sử dụng coupon nếu có
  if v_coupon_id is not null then
    update public.coupons
    set used_count = used_count + 1, updated_at = now()
    where id = v_coupon_id;

    insert into public.coupon_usages (
      coupon_id,
      user_id,
      order_id,
      original_amount,
      discount_amount,
      final_amount
    )
    values (
      v_coupon_id,
      p_user_id,
      v_order_id,
      v_original_total,
      v_discount_amt,
      v_final_total
    );

    perform public.log_audit_event(
      'coupon_used',
      'coupon',
      'Người dùng áp dụng mã giảm giá ' || v_coupon_code_snapshot || ' giảm ' || to_char(v_discount_amt, 'FM999,999,999') || 'đ cho đơn hàng ' || p_payment_code,
      v_coupon_id,
      jsonb_build_object(
        'order_id', v_order_id,
        'payment_code', p_payment_code,
        'user_id', p_user_id,
        'coupon_code', v_coupon_code_snapshot,
        'discount_amount', v_discount_amt,
        'original_price', v_original_total,
        'final_price', v_final_total
      )
    );
  end if;

  return 'success';
end$$;

-- 2. Tương tự cho RPC create_order_with_coupon (dành cho thanh toán VietQR)
create or replace function public.create_order_with_coupon(
  p_user_id      uuid,
  p_product_name text,
  p_plan_label   text,
  p_price        numeric,
  p_payment_code text,
  p_notes        text    default null,
  p_product_id   uuid    default null,
  p_plan_id      uuid    default null,
  p_quantity     integer default 1,
  p_coupon_code  text    default null
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_role            text := 'member';
  v_unit_price           numeric := null;
  v_original_total       numeric;
  v_coupon_discount      numeric := 0;
  v_welcome_discount     numeric := 0;
  v_discount_amt         numeric := 0;
  v_final_total          numeric;
  v_coupon_record        record;
  v_coupon_id            uuid := null;
  v_coupon_code_snapshot text := null;
  v_order_id             uuid;
  v_valid_orders_count   integer := 0;
  v_user_used_count      integer := 0;
  v_clean_code           text;
  v_aff_enabled          boolean;
  v_aff_type             text;
  v_aff_discount         numeric;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'error', 'unauthorized', 'message', 'Không có quyền thực hiện.');
  end if;

  -- 1. Lấy user role
  select coalesce(role, 'member') into v_user_role from public.profiles where id = p_user_id;

  -- 2. Xác thực đơn giá từ Database
  if p_plan_id is not null then
    if v_user_role = 'ctv' then
      select coalesce(price_ctv, price) into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    else
      select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    end if;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if p_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, price) into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
      else
        select price into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
      end if;
    elsif p_product_name is not null then
      if v_user_role = 'ctv' then
        select coalesce(pp.price_ctv, pp.price) into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
      else
        select pp.price into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
      end if;
    end if;
  end if;

  if v_unit_price is null then
    if p_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where id = p_product_id and is_active = true;
      else
        select base_price into v_unit_price from public.products where id = p_product_id and is_active = true;
      end if;
    elsif p_product_name is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where name = p_product_name and is_active = true;
      else
        select base_price into v_unit_price from public.products where name = p_product_name and is_active = true;
      end if;
    end if;
  end if;

  if v_unit_price is not null then
    v_original_total := v_unit_price * p_quantity;
  else
    v_original_total := p_price;
  end if;

  -- 3. Ưu đãi chào mừng đơn đầu nếu không phải CTV
  if v_user_role <> 'ctv' then
    select count(*) into v_valid_orders_count
    from public.orders
    where user_id = p_user_id
      and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

    if v_valid_orders_count = 0 then
      if p_product_id is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where id = p_product_id;
      elsif p_product_name is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where name = p_product_name;
      end if;

      if (v_aff_enabled is null or v_aff_enabled = true) and v_aff_discount is not null and v_aff_discount > 0 then
        if v_aff_type = 'percentage' or v_aff_type = 'percent' then
          v_welcome_discount := round((v_original_total * v_aff_discount) / 100.0);
        else
          v_welcome_discount := v_aff_discount;
        end if;
        if v_welcome_discount > v_original_total then
          v_welcome_discount := v_original_total;
        end if;
      end if;
    end if;
  end if;

  -- 4. Xử lý coupon nếu có
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));
    
    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update;

    if not found or not v_coupon_record.is_active then
      return jsonb_build_object('success', false, 'error', 'invalid_coupon', 'message', 'Mã giảm giá không hợp lệ.');
    end if;

    if v_coupon_record.start_at is not null and now() < v_coupon_record.start_at then
      return jsonb_build_object('success', false, 'error', 'coupon_not_started', 'message', 'Mã giảm giá chưa bắt đầu.');
    end if;

    if v_coupon_record.expires_at is not null and now() > v_coupon_record.expires_at then
      return jsonb_build_object('success', false, 'error', 'coupon_expired', 'message', 'Mã giảm giá đã hết hạn.');
    end if;

    if v_coupon_record.minimum_order_amount > 0 and v_original_total < v_coupon_record.minimum_order_amount then
      return jsonb_build_object('success', false, 'error', 'coupon_min_amount_not_met', 'message', 'Đơn hàng chưa đạt giá trị tối thiểu.');
    end if;

    if v_coupon_record.usage_limit is not null and v_coupon_record.used_count >= v_coupon_record.usage_limit then
      return jsonb_build_object('success', false, 'error', 'coupon_usage_limit_reached', 'message', 'Mã giảm giá đã hết lượt sử dụng.');
    end if;

    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return jsonb_build_object('success', false, 'error', 'coupon_user_limit_reached', 'message', 'Bạn đã dùng hết lượt mã này.');
    end if;

    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('success', false, 'error', 'coupon_first_order_only', 'message', 'Chỉ áp dụng cho đơn đầu.');
      end if;
    end if;

    if v_coupon_record.discount_type = 'percentage' then
      v_coupon_discount := round((v_original_total * v_coupon_record.discount_value) / 100.0);
      if v_coupon_record.maximum_discount_amount is not null and v_coupon_record.maximum_discount_amount > 0 then
        if v_coupon_discount > v_coupon_record.maximum_discount_amount then
          v_coupon_discount := v_coupon_record.maximum_discount_amount;
        end if;
      end if;
    else
      v_coupon_discount := v_coupon_record.discount_value;
    end if;

    if v_coupon_discount > v_original_total then
      v_coupon_discount := v_original_total;
    end if;

    v_coupon_id := v_coupon_record.id;
    v_coupon_code_snapshot := v_coupon_record.code;
  end if;

  -- 5. Lấy mức giảm giá cao nhất
  v_discount_amt := greatest(v_coupon_discount, v_welcome_discount);
  v_final_total := v_original_total - v_discount_amt;
  if v_final_total < 0 then v_final_total := 0; end if;

  -- 6. Tạo đơn hàng VietQR
  insert into public.orders (
    user_id,
    product_name,
    plan_label,
    price,
    original_price,
    discount_amount,
    coupon_id,
    coupon_code,
    status,
    payment_code,
    notes
  )
  values (
    p_user_id,
    p_product_name,
    p_plan_label,
    v_final_total,
    v_original_total,
    v_discount_amt,
    v_coupon_id,
    v_coupon_code_snapshot,
    'pending_payment',
    p_payment_code,
    p_notes
  )
  returning id into v_order_id;

  -- 7. Cập nhật lượt dùng coupon nếu có
  if v_coupon_id is not null then
    update public.coupons
    set used_count = used_count + 1, updated_at = now()
    where id = v_coupon_id;

    insert into public.coupon_usages (
      coupon_id,
      user_id,
      order_id,
      original_amount,
      discount_amount,
      final_amount
    )
    values (
      v_coupon_id,
      p_user_id,
      v_order_id,
      v_original_total,
      v_discount_amt,
      v_final_total
    );

    perform public.log_audit_event(
      'coupon_used',
      'coupon',
      'Người dùng áp dụng mã giảm giá ' || v_coupon_code_snapshot || ' giảm ' || to_char(v_discount_amt, 'FM999,999,999') || 'đ cho đơn VietQR ' || p_payment_code,
      v_coupon_id,
      jsonb_build_object(
        'order_id', v_order_id,
        'payment_code', p_payment_code,
        'user_id', p_user_id,
        'coupon_code', v_coupon_code_snapshot,
        'discount_amount', v_discount_amt,
        'original_price', v_original_total,
        'final_price', v_final_total
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'original_total', v_original_total,
    'discount_amount', v_discount_amt,
    'final_total', v_final_total
  );
end$$;
