-- ============================================================================
-- BOW — Migration 0053: RESTORE FULL ORDER FLOW, RPCS, & IN-APP NOTIFICATIONS
-- ============================================================================

set search_path = public, auth, extensions;

-- ────────────────────────────────────────────────────────────
-- 1. CẬP NHẬT CHECK CONSTRAINT TRÊN PUBLIC.ORDERS
-- ────────────────────────────────────────────────────────────
alter table public.orders 
  drop constraint if exists orders_status_check;

alter table public.orders 
  add constraint orders_status_check check (
    status in (
      'pending',
      'pending_payment',
      'paid',
      'pending_delivery',
      'processing',
      'delivering',
      'completed',
      'cancelled',
      'refunded'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. DỌN SẠCH CÁC BẢN OVERLOAD CŨ CỦA BUY_WITH_WALLET & CREATE_ORDER_WITH_COUPON
-- ────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as func_signature
    from pg_proc
    where proname in ('buy_with_wallet', 'create_order_with_coupon')
      and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function if exists ' || r.func_signature || ' cascade;';
  end loop;
end$$;

-- ────────────────────────────────────────────────────────────
-- 3. TẠO LẠI HÀM BUY_WITH_WALLET DUY NHẤT VÀ CHUẨN XÁC
-- ────────────────────────────────────────────────────────────
create or replace function public.buy_with_wallet(
  p_user_id uuid,
  p_product_name text,
  p_plan_label text,
  p_price numeric,
  p_payment_code text,
  p_notes text default '',
  p_quantity int default 1,
  p_coupon_code text default null,
  p_plan_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_balance numeric;
  v_user_role text;
  v_resolved_product_id uuid;
  v_resolved_plan_id uuid;
  v_unit_retail_price numeric;
  v_unit_ctv_price numeric;
  v_unit_effective_price numeric;
  v_original_total numeric;
  v_coupon_record record;
  v_coupon_id uuid := null;
  v_coupon_code_snapshot text := null;
  v_coupon_discount numeric := 0;
  v_discount_amt numeric := 0;
  v_final_total numeric;
  v_user_used_count int;
  v_valid_orders_count int;
  v_order_id uuid;
  v_clean_code text;
begin
  -- 1. Kiểm tra xác thực (chỉ người dùng chính chủ hoặc admin)
  if auth.uid() is null or (auth.uid() <> p_user_id and not public.is_admin()) then
    return 'unauthorized';
  end if;

  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  -- 2. Lấy số dư và Role của người dùng
  select coalesce(balance, 0), coalesce(role, 'member')
  into v_balance, v_user_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return 'user_not_found';
  end if;

  -- 3. Resolve Product ID & Price
  select id into v_resolved_product_id
  from public.products
  where name = p_product_name or p_product_name ilike (name || ' (%)')
  order by (name = p_product_name) desc, created_at desc
  limit 1;

  if p_plan_id is not null then
    select id, price, price_ctv
    into v_resolved_plan_id, v_unit_retail_price, v_unit_ctv_price
    from public.product_plans
    where id = p_plan_id and (v_resolved_product_id is null or product_id = v_resolved_product_id);
  end if;

  if v_resolved_plan_id is null and v_resolved_product_id is not null then
    select id, price, price_ctv
    into v_resolved_plan_id, v_unit_retail_price, v_unit_ctv_price
    from public.product_plans
    where product_id = v_resolved_product_id and label = p_plan_label
    limit 1;
  end if;

  if v_unit_retail_price is null then
    v_unit_retail_price := p_price;
    v_unit_ctv_price := null;
  end if;

  -- 4. Xác định đơn giá theo Role
  if v_user_role = 'ctv' and v_unit_ctv_price is not null and v_unit_ctv_price > 0 then
    v_unit_effective_price := v_unit_ctv_price;
  else
    v_unit_effective_price := v_unit_retail_price;
  end if;

  v_original_total := v_unit_effective_price * p_quantity;

  -- 5. Áp dụng Coupon nếu có
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
  v_discount_amt := v_coupon_discount;
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

  -- 9. Tạo đơn hàng với trạng thái pending_delivery (Chờ bàn giao)
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
    'pending_delivery',
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
  end if;

  return 'success';
end;
$$;

grant execute on function public.buy_with_wallet(uuid, text, text, numeric, text, text, int, text, uuid) to authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- 4. TẠO LẠI HÀM CREATE_ORDER_WITH_COUPON DUY NHẤT
-- ────────────────────────────────────────────────────────────
create or replace function public.create_order_with_coupon(
  p_user_id uuid,
  p_product_name text,
  p_plan_label text,
  p_price numeric,
  p_payment_code text,
  p_notes text default '',
  p_quantity int default 1,
  p_coupon_code text default null,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_role text;
  v_resolved_product_id uuid;
  v_resolved_plan_id uuid;
  v_unit_retail_price numeric;
  v_unit_ctv_price numeric;
  v_unit_effective_price numeric;
  v_original_total numeric;
  v_coupon_record record;
  v_coupon_id uuid := null;
  v_coupon_code_snapshot text := null;
  v_coupon_discount numeric := 0;
  v_discount_amt numeric := 0;
  v_final_total numeric;
  v_user_used_count int;
  v_valid_orders_count int;
  v_order_id uuid;
  v_clean_code text;
begin
  -- 1. Kiểm tra xác thực
  if auth.uid() is null or (auth.uid() <> p_user_id and not public.is_admin()) then
    return jsonb_build_object('success', false, 'message', 'unauthorized');
  end if;

  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  -- 2. Lấy Role của người dùng
  select coalesce(role, 'member') into v_user_role
  from public.profiles
  where id = p_user_id;

  -- 3. Resolve Product ID & Plan Prices
  select id into v_resolved_product_id
  from public.products
  where name = p_product_name or p_product_name ilike (name || ' (%)')
  order by (name = p_product_name) desc, created_at desc
  limit 1;

  if p_plan_id is not null then
    select id, price, price_ctv
    into v_resolved_plan_id, v_unit_retail_price, v_unit_ctv_price
    from public.product_plans
    where id = p_plan_id and (v_resolved_product_id is null or product_id = v_resolved_product_id);
  end if;

  if v_resolved_plan_id is null and v_resolved_product_id is not null then
    select id, price, price_ctv
    into v_resolved_plan_id, v_unit_retail_price, v_unit_ctv_price
    from public.product_plans
    where product_id = v_resolved_product_id and label = p_plan_label
    limit 1;
  end if;

  if v_unit_retail_price is null then
    v_unit_retail_price := p_price;
    v_unit_ctv_price := null;
  end if;

  -- 4. Xác định đơn giá theo Role
  if v_user_role = 'ctv' and v_unit_ctv_price is not null and v_unit_ctv_price > 0 then
    v_unit_effective_price := v_unit_ctv_price;
  else
    v_unit_effective_price := v_unit_retail_price;
  end if;

  v_original_total := v_unit_effective_price * p_quantity;

  -- 5. Áp dụng Coupon nếu có
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    v_clean_code := upper(trim(p_coupon_code));

    select * into v_coupon_record
    from public.coupons
    where upper(code) = v_clean_code
    for update;

    if not found or not v_coupon_record.is_active then
      return jsonb_build_object('success', false, 'message', 'invalid_coupon');
    end if;

    if v_coupon_record.start_at is not null and now() < v_coupon_record.start_at then
      return jsonb_build_object('success', false, 'message', 'coupon_not_started');
    end if;

    if v_coupon_record.expires_at is not null and now() > v_coupon_record.expires_at then
      return jsonb_build_object('success', false, 'message', 'coupon_expired');
    end if;

    -- Kiểm tra Product Scope
    if not coalesce(v_coupon_record.applies_to_all_products, true) then
      if v_resolved_product_id is null or not exists (
        select 1 from public.coupon_products
        where coupon_id = v_coupon_record.id
          and product_id = v_resolved_product_id
      ) then
        return jsonb_build_object('success', false, 'message', 'coupon_product_not_applicable');
      end if;
    end if;

    if v_coupon_record.minimum_order_amount > 0 and v_original_total < v_coupon_record.minimum_order_amount then
      return jsonb_build_object('success', false, 'message', 'coupon_min_amount_not_met');
    end if;

    if v_coupon_record.usage_limit is not null and v_coupon_record.used_count >= v_coupon_record.usage_limit then
      return jsonb_build_object('success', false, 'message', 'coupon_usage_limit_reached');
    end if;

    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return jsonb_build_object('success', false, 'message', 'coupon_user_limit_reached');
    end if;

    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('success', false, 'message', 'coupon_first_order_only');
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
  v_discount_amt := v_coupon_discount;
  v_final_total := v_original_total - v_discount_amt;
  if v_final_total < 0 then
    v_final_total := 0;
  end if;

  -- 7. Tạo đơn hàng với trạng thái pending_payment (Chờ thanh toán)
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
    'pending_payment',
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
end;
$$;

grant execute on function public.create_order_with_coupon(uuid, text, text, numeric, text, text, int, text, uuid) to authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- 5. CẬP NHẬT TRIGGER THÔNG BÁO TG_NOTIFY_ORDER
-- ────────────────────────────────────────────────────────────
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

  if new.user_id is not null then
    if not exists (
      select 1 from public.notifications
      where order_id = new.id and type = v_event and is_admin = false
    ) then
      insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, created_at)
      values (v_event, v_user_title, v_user_msg, new.id, new.user_id, false, false, now());
    end if;
  end if;

  if not exists (
    select 1 from public.notifications
    where order_id = new.id and type = v_event and is_admin = true
  ) then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, created_at)
    values (v_event, v_adm_title, v_adm_msg, new.id, null, true, false, now());
  end if;

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

drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.tg_notify_order();

drop trigger if exists orders_notify_update on public.orders;
create trigger orders_notify_update
  after update on public.orders
  for each row execute function public.tg_notify_order();

-- ────────────────────────────────────────────────────────────
-- 6. ĐẢM BẢO PUBLICATION SUPABASE_REALTIME & REPLICA IDENTITY FULL
-- ────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.order_status_history;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.product_reviews;
  exception when others then null;
  end;
end$$;

alter table public.orders replica identity full;
alter table public.notifications replica identity full;
alter table public.profiles replica identity full;
alter table public.order_status_history replica identity full;
alter table public.support_tickets replica identity full;
alter table public.support_messages replica identity full;
alter table public.product_reviews replica identity full;

