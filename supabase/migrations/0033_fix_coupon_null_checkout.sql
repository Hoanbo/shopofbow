-- Migration 0033: Sửa lỗi unassigned record khi checkout không kèm mã giảm giá & dọn sạch overload cũ

drop function if exists public.buy_with_wallet(uuid, text, text, numeric, text, text);
drop function if exists public.buy_with_wallet(uuid, text, text, numeric, text, text, uuid);
drop function if exists public.buy_with_wallet(uuid, text, text, numeric, text, text, uuid, uuid);
drop function if exists public.buy_with_wallet(uuid, text, text, numeric, text, text, uuid, uuid, integer);
drop function if exists public.buy_with_wallet(uuid, text, text, numeric, text, text, uuid, uuid, integer, text);

drop function if exists public.create_order_with_coupon(uuid, text, text, numeric, text, text);
drop function if exists public.create_order_with_coupon(uuid, text, text, numeric, text, text, uuid, uuid);
drop function if exists public.create_order_with_coupon(uuid, text, text, numeric, text, text, uuid, uuid, integer);
drop function if exists public.create_order_with_coupon(uuid, text, text, numeric, text, text, uuid, uuid, integer, text);

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
  v_balance        numeric;
  v_unit_price     numeric := null;
  v_original_total numeric;
  v_discount_amt   numeric := 0;
  v_final_total    numeric;
  v_coupon_record  record;
  v_coupon_id      uuid := null;
  v_coupon_code_snapshot text := null;
  v_order_id       uuid;
  v_valid_orders_count integer := 0;
  v_user_used_count    integer := 0;
  v_clean_code     text;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return 'unauthorized';
  end if;

  -- 1. Xác thực giá gốc từ Database
  if p_plan_id is not null then
    select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if p_product_id is not null then
      select price into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
    elsif p_product_name is not null then
      select pp.price into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
    end if;
  end if;

  if v_unit_price is null then
    if p_product_id is not null then
      select base_price into v_unit_price from public.products where id = p_product_id and is_active = true;
    elsif p_product_name is not null then
      select base_price into v_unit_price from public.products where name = p_product_name and is_active = true;
    end if;
  end if;

  if v_unit_price is not null then
    v_original_total := v_unit_price * p_quantity;
  else
    v_original_total := p_price;
  end if;

  v_final_total := v_original_total;

  -- 2. Nếu có coupon_code, khóa row coupon và kiểm tra điều kiện an toàn
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));
    
    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update; -- Chống race-condition khi nhiều user cùng checkout

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

    -- Kiểm tra per_user_limit
    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return 'coupon_user_limit_reached';
    end if;

    -- Kiểm tra first_order_only
    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return 'coupon_first_order_only';
      end if;
    end if;

    -- Tính discount
    if v_coupon_record.discount_type = 'percentage' then
      v_discount_amt := round((v_original_total * v_coupon_record.discount_value) / 100.0);
      if v_coupon_record.maximum_discount_amount is not null and v_coupon_record.maximum_discount_amount > 0 then
        if v_discount_amt > v_coupon_record.maximum_discount_amount then
          v_discount_amt := v_coupon_record.maximum_discount_amount;
        end if;
      end if;
    else
      v_discount_amt := v_coupon_record.discount_value;
    end if;

    if v_discount_amt > v_original_total then
      v_discount_amt := v_original_total;
    end if;

    v_final_total := v_original_total - v_discount_amt;
    if v_final_total < 0 then v_final_total := 0; end if;

    v_coupon_id := v_coupon_record.id;
    v_coupon_code_snapshot := v_coupon_record.code;
  end if;

  -- 3. Khóa và kiểm tra số dư ví
  select balance into v_balance from public.profiles where id = p_user_id for update;

  if v_balance is null then return 'no_profile'; end if;
  if v_balance < v_final_total then return 'insufficient_balance'; end if;

  -- 4. Trừ tiền ví
  update public.profiles
  set balance = balance - v_final_total, updated_at = now()
  where id = p_user_id;

  -- 5. Tạo đơn hàng với snapshot coupon an toàn
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

  -- 6. Ghi nhận sử dụng coupon nếu có
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

    -- Ghi audit log
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
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_unit_price     numeric := null;
  v_original_total numeric;
  v_discount_amt   numeric := 0;
  v_final_total    numeric;
  v_coupon_record  record;
  v_coupon_id      uuid := null;
  v_coupon_code_snapshot text := null;
  v_order_id       uuid;
  v_valid_orders_count integer := 0;
  v_user_used_count    integer := 0;
  v_clean_code     text;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'error', 'unauthorized', 'message', 'Phiên đăng nhập không hợp lệ.');
  end if;

  -- 1. Xác thực giá gốc từ Database
  if p_plan_id is not null then
    select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if p_product_id is not null then
      select price into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
    elsif p_product_name is not null then
      select pp.price into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
    end if;
  end if;

  if v_unit_price is null then
    if p_product_id is not null then
      select base_price into v_unit_price from public.products where id = p_product_id and is_active = true;
    elsif p_product_name is not null then
      select base_price into v_unit_price from public.products where name = p_product_name and is_active = true;
    end if;
  end if;

  if v_unit_price is not null then
    v_original_total := v_unit_price * p_quantity;
  else
    v_original_total := p_price;
  end if;

  v_final_total := v_original_total;

  -- 2. Nếu có coupon_code, khóa row coupon và kiểm tra điều kiện an toàn
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));
    
    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update;

    if not found or not v_coupon_record.is_active then
      return jsonb_build_object('success', false, 'error', 'invalid_coupon', 'message', 'Mã giảm giá không tồn tại hoặc đã tạm ngưng.');
    end if;

    if v_coupon_record.start_at is not null and now() < v_coupon_record.start_at then
      return jsonb_build_object('success', false, 'error', 'coupon_not_started', 'message', 'Mã giảm giá chưa đến thời gian áp dụng.');
    end if;

    if v_coupon_record.expires_at is not null and now() > v_coupon_record.expires_at then
      return jsonb_build_object('success', false, 'error', 'coupon_expired', 'message', 'Mã giảm giá đã hết hạn sử dụng.');
    end if;

    if v_coupon_record.minimum_order_amount > 0 and v_original_total < v_coupon_record.minimum_order_amount then
      return jsonb_build_object('success', false, 'error', 'coupon_min_amount_not_met', 'message', 'Đơn hàng chưa đạt giá trị tối thiểu.');
    end if;

    if v_coupon_record.usage_limit is not null and v_coupon_record.used_count >= v_coupon_record.usage_limit then
      return jsonb_build_object('success', false, 'error', 'coupon_usage_limit_reached', 'message', 'Mã giảm giá đã hết lượt sử dụng.');
    end if;

    -- Kiểm tra per_user_limit
    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return jsonb_build_object('success', false, 'error', 'coupon_user_limit_reached', 'message', 'Bạn đã sử dụng hết lượt cho mã giảm giá này.');
    end if;

    -- Kiểm tra first_order_only
    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('success', false, 'error', 'coupon_first_order_only', 'message', 'Mã giảm giá này chỉ áp dụng cho đơn hàng đầu tiên.');
      end if;
    end if;

    -- Tính discount
    if v_coupon_record.discount_type = 'percentage' then
      v_discount_amt := round((v_original_total * v_coupon_record.discount_value) / 100.0);
      if v_coupon_record.maximum_discount_amount is not null and v_coupon_record.maximum_discount_amount > 0 then
        if v_discount_amt > v_coupon_record.maximum_discount_amount then
          v_discount_amt := v_coupon_record.maximum_discount_amount;
        end if;
      end if;
    else
      v_discount_amt := v_coupon_record.discount_value;
    end if;

    if v_discount_amt > v_original_total then
      v_discount_amt := v_original_total;
    end if;

    v_final_total := v_original_total - v_discount_amt;
    if v_final_total < 0 then v_final_total := 0; end if;

    v_coupon_id := v_coupon_record.id;
    v_coupon_code_snapshot := v_coupon_record.code;
  end if;

  -- 3. Tạo đơn hàng với status 'pending_payment'
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

  -- 4. Ghi nhận snapshot coupon usage nếu có coupon
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

    -- Ghi audit log
    perform public.log_audit_event(
      'coupon_applied',
      'coupon',
      'Người dùng áp dụng mã giảm giá ' || v_coupon_code_snapshot || ' cho đơn hàng mới ' || p_payment_code,
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
    'original_price', v_original_total,
    'discount_amount', v_discount_amt,
    'final_price', v_final_total
  );
end;
$$;
