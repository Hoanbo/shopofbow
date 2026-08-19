-- ============================================================================
-- BOW — Migration 0046: HỖ TRỢ PHẠM VI ÁP DỤNG MÃ GIẢM GIÁ THEO SẢN PHẨM (COUPON PRODUCT SCOPE)
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Bổ sung cột applies_to_all_products vào bảng coupons
alter table public.coupons
  add column if not exists applies_to_all_products boolean not null default true;

-- Đảm bảo tất cả coupon cũ giữ nguyên trạng thái áp dụng toàn shop
update public.coupons
set applies_to_all_products = true
where applies_to_all_products is null;

-- 2. Tạo bảng quan hệ coupon_products (Many-to-Many giữa coupons và products)
create table if not exists public.coupon_products (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_coupon_products_coupon_product unique(coupon_id, product_id)
);

-- Indexes tối ưu tốc độ kiểm tra coupon
create index if not exists idx_coupon_products_coupon_id on public.coupon_products(coupon_id);
create index if not exists idx_coupon_products_product_id on public.coupon_products(product_id);

-- 3. Cấu hình Row Level Security (RLS) cho coupon_products
alter table public.coupon_products enable row level security;

drop policy if exists "anyone read coupon_products" on public.coupon_products;
create policy "anyone read coupon_products"
  on public.coupon_products
  for select
  using (true);

