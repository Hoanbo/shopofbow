-- ============================================================================
-- BOW — Migration 0047: HỆ THỐNG TỰ ĐỘNG NHẮC HẠN ĐƠN HÀNG ĐỘC LẬP (7 / 3 / 1 NGÀY & HẾT HẠN)
-- VÀ TỰ ĐỘNG DỪNG (STOP) CÁC MỐC TƯƠNG LAI KHI KHÁCH ĐÃ GIA HẠN / HỦY / HOÀN TIỀN
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Hàm tính toán ngày hết hạn chuẩn xác dựa trên thời hạn gói (immutable helper)
create or replace function public.calculate_order_expires_at(
  p_created_at   timestamptz,
  p_product_name text,
  p_plan_label   text,
  p_notes        text,
  p_price        numeric
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_plan_str      text := lower(coalesce(p_product_name, '') || ' ' || coalesce(p_plan_label, '') || ' ' || coalesce(p_notes, ''));
  v_duration_days integer := 30;
  v_match         text[];
begin
  -- 1. Gói vĩnh viễn / trọn đời -> Không có ngày hết hạn
  if v_plan_str like '%vĩnh viễn%' or v_plan_str like '%lifetime%' or v_plan_str like '%trọn đời%' then
    return null;
  end if;

  -- 2. Khớp thời hạn cố định phổ biến
  if v_plan_str like '%1 ngày%' or v_plan_str like '%24h%' or v_plan_str like '%1 day%' or v_plan_str like '%api 10m%' or v_plan_str like '%api 50m%' or v_plan_str like '%api 100m%' then
    v_duration_days := 1;
  elsif v_plan_str like '%2 ngày%' or v_plan_str like '%48h%' then
    v_duration_days := 2;
  elsif v_plan_str like '%3 ngày%' then
    v_duration_days := 3;
  elsif v_plan_str like '%7 ngày%' or v_plan_str like '%1 tuần%' or v_plan_str like '%1 week%' or v_plan_str like '%7 days%' or v_plan_str like '%7d%' or (coalesce(p_price, 0) <= 20000 and v_plan_str like '%capcut%') then
    v_duration_days := 7;
  elsif v_plan_str like '%14 ngày%' or v_plan_str like '%2 tuần%' or v_plan_str like '%2 weeks%' or v_plan_str like '%14 days%' then
    v_duration_days := 14;
  elsif v_plan_str like '%15 ngày%' then
    v_duration_days := 15;
  elsif v_plan_str like '%1 tháng%' or v_plan_str like '%30 ngày%' or v_plan_str like '%1 month%' then
    v_duration_days := 30;
  elsif v_plan_str like '%2 tháng%' or v_plan_str like '%60 ngày%' then
    v_duration_days := 60;
  elsif v_plan_str like '%3 tháng%' or v_plan_str like '%90 ngày%' or v_plan_str like '%3 months%' then
    v_duration_days := 90;
  elsif v_plan_str like '%6 tháng%' or v_plan_str like '%180 ngày%' or v_plan_str like '%6 months%' then
    v_duration_days := 180;
  elsif v_plan_str like '%1 năm%' or v_plan_str like '%12 tháng%' or v_plan_str like '%1 year%' or v_plan_str like '%365 ngày%' then
    v_duration_days := 365;
  else
    -- Regex fallback: X tuần
    v_match := regexp_matches(v_plan_str, '(\d+)\s*(tuần|week|weeks|w)', 'i');
    if v_match is not null and array_length(v_match, 1) >= 1 then
      v_duration_days := v_match[1]::integer * 7;
    else
      -- Regex fallback: X tháng
      v_match := regexp_matches(v_plan_str, '(\d+)\s*(tháng|month|months|m)', 'i');
      if v_match is not null and array_length(v_match, 1) >= 1 then
        v_duration_days := v_match[1]::integer * 30;
      else
        -- Regex fallback: X năm
        v_match := regexp_matches(v_plan_str, '(\d+)\s*(năm|year|years|y)', 'i');
        if v_match is not null and array_length(v_match, 1) >= 1 then
          v_duration_days := v_match[1]::integer * 365;
        else
          -- Regex fallback: X ngày
          v_match := regexp_matches(v_plan_str, '(\d+)\s*(ngày|day|days)', 'i');
          if v_match is not null and array_length(v_match, 1) >= 1 then
            v_duration_days := v_match[1]::integer;
          end if;
        end if;
      end if;
    end if;
  end if;

  return p_created_at + (v_duration_days || ' days')::interval;
end;
$$;

-- 2. Tự động đồng bộ expires_at cho các đơn hàng hoàn tất chưa có expires_at
update public.orders
set expires_at = public.calculate_order_expires_at(created_at, product_name, plan_label, notes, price)
where expires_at is null and status = 'completed';

-- 3. Tạo bảng order_expiry_notifications để quản lý 4 mốc nhắc hạn HOÀN TOÀN ĐỘC LẬP
create table if not exists public.order_expiry_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (notification_type in (
    'expiry_7_days',
    'expiry_3_days',
    'expiry_1_day',
    'expiry_expired',
    'manual_reminder'
  )),
  days_left numeric(5,1),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_order_expiry_type unique (order_id, notification_type)
);

