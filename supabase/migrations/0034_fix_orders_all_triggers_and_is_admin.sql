-- ============================================================
-- BOW — Migration 0034: SỬA TRIỆT ĐỂ LỖI ORDERS VÀ KHÔI PHỤC TOÀN BỘ HOẠT ĐỘNG
-- Sửa lỗi: "column p.is_admin_user does not exist" trên bảng orders
-- Sửa lỗi: unassigned record khi checkout không kèm mã giảm giá
-- ============================================================

set search_path = public, auth, extensions;

-- ── 1. HÀM PUBLIC.IS_ADMIN() CHUẨN XÁC, AN TOÀN TUYỆT ĐỐI ──
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    exists (
      select 1 from auth.users
      where id = auth.uid()
      and lower(email) = 'hoankb4@gmail.com'
    )
    or exists (
      select 1 from public.admins
      where user_id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- ── 2. KHÔI PHỤC TOÀN BỘ RLS POLICIES TRÊN BẢNG ORDERS ──
alter table public.orders enable row level security;

drop policy if exists "admin manage all orders" on public.orders;
drop policy if exists "admin all orders" on public.orders;
drop policy if exists "admin read all orders" on public.orders;
drop policy if exists "admin write all orders" on public.orders;
drop policy if exists "admin delete all orders" on public.orders;
drop policy if exists "user read own orders" on public.orders;
drop policy if exists "user insert own orders" on public.orders;
drop policy if exists "users insert own orders" on public.orders;
drop policy if exists "users read own orders" on public.orders;
drop policy if exists "anyone insert orders" on public.orders;

-- Policy đọc đơn: User đọc đơn của chính mình, Admin đọc toàn bộ
create policy "users read own orders"
  on public.orders
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Policy tạo đơn: User tạo đơn cho chính mình, Admin tạo đơn
create policy "users insert own orders"
  on public.orders
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- Policy cập nhật / xóa đơn: Chỉ Admin mới được toàn quyền quản trị
create policy "admin manage all orders"
  on public.orders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 3. DỌN SẠCH TẤT CẢ TRIGGER LỖI TRÊN BẢNG ORDERS ──
do $$
declare
  trg record;
begin
  for trg in
    select trigger_name
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'orders'
  loop
    execute format('drop trigger if exists %I on public.orders;', trg.trigger_name);
  end loop;
end$$;

-- ── 4. TẠO LẠI TRIGGER THÔNG BÁO ĐƠN HÀNG CHUẨN (TG_NOTIFY_ORDER) ──
create or replace function public.tg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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
  -- Bỏ qua đơn nạp ví để tránh trùng
  v_is_topup := (new.product_name = 'Nạp tiền vào ví')
                or (upper(coalesce(new.payment_code, '')) like 'BOWN%');
  if v_is_topup then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'pending_payment' then
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
    if new.status = 'pending_delivery' and old.status is distinct from 'pending_delivery' then
      v_event      := 'order_paid';
      v_user_title := 'Xác nhận thanh toán thành công';
      v_user_msg   := 'Đơn hàng #' || new.payment_code || ' — ' || new.product_name || ' đã nhận thanh toán thành công và đang chờ bàn giao.';
      v_adm_title  := 'Đã nhận thanh toán đơn hàng';
      v_adm_msg    := 'Đơn #' || new.payment_code || ' — ' || new.product_name || ' · ' || v_price || ' đã nhận tiền từ ngân hàng.';

    elsif new.status = 'processing' and old.status is distinct from 'processing' then
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

  -- Ghi notification cho user
  if new.user_id is not null then
    if not exists (
      select 1 from public.notifications
      where order_id = new.id and type = v_event and is_admin = false
    ) then
      insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
      values (v_event, v_user_title, v_user_msg, new.id, new.user_id, false, false);
    end if;
  end if;

  -- Ghi notification cho admin
  if not exists (
    select 1 from public.notifications
    where order_id = new.id and type = v_event and is_admin = true
  ) then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
    values (v_event, v_adm_title, v_adm_msg, new.id, null, true, false);
  end if;

  -- Gọi Telegram webhook (nếu có cấu hình Vault)
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
end$$;

create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.tg_notify_order();

create trigger orders_notify_update
  after update on public.orders
  for each row execute function public.tg_notify_order();

-- ── 5. TẠO LẠI TRIGGER AUDIT LOG CHO ORDERS ──
create or replace function public.tg_audit_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_name text := 'Khách hàng';
  v_actor_role text := 'user';
begin
  if auth.uid() is not null then
    select coalesce(full_name, email, 'Thành viên') into v_actor_name
    from public.profiles where id = auth.uid();
    if public.is_admin() then
      v_actor_role := 'admin';
    end if;
  else
    v_actor_name := 'Hệ thống Webhook';
    v_actor_role := 'system';
  end if;

  if tg_op = 'INSERT' then
    perform public.log_audit_event(
      'create_order',
      'order',
      'Đã khởi tạo đơn hàng mới #' || coalesce(new.payment_code, new.id::text) || ' (' || coalesce(new.product_name, 'Sản phẩm') || ')',
      auth.uid(),
      v_actor_name,
      v_actor_role,
      coalesce(new.payment_code, new.id::text),
      jsonb_build_object('order_id', new.id, 'price', new.price, 'status', new.status, 'product_name', new.product_name)
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform public.log_audit_event(
      'order_status_' || new.status,
      'order',
      'Cập nhật trạng thái đơn #' || coalesce(new.payment_code, new.id::text) || ' từ "' || old.status || '" ➔ "' || new.status || '"',
      auth.uid(),
      v_actor_name,
      v_actor_role,
      coalesce(new.payment_code, new.id::text),
      jsonb_build_object('order_id', new.id, 'old_status', old.status, 'new_status', new.status, 'price', new.price)
    );
  end if;

  return new;
end;
$$;

create trigger trg_audit_order_changes
  after insert or update on public.orders
  for each row execute function public.tg_audit_order_changes();

-- ── 6. TẠO LẠI TRIGGER TIMELINE (ORDER_STATUS_HISTORY) ──
create or replace function public.trg_record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_name text := 'Hệ thống';
  v_actor_role text := 'system';
begin
  if (TG_OP = 'INSERT') or (OLD.status is distinct from NEW.status) then
    if auth.uid() is not null then
      select coalesce(full_name, email, 'Thành viên') into v_actor_name
      from public.profiles where id = auth.uid();

      if public.is_admin() then
        v_actor_role := 'admin';
      else
        v_actor_role := 'user';
      end if;
    end if;

    insert into public.order_status_history (
      order_id, status, changed_by, actor_name, created_at
    )
    values (
      NEW.id, NEW.status, v_actor_role, v_actor_name, coalesce(NEW.updated_at, now())
    );
  end if;
  return NEW;
end;
$$;

create trigger on_order_status_change_history
  after insert or update of status on public.orders
  for each row execute function public.trg_record_order_status_history();

-- ── 7. CẬP NHẬT BUY_WITH_WALLET & CREATE_ORDER_WITH_COUPON (DỌN SẠCH OVERLOAD CŨ) ──
-- Dọn sạch tất cả các overload 6-tham-số, 8-tham-số, 9-tham-số cũ để tránh lỗi PGRST203
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

  -- 4. Trừ tiền ví (Bật cờ app.allow_balance_update cho trigger bảo vệ số dư)
  perform set_config('app.allow_balance_update', 'true', true);

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

    select count(*) into v_user_used_count
    from public.coupon_usages
    where coupon_id = v_coupon_record.id and user_id = p_user_id;

    if v_coupon_record.per_user_limit is not null and v_user_used_count >= v_coupon_record.per_user_limit then
      return jsonb_build_object('success', false, 'error', 'coupon_user_limit_reached', 'message', 'Bạn đã sử dụng hết lượt cho mã giảm giá này.');
    end if;

    if v_coupon_record.first_order_only then
      select count(*) into v_valid_orders_count
      from public.orders
      where user_id = p_user_id
        and status in ('paid', 'pending_delivery', 'processing', 'delivering', 'completed');

      if v_valid_orders_count > 0 then
        return jsonb_build_object('success', false, 'error', 'coupon_first_order_only', 'message', 'Mã giảm giá này chỉ áp dụng cho đơn hàng đầu tiên.');
      end if;
    end if;

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

-- ── 8. CẬP NHẬT CANCEL_AND_REFUND_OWN_ORDER AN TOÀN ──
create or replace function public.cancel_and_refund_own_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.orders%rowtype;
begin
  -- 1. Yêu cầu người dùng đã đăng nhập
  if auth.uid() is null then
    return 'unauthorized';
  end if;

  -- 2. Đọc đơn hàng của chính user đó & khóa dòng chống race condition
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    return 'order_not_found';
  end if;

  -- Đơn đã hủy hoặc đã hoàn thành -> không thể hủy
  if v_order.status in ('cancelled', 'completed', 'refunded') then
    return 'cannot_cancel';
  end if;

  -- 3. Đơn chưa thanh toán: Chỉ đổi trạng thái hủy
  if v_order.status = 'pending_payment' then
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'success';
  end if;

  -- 4. Đơn đã thanh toán (pending_delivery hoặc processing): Hủy & Hoàn tiền ví tự động
  if v_order.status in ('pending_delivery', 'processing') then
    -- Bật cờ cho phép cập nhật số dư từ RPC nội bộ
    perform set_config('app.allow_balance_update', 'true', true);

    -- Hoàn tiền về ví khách hàng
    update public.profiles
    set balance = balance + v_order.price,
        updated_at = now()
    where id = auth.uid();

    -- Cập nhật đơn thành đã hủy (Trigger tg_notify_order sẽ tự động gửi thông báo)
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    return 'refunded_success';
  end if;

  return 'cannot_cancel';
end;
$$;

grant execute on function public.cancel_and_refund_own_order(uuid) to authenticated;