drop policy if exists "admin manage coupon_products" on public.coupon_products;
create policy "admin manage coupon_products"
  on public.coupon_products
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Nâng cấp RPC validate_coupon hỗ trợ kiểm tra Product Scope
create or replace function public.validate_coupon(
  p_code         text,
  p_order_amount numeric,
  p_user_id      uuid default null,
  p_product_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id            uuid := coalesce(p_user_id, auth.uid());
  v_coupon             record;
  v_user_used_count    integer := 0;
  v_valid_orders_count integer := 0;
  v_discount_amount    numeric := 0;
  v_final_amount       numeric := 0;
  v_clean_code         text := upper(trim(p_code));
  v_product_name       text;
  v_resolved_product_id uuid := p_product_id;
begin
  if v_clean_code is null or v_clean_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Vui lòng nhập mã giảm giá.');
  end if;

  if p_order_amount is null or p_order_amount <= 0 then
    return jsonb_build_object('valid', false, 'message', 'Giá trị đơn hàng không hợp lệ.');
  end if;

  -- 1. Tìm coupon
  select * into v_coupon
  from public.coupons
  where upper(code) = v_clean_code;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá không tồn tại.');
  end if;

  -- 2. Kiểm tra is_active
  if not v_coupon.is_active then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá hiện đang tạm ngưng hoạt động.');
  end if;

  -- 3. Kiểm tra ngày bắt đầu
  if v_coupon.start_at is not null and now() < v_coupon.start_at then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá chưa đến thời gian áp dụng.');
  end if;

  -- 4. Kiểm tra ngày hết hạn
  if v_coupon.expires_at is not null and now() > v_coupon.expires_at then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá đã hết hạn sử dụng.');
  end if;

  -- 5. Kiểm tra phạm vi áp dụng theo sản phẩm (Product Scope)
  if not coalesce(v_coupon.applies_to_all_products, true) then
    if v_resolved_product_id is null then
      return jsonb_build_object(
        'valid', false,
        'message', 'Mã giảm giá này chỉ áp dụng cho một số sản phẩm nhất định.'
      );
    end if;

    if not exists (
      select 1 from public.coupon_products
      where coupon_id = v_coupon.id
        and product_id = v_resolved_product_id
    ) then
      return jsonb_build_object(
        'valid', false,
        'message', 'Mã giảm giá này không áp dụng cho sản phẩm đã chọn.'
      );
    end if;
  end if;

  -- 6. Kiểm tra giá trị đơn tối thiểu
  if v_coupon.minimum_order_amount > 0 and p_order_amount < v_coupon.minimum_order_amount then
    return jsonb_build_object(
      'valid', false,
      'message', 'Đơn hàng chưa đạt giá trị tối thiểu ' || to_char(v_coupon.minimum_order_amount, 'FM999,999,999') || 'đ để sử dụng mã này.'
    );
  end if;

  -- 7. Kiểm tra giới hạn tổng lượt dùng
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá đã hết lượt sử dụng.');
  end if;

  -- 8. Nếu có user_id, kiểm tra per_user_limit và first_order_only
  if v_user_id is not null then
    -- Số lần user này đã dùng mã này
    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon.id and user_id = v_user_id;

    if v_coupon.per_user_limit is not null and v_user_used_count >= v_coupon.per_user_limit then
      return jsonb_build_object('valid', false, 'message', 'Bạn đã sử dụng hết lượt cho mã giảm giá này.');
    end if;

    -- Kiểm tra first_order_only
    if v_coupon.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = v_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('valid', false, 'message', 'Mã giảm giá này chỉ áp dụng cho đơn hàng đầu tiên của bạn.');
      end if;
    end if;
  end if;

  -- 9. Tính toán số tiền giảm
  if v_coupon.discount_type = 'percentage' then
    v_discount_amount := round((p_order_amount * v_coupon.discount_value) / 100.0);
    if v_coupon.maximum_discount_amount is not null and v_coupon.maximum_discount_amount > 0 then
      if v_discount_amount > v_coupon.maximum_discount_amount then
        v_discount_amount := v_coupon.maximum_discount_amount;
      end if;
    end if;
  else -- fixed_amount
    v_discount_amount := v_coupon.discount_value;
  end if;

  -- Đảm bảo không giảm quá tổng tiền
  if v_discount_amount > p_order_amount then
    v_discount_amount := p_order_amount;
  end if;

  v_final_amount := p_order_amount - v_discount_amount;
  if v_final_amount < 0 then
    v_final_amount := 0;
  end if;

  return jsonb_build_object(
    'valid', true,
    'message', 'Áp dụng mã giảm giá thành công!',
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'name', v_coupon.name,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount_amount,
    'original_amount', p_order_amount,
    'final_amount', v_final_amount,
    'applies_to_all_products', coalesce(v_coupon.applies_to_all_products, true)
  );
end;
$$;

-- 5. Nâng cấp RPC buy_with_wallet hỗ trợ kiểm tra Product Scope
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
  v_resolved_product_id  uuid := p_product_id;
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

  -- 2. Tự động resolve product_id nếu chưa được truyền
  if v_resolved_product_id is null and p_plan_id is not null then
    select product_id into v_resolved_product_id from public.product_plans where id = p_plan_id;
  end if;
  if v_resolved_product_id is null and p_product_name is not null then
    select id into v_resolved_product_id from public.products where name = p_product_name or p_product_name like name || '%' limit 1;
  end if;

  -- 3. Xác thực đơn giá từ Database
  if p_plan_id is not null then
    if v_user_role = 'ctv' then
      select coalesce(price_ctv, price) into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    else
      select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    end if;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if v_resolved_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, price) into v_unit_price from public.product_plans where product_id = v_resolved_product_id and name = p_plan_label and is_active = true limit 1;
      else
        select price into v_unit_price from public.product_plans where product_id = v_resolved_product_id and name = p_plan_label and is_active = true limit 1;
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
    if v_resolved_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where id = v_resolved_product_id and is_active = true;
      else
        select base_price into v_unit_price from public.products where id = v_resolved_product_id and is_active = true;
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

  -- 4. Tính ưu đãi chào mừng đơn đầu (Universal Welcome Discount)
  if v_user_role <> 'ctv' then
    select count(*) into v_valid_orders_count
    from public.orders
    where user_id = p_user_id
      and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

    if v_valid_orders_count = 0 then
      if v_resolved_product_id is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where id = v_resolved_product_id;
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

  -- 5. Nếu có coupon_code, kiểm tra điều kiện coupon & Product Scope
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

    -- Kiểm tra Product Scope
    if not coalesce(v_coupon_record.applies_to_all_products, true) then
      if v_resolved_product_id is null or not exists (
        select 1 from public.coupon_products
        where coupon_id = v_coupon_record.id
          and product_id = v_resolved_product_id
      ) then
        return 'coupon_product_not_applicable';
      end if;
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

  -- 6. Tính mức giảm giá cuối cùng
  v_discount_amt := greatest(v_coupon_discount, v_welcome_discount);
  v_final_total := v_original_total - v_discount_amt;
  if v_final_total < 0 then
    v_final_total := 0;
  end if;

  -- 7. Kiểm tra số dư ví
  if v_balance < v_final_total then
    return 'insufficient_balance';
  end if;

  -- 8. Trừ số dư ví
  update public.profiles
  set balance = balance - v_final_total,
      updated_at = now()
  where id = p_user_id;

  -- 9. Tạo đơn hàng với trạng thái paid
  insert into public.orders (
    user_id,
    product_id,
    plan_id,
    product_name,
    plan_label,
    price,
    original_price,
    discount_amount,
    coupon_id,
    coupon_code,
    payment_code,
    status,
    notes,
    quantity,
    is_ctv_order
  ) values (
    p_user_id,
    v_resolved_product_id,
    p_plan_id,
    p_product_name,
    p_plan_label,
    v_final_total,
    v_original_total,
    v_discount_amt,
    v_coupon_id,
    v_coupon_code_snapshot,
    p_payment_code,
    'paid',
    p_notes,
    p_quantity,
    (v_user_role = 'ctv')
  )
  returning id into v_order_id;

  -- 10. Ghi nhận lượt sử dụng coupon
  if v_coupon_id is not null then
    update public.coupons
    set used_count = used_count + 1,
        updated_at = now()
    where id = v_coupon_id;

    insert into public.coupon_usages (
      coupon_id,
      user_id,
      order_id,
      original_amount,
      discount_amount,
      final_amount
    ) values (
      v_coupon_id,
      p_user_id,
      v_order_id,
      v_original_total,
      v_coupon_discount,
      v_final_total
    );

    insert into public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      description,
      metadata
    ) values (
      p_user_id,
      'member',
      'use_coupon',
      'coupon',
      v_coupon_id,
      'Khách hàng sử dụng mã giảm giá ' || v_coupon_code_snapshot || ' cho đơn hàng ' || p_payment_code,
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

-- 6. Nâng cấp RPC create_order_with_coupon hỗ trợ kiểm tra Product Scope (VietQR)
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
  v_resolved_product_id  uuid := p_product_id;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'message', 'unauthorized');
  end if;

  -- 1. Lấy role của user
  select coalesce(role, 'member') into v_user_role
  from public.profiles where id = p_user_id;

  -- 2. Tự động resolve product_id nếu chưa được truyền
  if v_resolved_product_id is null and p_plan_id is not null then
    select product_id into v_resolved_product_id from public.product_plans where id = p_plan_id;
  end if;
  if v_resolved_product_id is null and p_product_name is not null then
    select id into v_resolved_product_id from public.products where name = p_product_name or p_product_name like name || '%' limit 1;
  end if;

  -- 3. Xác thực đơn giá từ Database
  if p_plan_id is not null then
    if v_user_role = 'ctv' then
      select coalesce(price_ctv, price) into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    else
      select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
    end if;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if v_resolved_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, price) into v_unit_price from public.product_plans where product_id = v_resolved_product_id and name = p_plan_label and is_active = true limit 1;
      else
        select price into v_unit_price from public.product_plans where product_id = v_resolved_product_id and name = p_plan_label and is_active = true limit 1;
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
    if v_resolved_product_id is not null then
      if v_user_role = 'ctv' then
        select coalesce(price_ctv, base_price) into v_unit_price from public.products where id = v_resolved_product_id and is_active = true;
      else
        select base_price into v_unit_price from public.products where id = v_resolved_product_id and is_active = true;
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

  -- 4. Tính ưu đãi chào mừng đơn đầu
  if v_user_role <> 'ctv' then
    select count(*) into v_valid_orders_count
    from public.orders
    where user_id = p_user_id
      and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

    if v_valid_orders_count = 0 then
      if v_resolved_product_id is not null then
        select affiliate_enabled, affiliate_type, affiliate_discount
        into v_aff_enabled, v_aff_type, v_aff_discount
        from public.products
        where id = v_resolved_product_id;
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

  -- 5. Nếu có coupon_code, kiểm tra điều kiện coupon & Product Scope
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));
    
    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update;

    if not found or not v_coupon_record.is_active then
      return jsonb_build_object('success', false, 'message', 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    end if;

    if v_coupon_record.start_at is not null and now() < v_coupon_record.start_at then
      return jsonb_build_object('success', false, 'message', 'Mã giảm giá chưa đến thời gian áp dụng.');
    end if;

    if v_coupon_record.expires_at is not null and now() > v_coupon_record.expires_at then
      return jsonb_build_object('success', false, 'message', 'Mã giảm giá đã hết hạn.');
    end if;

    -- Kiểm tra Product Scope
    if not coalesce(v_coupon_record.applies_to_all_products, true) then
      if v_resolved_product_id is null or not exists (
        select 1 from public.coupon_products
        where coupon_id = v_coupon_record.id
          and product_id = v_resolved_product_id
      ) then
        return jsonb_build_object('success', false, 'message', 'Mã giảm giá này không áp dụng cho sản phẩm đã chọn.');
      end if;
    end if;

    if v_coupon_record.minimum_order_amount > 0 and v_original_total < v_coupon_record.minimum_order_amount then
      return jsonb_build_object('success', false, 'message', 'Đơn hàng chưa đạt giá trị tối thiểu ' || to_char(v_coupon_record.minimum_order_amount, 'FM999,999,999') || 'đ.');
    end if;

    if v_coupon_record.usage_limit is not null and v_coupon_record.used_count >= v_coupon_record.usage_limit then
      return jsonb_build_object('success', false, 'message', 'Mã giảm giá đã hết lượt sử dụng.');
    end if;

    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return jsonb_build_object('success', false, 'message', 'Bạn đã sử dụng hết lượt cho mã giảm giá này.');
    end if;

    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('success', false, 'message', 'Mã giảm giá này chỉ áp dụng cho đơn hàng đầu tiên.');
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

  -- 6. Tính mức giảm giá cuối cùng
  v_discount_amt := greatest(v_coupon_discount, v_welcome_discount);
  v_final_total := v_original_total - v_discount_amt;
  if v_final_total < 0 then
    v_final_total := 0;
  end if;

  -- 7. Tạo đơn hàng với trạng thái pending
  insert into public.orders (
    user_id,
    product_id,
    plan_id,
    product_name,
    plan_label,
    price,
    original_price,
    discount_amount,
    coupon_id,
    coupon_code,
    payment_code,
    status,
    notes,
    quantity,
    is_ctv_order
  ) values (
    p_user_id,
    v_resolved_product_id,
    p_plan_id,
    p_product_name,
    p_plan_label,
    v_final_total,
    v_original_total,
    v_discount_amt,
    v_coupon_id,
    v_coupon_code_snapshot,
    p_payment_code,
    'pending',
    p_notes,
    p_quantity,
    (v_user_role = 'ctv')
  )
  returning id into v_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'original_price', v_original_total,
    'discount_amount', v_discount_amt,
    'final_price', v_final_total,
    'coupon_code', v_coupon_code_snapshot
  );
end$$;