-- Chỉ mục tối ưu tốc độ tra cứu và ngăn race condition
create index if not exists idx_order_expiry_notif_order on public.order_expiry_notifications(order_id);
create index if not exists idx_order_expiry_notif_user on public.order_expiry_notifications(user_id);
create index if not exists idx_order_expiry_notif_type on public.order_expiry_notifications(notification_type);

-- 4. RLS cho bảng order_expiry_notifications
alter table public.order_expiry_notifications enable row level security;

drop policy if exists "user view own expiry notifications" on public.order_expiry_notifications;
create policy "user view own expiry notifications"
  on public.order_expiry_notifications
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin manage expiry notifications" on public.order_expiry_notifications;
create policy "admin manage expiry notifications"
  on public.order_expiry_notifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Trigger tự động gán expires_at khi đơn hàng hoàn tất bàn giao (completed)
create or replace function public.tg_set_order_expires_at()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'completed' and new.expires_at is null then
    new.expires_at := public.calculate_order_expires_at(
      coalesce(new.created_at, now()),
      new.product_name,
      new.plan_label,
      new.notes,
      new.price
    );
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_expires_at_trigger on public.orders;
create trigger set_order_expires_at_trigger
  before insert or update on public.orders
  for each row
  execute function public.tg_set_order_expires_at();

-- 6. RPC Quét và Gửi Thông Báo Tự Động Theo Từng Mốc Độc Lập
-- VÀ TỰ ĐỘNG DỪNG NHẮC HẠN NẾU ĐƠN HÀNG ĐÃ ĐƯỢC GIA HẠN / HỦY / HOÀN TIỀN
create or replace function public.check_and_notify_expiring_orders()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order                record;
  v_now                  timestamptz := now();
  v_now_vn               timestamp := (now() at time zone 'Asia/Ho_Chi_Minh');
  v_expires_vn           timestamp;
  v_days_left_exact      numeric;
  v_user_email           text;
  v_user_name            text;
  v_email_url            text;
  v_key                  text;
  v_title                text;
  v_msg                  text;
  v_notif_type           text;
  v_processed_7d         integer := 0;
  v_processed_3d         integer := 0;
  v_processed_1d         integer := 0;
  v_processed_exp        integer := 0;
  v_skipped_renewed      integer := 0;
  v_inserted_id          uuid;
