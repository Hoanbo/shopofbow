-- ============================================================
-- Migration 0032: Hệ thống Mã giảm giá (Coupon System)
-- ============================================================

set search_path = public, auth;

-- 1. Bảng coupons (Mã giảm giá)
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  discount_value numeric not null check (discount_value > 0),
  minimum_order_amount numeric not null default 0 check (minimum_order_amount >= 0),
  maximum_discount_amount numeric default null check (maximum_discount_amount is null or maximum_discount_amount >= 0),
  usage_limit integer default null check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  per_user_limit integer not null default 1 check (per_user_limit >= 1),
  first_order_only boolean not null default false,
  start_at timestamptz not null default now(),
  expires_at timestamptz default null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes cho coupons
create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_is_active on public.coupons(is_active);
create index if not exists idx_coupons_start_expires on public.coupons(start_at, expires_at);

-- 2. Bảng coupon_usages (Lịch sử sử dụng mã giảm giá)
create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  original_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  final_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes cho coupon_usages
create index if not exists idx_coupon_usages_coupon_id on public.coupon_usages(coupon_id);
create index if not exists idx_coupon_usages_user_id on public.coupon_usages(user_id);
create index if not exists idx_coupon_usages_order_id on public.coupon_usages(order_id);
create unique index if not exists idx_coupon_usages_order_unique on public.coupon_usages(coupon_id, order_id) where order_id is not null;

-- 3. Bổ sung snapshot columns vào bảng orders
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists original_price numeric(12,0),
  add column if not exists discount_amount numeric(12,0) default 0;

-- 4. Seed mã giảm giá khai trương WELCOME20
insert into public.coupons (
  code,
  name,
  description,
  discount_type,
  discount_value,
  minimum_order_amount,
  per_user_limit,
  first_order_only,
  is_active
)
values (
  'WELCOME20',
  'Khuyến mãi khai trương',
  'Giảm ngay 20.000đ cho đơn hàng đầu tiên của khách hàng mới',
  'fixed_amount',
  20000,
  0,
  1,
  true,
  true
)
on conflict (code) do nothing;

-- 5. RLS Policies
alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;

-- Coupons: Mọi người có thể đọc mã active để kiểm tra hoặc xem gợi ý
drop policy if exists "anyone read active coupons" on public.coupons;
create policy "anyone read active coupons"
  on public.coupons
  for select
  using (is_active = true or public.is_admin());

-- Coupons: Chỉ Admin được thêm, sửa, xóa
drop policy if exists "admin full access coupons" on public.coupons;
create policy "admin full access coupons"
  on public.coupons
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Coupon Usages: User đọc lịch sử dùng coupon của mình, Admin đọc tất cả
drop policy if exists "user read own coupon usages" on public.coupon_usages;
create policy "user read own coupon usages"
  on public.coupon_usages
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Coupon Usages: Insert qua RPC hoặc Service Role / Auth
drop policy if exists "auth user insert coupon usages" on public.coupon_usages;
create policy "auth user insert coupon usages"
  on public.coupon_usages
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- 6. RPC: validate_coupon
-- Hàm kiểm tra tính hợp lệ của mã giảm giá và tính toán số tiền discount an toàn
create or replace function public.validate_coupon(
  p_code text,
  p_order_amount numeric,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_coupon record;
  v_user_used_count integer := 0;
  v_valid_orders_count integer := 0;
  v_discount_amount numeric := 0;
  v_final_amount numeric := 0;
  v_clean_code text := upper(trim(p_code));
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

  -- 5. Kiểm tra giá trị đơn tối thiểu
  if v_coupon.minimum_order_amount > 0 and p_order_amount < v_coupon.minimum_order_amount then
    return jsonb_build_object(
      'valid', false,
      'message', 'Đơn hàng chưa đạt giá trị tối thiểu ' || to_char(v_coupon.minimum_order_amount, 'FM999,999,999') || 'đ để sử dụng mã này.'
    );
  end if;

  -- 6. Kiểm tra giới hạn tổng lượt dùng
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá đã hết lượt sử dụng.');
  end if;

  -- 7. Nếu có user_id, kiểm tra per_user_limit và first_order_only
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

  -- 8. Tính toán số tiền giảm
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
    'final_amount', v_final_amount
  );
end;
$$;

-- 7. Drop cũ và nâng cấp RPC buy_with_wallet hỗ trợ Coupon an toàn tuyệt đối
drop function if exists public.buy_with_wallet(
  uuid, text, text, numeric, text, text, uuid, uuid, integer
);
drop function if exists public.buy_with_wallet(
  uuid, text, text, numeric, text, text, uuid, uuid, integer, text
);

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

  -- 5. Tạo đơn hàng với đầy đủ snapshot coupon
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
      'order',
      'User áp dụng mã giảm giá ' || v_coupon_record.code || ' (giảm ' || to_char(v_discount_amt, 'FM999,999,999') || 'đ) cho đơn hàng #' || p_payment_code,
      p_user_id,
      'Khách hàng',
      'user',
      v_order_id::text,
      jsonb_build_object(
        'coupon_code', v_coupon_record.code,
        'discount_amount', v_discount_amt,
        'original_price', v_original_total,
        'final_price', v_final_total
      )
    );
  end if;

  return 'success';
end$$;

-- 8. RPC: create_order_with_coupon (Dành cho VietQR / thanh toán ngoài)
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

  -- 4. Ghi nhận snapshot coupon usage
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
      v_coupon_record.id,
      p_user_id,
      v_order_id,
      v_original_total,
      v_discount_amt,
      v_final_total
    );

    -- Ghi audit log
    perform public.log_audit_event(
      'coupon_applied',
      'order',
      'User áp dụng mã giảm giá ' || v_coupon_record.code || ' (giảm ' || to_char(v_discount_amt, 'FM999,999,999') || 'đ) khi tạo đơn hàng #' || p_payment_code,
      p_user_id,
      'Khách hàng',
      'user',
      v_order_id::text,
      jsonb_build_object(
        'coupon_code', v_coupon_record.code,
        'discount_amount', v_discount_amt,
        'original_price', v_original_total,
        'final_price', v_final_total
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'final_price', v_final_total,
    'original_price', v_original_total,
    'discount_amount', v_discount_amt
  );
end;
$$;