begin
  -- Lấy secret email webhook từ vault nếu có
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

  -- Duyệt tất cả các đơn hàng hoàn tất
  for v_order in
    select 
      o.id,
      o.user_id,
      o.product_name,
      o.plan_label,
      o.payment_code,
      o.price,
      o.status,
      o.created_at,
      coalesce(o.expires_at, public.calculate_order_expires_at(o.created_at, o.product_name, o.plan_label, o.notes, o.price)) as expires_at,
      p.email as profile_email,
      p.full_name as profile_name,
      p.is_banned,
      u.email as auth_email
    from public.orders o
    left join public.profiles p on p.id = o.user_id
    left join auth.users u on u.id = o.user_id
    where o.status = 'completed'
      and (o.expires_at is not null or public.calculate_order_expires_at(o.created_at, o.product_name, o.plan_label, o.notes, o.price) is not null)
    order by o.created_at desc
  loop
    -- ────────────────────────────────────────────────────────────
    -- BỘ LỌC XÁC THỰC HIỆU LỰC (ORDER ELIGIBILITY & STOP STRATEGY)
    -- ────────────────────────────────────────────────────────────
    -- 1. Nếu không có ngày hết hạn (Gói vĩnh viễn) -> Bỏ qua
    if v_order.expires_at is null then
      continue;
    end if;

    -- 2. Nếu tài khoản khách hàng bị khóa (banned) -> Dừng gửi
    if coalesce(v_order.is_banned, false) = true then
      continue;
    end if;

    -- 3. 🌟 QUAN TRỌNG: TỰ ĐỘNG DỪNG NẾU ĐƠN HÀNG ĐÃ ĐƯỢC GIA HẠN THÀNH CÔNG
    -- Trường hợp A: Có đơn hàng gia hạn cụ thể trỏ vào đơn này (renewed_from_order_id = v_order.id)
    if exists (
      select 1 from public.orders b 
      where b.renewed_from_order_id = v_order.id 
        and b.status not in ('cancelled', 'refunded')
    ) then
      v_skipped_renewed := v_skipped_renewed + 1;
      continue; -- BỎ QUA các reminder tương lai của đơn cũ!
    end if;

    -- Trường hợp B: Khách hàng đã đặt mua gói mới cùng sản phẩm có ngày hết hạn xa hơn
    if exists (
      select 1 from public.orders b
      where b.user_id = v_order.user_id
        and b.product_name = v_order.product_name
        and b.id <> v_order.id
        and b.status = 'completed'
        and coalesce(b.expires_at, public.calculate_order_expires_at(b.created_at, b.product_name, b.plan_label, b.notes, b.price)) > v_order.expires_at
        and b.created_at > v_order.created_at
    ) then
      v_skipped_renewed := v_skipped_renewed + 1;
      continue; -- BỎ QUA vì gói dịch vụ đã được tiếp nối bằng đơn mới!
    end if;

    v_user_email := coalesce(v_order.profile_email, v_order.auth_email, '');
    v_user_name := coalesce(v_order.profile_name, 'Quý khách');
    v_expires_vn := (v_order.expires_at at time zone 'Asia/Ho_Chi_Minh');

    -- Tính số ngày còn lại chính xác theo thời gian thực
    v_days_left_exact := extract(epoch from (v_order.expires_at - v_now)) / 86400.0;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 1: CÒN 7 NGÀY (expiry_7_days) — Khoảng: <= 7.0 ngày và > 3.0 ngày
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 7.0 and v_days_left_exact > 3.0 then
      v_notif_type := 'expiry_7_days';

      if not exists (
        select 1 from public.order_expiry_notifications
        where order_id = v_order.id and notification_type = v_notif_type
      ) then
        v_title := '⏰ Gói dịch vụ sắp hết hạn sau 7 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Vui lòng liên hệ shop hoặc gia hạn trên web để không gián đoạn dịch vụ.';

        -- 1. Chuông thông báo web
        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
        end if;

        -- 2. Gửi webhook email
        if v_email_url is not null and v_key is not null and v_user_email <> '' then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'order_id', v_order.id,
                'payment_code', v_order.payment_code,
                'product_name', v_order.product_name,
                'plan_label', v_order.plan_label,
                'days_left', 7,
                'expires_at', to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
                'expires_at_formatted', to_char(v_expires_vn, 'DD/MM/YYYY'),
                'user_email', v_user_email,
                'user_name', v_user_name
              ),
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Apikey ' || v_key
              )
            );
          exception when others then
            raise warning '[check_and_notify_expiring_orders] email_notify_url failed for 7d: %', sqlerrm;
          end;
        end if;

        -- 3. Ghi nhận mốc 7 ngày đã gửi (Idempotent)
        insert into public.order_expiry_notifications(order_id, user_id, notification_type, days_left, scheduled_for, sent_at, metadata)
        values (v_order.id, v_order.user_id, v_notif_type, v_days_left_exact, v_order.expires_at - interval '7 days', v_now, jsonb_build_object('user_email', v_user_email, 'days_left', 7))
        on conflict (order_id, notification_type) do nothing
        returning id into v_inserted_id;

        if v_inserted_id is not null then
          v_processed_7d := v_processed_7d + 1;

          perform public.log_audit_event(
            'EXPIRY_REMINDER_7_DAYS_SENT',
            'order',
            'Tự động gửi email & thông báo nhắc hạn 7 ngày cho đơn hàng #' || v_order.payment_code || ' (' || v_order.product_name || ')',
            v_order.id,
            jsonb_build_object('days_left', 7, 'user_email', v_user_email, 'expires_at', v_expires_vn)
          );
        end if;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 2: CÒN 3 NGÀY (expiry_3_days) — Khoảng: <= 3.0 ngày và > 1.0 ngày
    -- (Độc lập 100% — Vẫn gửi dù mốc 7 ngày đã gửi)
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 3.0 and v_days_left_exact > 1.0 then
      v_notif_type := 'expiry_3_days';

      if not exists (
        select 1 from public.order_expiry_notifications
        where order_id = v_order.id and notification_type = v_notif_type
      ) then
        v_title := '⚠️ Gói dịch vụ sắp hết hạn sau 3 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn chỉ còn 3 ngày sử dụng (đến ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Hãy gia hạn ngay để không gián đoạn công việc.';

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
        end if;

        if v_email_url is not null and v_key is not null and v_user_email <> '' then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'order_id', v_order.id,
                'payment_code', v_order.payment_code,
                'product_name', v_order.product_name,
                'plan_label', v_order.plan_label,
                'days_left', 3,
                'expires_at', to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
                'expires_at_formatted', to_char(v_expires_vn, 'DD/MM/YYYY'),
                'user_email', v_user_email,
                'user_name', v_user_name
              ),
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Apikey ' || v_key
              )
            );
          exception when others then
            raise warning '[check_and_notify_expiring_orders] email_notify_url failed for 3d: %', sqlerrm;
          end;
        end if;

        insert into public.order_expiry_notifications(order_id, user_id, notification_type, days_left, scheduled_for, sent_at, metadata)
        values (v_order.id, v_order.user_id, v_notif_type, v_days_left_exact, v_order.expires_at - interval '3 days', v_now, jsonb_build_object('user_email', v_user_email, 'days_left', 3))
        on conflict (order_id, notification_type) do nothing
        returning id into v_inserted_id;

        if v_inserted_id is not null then
          v_processed_3d := v_processed_3d + 1;

          perform public.log_audit_event(
            'EXPIRY_REMINDER_3_DAYS_SENT',
            'order',
            'Tự động gửi email & thông báo nhắc hạn 3 ngày cho đơn hàng #' || v_order.payment_code || ' (' || v_order.product_name || ')',
            v_order.id,
            jsonb_build_object('days_left', 3, 'user_email', v_user_email, 'expires_at', v_expires_vn)
          );
        end if;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 3: CÒN 1 NGÀY (expiry_1_day) — Khoảng: <= 1.0 ngày và > 0 ngày
    -- (Độc lập 100% — Vẫn gửi dù mốc 7 ngày và 3 ngày đã gửi)
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 1.0 and v_days_left_exact > 0.0 then
      v_notif_type := 'expiry_1_day';

      if not exists (
        select 1 from public.order_expiry_notifications
        where order_id = v_order.id and notification_type = v_notif_type
      ) then
        v_title := '🚨 Gói dịch vụ sẽ hết hạn vào ngày mai!';
        v_msg := 'Khẩn cấp: Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày mai (' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Vui lòng gia hạn ngay hôm nay!';

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
        end if;

        if v_email_url is not null and v_key is not null and v_user_email <> '' then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'order_id', v_order.id,
                'payment_code', v_order.payment_code,
                'product_name', v_order.product_name,
                'plan_label', v_order.plan_label,
                'days_left', 1,
                'expires_at', to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
                'expires_at_formatted', to_char(v_expires_vn, 'DD/MM/YYYY'),
                'user_email', v_user_email,
                'user_name', v_user_name
              ),
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Apikey ' || v_key
              )
            );
          exception when others then
            raise warning '[check_and_notify_expiring_orders] email_notify_url failed for 1d: %', sqlerrm;
          end;
        end if;

        insert into public.order_expiry_notifications(order_id, user_id, notification_type, days_left, scheduled_for, sent_at, metadata)
        values (v_order.id, v_order.user_id, v_notif_type, v_days_left_exact, v_order.expires_at - interval '1 day', v_now, jsonb_build_object('user_email', v_user_email, 'days_left', 1))
        on conflict (order_id, notification_type) do nothing
        returning id into v_inserted_id;

        if v_inserted_id is not null then
          v_processed_1d := v_processed_1d + 1;

          perform public.log_audit_event(
            'EXPIRY_REMINDER_1_DAY_SENT',
            'order',
            'Tự động gửi email & thông báo nhắc hạn 1 ngày (ngày mai) cho đơn hàng #' || v_order.payment_code || ' (' || v_order.product_name || ')',
            v_order.id,
            jsonb_build_object('days_left', 1, 'user_email', v_user_email, 'expires_at', v_expires_vn)
          );
        end if;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 4: ĐÃ HẾT HẠN (expiry_expired) — Khi ngày hiện tại đã vượt quá expires_at
    -- (Chỉ quét trong vòng 7 ngày kể từ khi hết hạn để tránh quét đơn quá cũ)
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 0.0 and v_days_left_exact >= -7.0 then
      v_notif_type := 'expiry_expired';

      if not exists (
        select 1 from public.order_expiry_notifications
        where order_id = v_order.id and notification_type = v_notif_type
      ) then
        v_title := '🔴 Gói dịch vụ đã kết thúc chu kỳ sử dụng';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn đã hết hạn sử dụng. Bạn có thể gia hạn hoặc mua gói mới bất cứ lúc nào.';

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expired', v_title, v_msg, v_order.id, v_order.user_id, false, false);
        end if;

        if v_email_url is not null and v_key is not null and v_user_email <> '' then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'order_id', v_order.id,
                'payment_code', v_order.payment_code,
                'product_name', v_order.product_name,
                'plan_label', v_order.plan_label,
                'days_left', 0,
                'expires_at', to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
                'expires_at_formatted', to_char(v_expires_vn, 'DD/MM/YYYY'),
                'user_email', v_user_email,
                'user_name', v_user_name
              ),
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Apikey ' || v_key
              )
            );
          exception when others then
            raise warning '[check_and_notify_expiring_orders] email_notify_url failed for expired: %', sqlerrm;
          end;
        end if;

        insert into public.order_expiry_notifications(order_id, user_id, notification_type, days_left, scheduled_for, sent_at, metadata)
        values (v_order.id, v_order.user_id, v_notif_type, v_days_left_exact, v_order.expires_at, v_now, jsonb_build_object('user_email', v_user_email, 'expired', true))
        on conflict (order_id, notification_type) do nothing
        returning id into v_inserted_id;

        if v_inserted_id is not null then
          v_processed_exp := v_processed_exp + 1;

          perform public.log_audit_event(
            'EXPIRY_REMINDER_EXPIRED_SENT',
            'order',
            'Tự động gửi thông báo hết hạn cho đơn hàng #' || v_order.payment_code || ' (' || v_order.product_name || ')',
            v_order.id,
            jsonb_build_object('user_email', v_user_email, 'expires_at', v_expires_vn)
          );
        end if;
      end if;
    end if;

  end loop;

  return jsonb_build_object(
    'success', true,
    'checked_at', to_char(v_now_vn, 'YYYY-MM-DD HH24:MI:SS'),
    'reminders_sent', jsonb_build_object(
      '7_days', v_processed_7d,
      '3_days', v_processed_3d,
      '1_day', v_processed_1d,
      'expired', v_processed_exp,
      'skipped_renewed_or_superseded', v_skipped_renewed,
      'total', v_processed_7d + v_processed_3d + v_processed_1d + v_processed_exp
    )
  );
end;
$$;

-- 7. RPC Admin gửi nhắc hạn thủ công (Manual Send) — Không ảnh hưởng các mốc tự động 7/3/1
create or replace function public.admin_send_manual_expiry_reminder(
  p_order_id        uuid,
  p_custom_message  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order          record;
  v_user_email     text;
  v_user_name      text;
  v_email_url      text;
  v_key            text;
  v_title          text;
  v_msg            text;
  v_expires_vn     timestamp;
  v_days_left      integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'message', 'Thao tác không được phép (Unauthorized).');
  end if;

  select 
    o.*,
    p.email as profile_email,
    p.full_name as profile_name,
    u.email as auth_email
  into v_order
  from public.orders o
  left join public.profiles p on p.id = o.user_id
  left join auth.users u on u.id = o.user_id
  where o.id = p_order_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Đơn hàng không tồn tại.');
  end if;

  v_user_email := coalesce(v_order.profile_email, v_order.auth_email, '');
  v_user_name := coalesce(v_order.profile_name, 'Quý khách');

  if v_order.expires_at is not null then
    v_expires_vn := (v_order.expires_at at time zone 'Asia/Ho_Chi_Minh');
    v_days_left := ceil(extract(epoch from (v_order.expires_at - now())) / 86400.0);
  else
    v_expires_vn := null;
    v_days_left := null;
  end if;

  v_title := '🔔 Nhắc hạn dịch vụ từ Ban quản trị BOW';
  v_msg := coalesce(
    trim(p_custom_message),
    'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sắp hết hạn' || 
    case when v_expires_vn is not null then ' vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') else '' end || 
    '. Vui lòng kiểm tra và gia hạn dịch vụ.'
  );

  -- 1. Chuông thông báo web
  if v_order.user_id is not null then
    insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
    values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
  end if;

  -- 2. Gửi Webhook Email
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

  if v_email_url is not null and v_key is not null and v_user_email <> '' then
    begin
      perform net.http_post(
        url     := v_email_url,
        body    := jsonb_build_object(
          'event', 'manual_reminder',
          'order_id', v_order.id,
          'payment_code', v_order.payment_code,
          'product_name', v_order.product_name,
          'plan_label', v_order.plan_label,
          'days_left', v_days_left,
          'expires_at', case when v_expires_vn is not null then to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') else null end,
          'expires_at_formatted', case when v_expires_vn is not null then to_char(v_expires_vn, 'DD/MM/YYYY') else null end,
          'user_email', v_user_email,
          'user_name', v_user_name,
          'custom_message', p_custom_message
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Apikey ' || v_key
        )
      );
    exception when others then
      raise warning '[admin_send_manual_expiry_reminder] net.http_post failed: %', sqlerrm;
    end;
  end if;

  -- 3. Ghi nhận lượt gửi thủ công vào bảng tracking
  insert into public.order_expiry_notifications(order_id, user_id, notification_type, days_left, scheduled_for, sent_at, metadata)
  values (
    v_order.id,
    v_order.user_id,
    'manual_reminder',
    v_days_left,
    now(),
    now(),
    jsonb_build_object('sent_by_admin', true, 'custom_message', p_custom_message, 'user_email', v_user_email)
  )
  on conflict (order_id, notification_type) do update
  set sent_at = now(),
      metadata = jsonb_build_object('sent_by_admin', true, 'custom_message', p_custom_message, 'user_email', v_user_email, 'last_sent_at', now());

  -- 4. Ghi Audit Log
  perform public.log_audit_event(
    'MANUAL_EXPIRY_REMINDER_SENT',
    'order',
    'Admin gửi thông báo & email nhắc hạn thủ công cho đơn hàng #' || v_order.payment_code || ' (' || v_order.product_name || ') đến ' || coalesce(v_user_email, 'khách hàng'),
    v_order.id,
    jsonb_build_object('user_email', v_user_email, 'custom_message', p_custom_message)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Đã gửi thông báo & email nhắc gia hạn thành công đến khách hàng ' || coalesce(v_user_email, '') || '!'
  );
end;
$$;

-- 8. Lập lịch Cron tự động chạy hàng ngày lúc 08:00 sáng
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('check_expiring_orders_daily');
    exception when others then null;
    end;
    perform cron.schedule('check_expiring_orders_daily', '0 1 * * *', 'select public.check_and_notify_expiring_orders();');
  end if;
exception when others then null;
end;
$$;
