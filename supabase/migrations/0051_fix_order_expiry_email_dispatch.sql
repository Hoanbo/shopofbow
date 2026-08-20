-- ============================================================================
-- BOW — Migration 0051: FIX & HARDEN ORDER EXPIRY EMAIL DISPATCH & ATOMIC CLAIM
-- ============================================================================
--
-- VẤN ĐỀ ĐÃ XÁC MINH TRÊN PRODUCTION:
-- 1. Secret & Webhook Resolution:
--    - Không hard-code bất kỳ secret / API key nào trong SQL code.
--    - Đọc `email_notify_url` và `internal_api_key` từ Supabase Vault (`vault.decrypted_secrets`).
--    - Nếu Vault chưa có key, ghi log cảnh báo và SKIP an toàn thay vì crash hoặc fallback hard-coded.
-- 2. Ngăn chặn triệt để Duplicate Web Notifications & Duplicate Emails:
--    - Áp dụng cơ chế ATOMIC CLAIM: Ghi nhận claim vào `order_expiry_notifications` TRƯỚC.
--    - Sử dụng `INSERT INTO order_expiry_notifications ... ON CONFLICT DO NOTHING RETURNING id INTO v_inserted_id`.
--    - Chỉ worker/job nào claim thành công (`v_inserted_id IS NOT NULL`) mới được phép:
--      + Insert Web Notification vào `public.notifications` (Canonical 1:1).
--      + Gửi HTTP POST dispatch Email (Canonical 1:1).
--      + Cập nhật `email_status` và `web_status`.
--    - Bất kỳ job chạy trùng lặp nào nhận `v_inserted_id IS NULL` sẽ NO-OP / SKIP ngay lập tức.
-- 3. Phân định Recipient chính xác:
--    - Recipient EMAIL luôn được resolve từ `orders.user_id` -> `profiles.email` / `auth.users.email`.
--    - Tuyệt đối KHÔNG dùng `auth.uid()` hay Admin session context để xác định người nhận.
-- ============================================================================

set search_path = public, auth, extensions;

-- ────────────────────────────────────────────────────────────
-- 1. CẬP NHẬT SCHEMA BẢNG ORDER_EXPIRY_NOTIFICATIONS
-- ────────────────────────────────────────────────────────────

alter table public.order_expiry_notifications
  add column if not exists email_status text not null default 'pending',
  add column if not exists web_status text not null default 'pending',
  add column if not exists provider_message_id text,
  add column if not exists email_error text,
  add column if not exists attempt_count integer not null default 1,
  add column if not exists last_attempt_at timestamptz not null default now(),
  add column if not exists sending_started_at timestamptz;

create index if not exists idx_order_expiry_notif_email_status on public.order_expiry_notifications(email_status);
create index if not exists idx_order_expiry_notif_web_status on public.order_expiry_notifications(web_status);
create index if not exists idx_order_expiry_notif_provider_msg on public.order_expiry_notifications(provider_message_id);

-- ────────────────────────────────────────────────────────────
-- 2. HÀM PHỤC HỒI STALE SENDING VÀ RETRY EMAIL THẤT BẠI
-- ────────────────────────────────────────────────────────────

-- 2.1. Hàm phục hồi các mốc bị kẹt trạng thái SENDING quá 15 phút (Stale Recovery)
create or replace function public.reset_stale_sending_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  update public.order_expiry_notifications
  set
    email_status = 'failed',
    email_error = 'Stale sending timeout (> 15 minutes)',
    last_attempt_at = now()
  where email_status = 'sending'
    and (sending_started_at is null or sending_started_at < now() - interval '15 minutes');
    
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2.2. Hàm tự động Retry Email cho các mốc bị FAILED (Tối đa 3 lần, KHÔNG tạo web notification mới)
create or replace function public.retry_failed_expiry_emails(p_max_retry integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rec          record;
  v_order        record;
  v_email_url    text;
  v_key          text;
  v_retried      integer := 0;
  v_final_failed integer := 0;
  v_user_email   text;
  v_user_name    text;
  v_expires_vn   timestamp;
begin
  -- 1. Đọc secret từ Vault
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

  if v_email_url is null or v_key is null then
    return jsonb_build_object('success', false, 'message', 'Vault missing configuration for email retry');
  end if;

  -- 2. Quét các record failed có attempt_count < p_max_retry và cách lần thử trước ít nhất 5 phút
  for v_rec in
    select r.* 
    from public.order_expiry_notifications r
    where r.email_status = 'failed'
      and r.attempt_count < p_max_retry
      and r.last_attempt_at < now() - interval '5 minutes'
    order by r.last_attempt_at asc
    limit 20
  loop
    -- Kiểm tra đơn hàng có còn active không
    select 
      o.*,
      p.email as profile_email,
      p.full_name as profile_name,
      u.email as auth_email
    into v_order
    from public.orders o
    left join public.profiles p on p.id = o.user_id
    left join auth.users u on u.id = o.user_id
    where o.id = v_rec.order_id;

    if not found or v_order.status not in ('completed') or v_order.superseded_by_order_id is not null then
      -- Đơn không còn eligible -> Bỏ qua retry
      update public.order_expiry_notifications
      set email_status = 'skipped_not_eligible', last_attempt_at = now()
      where id = v_rec.id;
      continue;
    end if;

    v_user_email := coalesce(v_order.profile_email, v_order.auth_email, '');
    v_user_name := coalesce(v_order.profile_name, 'Quý khách');
    v_expires_vn := (v_order.expires_at at time zone 'Asia/Ho_Chi_Minh');

    if v_user_email <> '' then
      begin
        -- Cập nhật sending trước khi dispatch
        update public.order_expiry_notifications
        set
          email_status = 'sending',
          attempt_count = attempt_count + 1,
          last_attempt_at = now(),
          sending_started_at = now()
        where id = v_rec.id;

        -- Dispatch HTTP POST (KHÔNG tạo web notification thứ 2)
        perform net.http_post(
          url     := v_email_url,
          body    := jsonb_build_object(
            'event', v_rec.notification_type,
            'type', v_rec.notification_type,
            'order_id', v_order.id,
            'payment_code', v_order.payment_code,
            'product_name', v_order.product_name,
            'plan_label', v_order.plan_label,
            'days_left', coalesce(v_rec.days_left, 0),
            'expires_at', case when v_expires_vn is not null then to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') else null end,
            'expires_at_formatted', case when v_expires_vn is not null then to_char(v_expires_vn, 'DD/MM/YYYY') else '' end,
            'user_email', v_user_email,
            'user_name', v_user_name,
            'is_retry', true,
            'attempt_count', v_rec.attempt_count + 1
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Apikey ' || v_key
          )
        );

        v_retried := v_retried + 1;
      exception when others then
        update public.order_expiry_notifications
        set
          email_status = case when v_rec.attempt_count + 1 >= p_max_retry then 'failed_final' else 'failed' end,
          email_error = sqlerrm,
          last_attempt_at = now()
        where id = v_rec.id;

        if v_rec.attempt_count + 1 >= p_max_retry then
          v_final_failed := v_final_failed + 1;
        end if;
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'retried_dispatched', v_retried,
    'final_failed', v_final_failed
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. HÀM CRON QUÉT VÀ DISPATCH NHẮC HẠN VỚI ATOMIC CLAIM
-- ────────────────────────────────────────────────────────────

create or replace function public.check_and_notify_expiring_orders()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now                  timestamptz := now();
  v_order                record;
  v_expires_vn           timestamp;
  v_days_left_exact      numeric(6,2);
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
  v_email_status         text;
  v_web_status           text;
  v_email_error          text;
begin
  -- 1. Đọc cấu hình từ Supabase Vault (Bảo mật: Không hard-code trong SQL)
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

  -- 2. Quét toàn bộ đơn hàng đủ điều kiện
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
      o.superseded_by_order_id,
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
    -- A. Bỏ qua gói vĩnh viễn
    if v_order.expires_at is null then
      continue;
    end if;

    -- B. Bỏ qua tài khoản bị khóa
    if coalesce(v_order.is_banned, false) = true then
      continue;
    end if;

    -- C. DỪNG NẾU ĐƠN HÀNG ĐÃ ĐƯỢC GIA HẠN / THAY THẾ (SUPERSEDED ENGINE)
    if v_order.superseded_by_order_id is not null then
      if exists (select 1 from public.orders s where s.id = v_order.superseded_by_order_id and s.status not in ('cancelled', 'refunded')) then
        v_skipped_renewed := v_skipped_renewed + 1;
        continue;
      end if;
    end if;

    if exists (
      select 1 from public.orders b 
      where b.renewed_from_order_id = v_order.id 
        and b.status not in ('cancelled', 'refunded')
    ) then
      v_skipped_renewed := v_skipped_renewed + 1;
      continue;
    end if;

    -- D. Xác định Recipient chính xác từ dữ liệu Đơn hàng / Profile
    v_user_email := coalesce(v_order.profile_email, v_order.auth_email, '');
    v_user_name := coalesce(v_order.profile_name, 'Quý khách');
    v_expires_vn := (v_order.expires_at at time zone 'Asia/Ho_Chi_Minh');
    v_days_left_exact := extract(epoch from (v_order.expires_at - v_now)) / 86400.0;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 1: CÒN 7 NGÀY (expiry_7_days) — <= 7.0 ngày và > 3.0 ngày
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 7.0 and v_days_left_exact > 3.0 then
      v_notif_type := 'expiry_7_days';
      v_inserted_id := null;

      -- 🌟 ATOMIC CLAIM: Claim event trước trong bảng tracking
      insert into public.order_expiry_notifications (
        order_id,
        user_id,
        notification_type,
        days_left,
        scheduled_for,
        sent_at,
        email_status,
        web_status,
        metadata
      )
      values (
        v_order.id,
        v_order.user_id,
        v_notif_type,
        v_days_left_exact,
        v_order.expires_at - interval '7 days',
        v_now,
        'pending',
        'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 7)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      -- CHỈ KHI CLAIM THÀNH CÔNG (Tránh race condition / duplicate hoàn toàn)
      if v_inserted_id is not null then
        v_title := '⏰ Gói dịch vụ sắp hết hạn sau 7 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Vui lòng liên hệ shop hoặc gia hạn trên web để không gián đoạn dịch vụ.';
        v_email_error := null;

        -- 1. Web Notification (1 canonical duy nhất)
        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

        -- 2. Dispatch Email
        if v_user_email <> '' and v_email_url is not null and v_key is not null then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'type', v_notif_type,
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
            v_email_status := 'sent';
          exception when others then
            v_email_status := 'failed';
            v_email_error := sqlerrm;
            raise warning '[check_and_notify_expiring_orders] net.http_post failed for 7d: %', sqlerrm;
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        -- 3. Cập nhật kết quả claim
        update public.order_expiry_notifications
        set
          email_status = v_email_status,
          web_status = v_web_status,
          email_error = v_email_error,
          sent_at = now()
        where id = v_inserted_id;

        v_processed_7d := v_processed_7d + 1;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 2: CÒN 3 NGÀY (expiry_3_days) — <= 3.0 ngày và > 1.0 ngày
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 3.0 and v_days_left_exact > 1.0 then
      v_notif_type := 'expiry_3_days';
      v_inserted_id := null;

      -- 🌟 ATOMIC CLAIM
      insert into public.order_expiry_notifications (
        order_id,
        user_id,
        notification_type,
        days_left,
        scheduled_for,
        sent_at,
        email_status,
        web_status,
        metadata
      )
      values (
        v_order.id,
        v_order.user_id,
        v_notif_type,
        v_days_left_exact,
        v_order.expires_at - interval '3 days',
        v_now,
        'pending',
        'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 3)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '⚠️ Gói dịch vụ sắp hết hạn sau 3 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn chỉ còn 3 ngày sử dụng (đến ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Hãy gia hạn ngay để không gián đoạn công việc.';
        v_email_error := null;

        -- 1. Web Notification
        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

        -- 2. Dispatch Email
        if v_user_email <> '' and v_email_url is not null and v_key is not null then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'type', v_notif_type,
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
            v_email_status := 'sent';
          exception when others then
            v_email_status := 'failed';
            v_email_error := sqlerrm;
            raise warning '[check_and_notify_expiring_orders] net.http_post failed for 3d: %', sqlerrm;
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        -- 3. Cập nhật kết quả claim
        update public.order_expiry_notifications
        set
          email_status = v_email_status,
          web_status = v_web_status,
          email_error = v_email_error,
          sent_at = now()
        where id = v_inserted_id;

        v_processed_3d := v_processed_3d + 1;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 3: CÒN 1 NGÀY (expiry_1_day) — <= 1.0 ngày và > 0.0 ngày
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 1.0 and v_days_left_exact > 0.0 then
      v_notif_type := 'expiry_1_day';
      v_inserted_id := null;

      -- 🌟 ATOMIC CLAIM
      insert into public.order_expiry_notifications (
        order_id,
        user_id,
        notification_type,
        days_left,
        scheduled_for,
        sent_at,
        email_status,
        web_status,
        metadata
      )
      values (
        v_order.id,
        v_order.user_id,
        v_notif_type,
        v_days_left_exact,
        v_order.expires_at - interval '1 day',
        v_now,
        'pending',
        'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 1)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '🚨 Gói dịch vụ sẽ hết hạn vào ngày mai';
        v_msg := 'Khẩn cấp: Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày mai (' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Vui lòng gia hạn ngay.';
        v_email_error := null;

        -- 1. Web Notification
        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

        -- 2. Dispatch Email
        if v_user_email <> '' and v_email_url is not null and v_key is not null then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'type', v_notif_type,
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
            v_email_status := 'sent';
          exception when others then
            v_email_status := 'failed';
            v_email_error := sqlerrm;
            raise warning '[check_and_notify_expiring_orders] net.http_post failed for 1d: %', sqlerrm;
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        -- 3. Cập nhật kết quả claim
        update public.order_expiry_notifications
        set
          email_status = v_email_status,
          web_status = v_web_status,
          email_error = v_email_error,
          sent_at = now()
        where id = v_inserted_id;

        v_processed_1d := v_processed_1d + 1;
      end if;
    end if;

    -- ────────────────────────────────────────────────────────────
    -- MỐC 4: ĐÃ HẾT HẠN (expiry_expired) — <= 0.0 ngày
    -- ────────────────────────────────────────────────────────────
    if v_days_left_exact <= 0.0 then
      v_notif_type := 'expiry_expired';
      v_inserted_id := null;

      -- 🌟 ATOMIC CLAIM
      insert into public.order_expiry_notifications (
        order_id,
        user_id,
        notification_type,
        days_left,
        scheduled_for,
        sent_at,
        email_status,
        web_status,
        metadata
      )
      values (
        v_order.id,
        v_order.user_id,
        v_notif_type,
        v_days_left_exact,
        v_order.expires_at,
        v_now,
        'pending',
        'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 0)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '🔴 Gói dịch vụ đã hết hạn sử dụng';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn đã hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Hãy gia hạn hoặc đặt gói mới bất kỳ lúc nào.';
        v_email_error := null;

        -- 1. Web Notification
        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

        -- 2. Dispatch Email
        if v_user_email <> '' and v_email_url is not null and v_key is not null then
          begin
            perform net.http_post(
              url     := v_email_url,
              body    := jsonb_build_object(
                'event', v_notif_type,
                'type', v_notif_type,
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
            v_email_status := 'sent';
          exception when others then
            v_email_status := 'failed';
            v_email_error := sqlerrm;
            raise warning '[check_and_notify_expiring_orders] net.http_post failed for expired: %', sqlerrm;
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        -- 3. Cập nhật kết quả claim
        update public.order_expiry_notifications
        set
          email_status = v_email_status,
          web_status = v_web_status,
          email_error = v_email_error,
          sent_at = now()
        where id = v_inserted_id;

        v_processed_exp := v_processed_exp + 1;
      end if;
    end if;

  end loop;

  return jsonb_build_object(
    'success', true,
    'checked_at', to_char(v_now at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS'),
    'reminders_sent', jsonb_build_object(
      '7_days', v_processed_7d,
      '3_days', v_processed_3d,
      '1_day', v_processed_1d,
      'expired', v_processed_exp,
      'total', v_processed_7d + v_processed_3d + v_processed_1d + v_processed_exp,
      'skipped_renewed_or_superseded', v_skipped_renewed
    )
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. HÀM GỬI NHẮC HẠN THỦ CÔNG TỪ ADMIN (CHUẨN HÓA RECIPIENT)
-- ────────────────────────────────────────────────────────────

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
  v_email_status   text;
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

  -- Xác định người nhận chính xác từ order.user_id
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

  -- 1. Chuông thông báo web (cho đúng customer)
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

  if v_user_email <> '' and v_email_url is not null and v_key is not null then
    begin
      perform net.http_post(
        url     := v_email_url,
        body    := jsonb_build_object(
          'event', 'manual_reminder',
          'type', 'manual_reminder',
          'order_id', v_order.id,
          'payment_code', v_order.payment_code,
          'product_name', v_order.product_name,
          'plan_label', v_order.plan_label,
          'days_left', v_days_left,
          'expires_at', case when v_expires_vn is not null then to_char(v_expires_vn, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') else null end,
          'expires_at_formatted', case when v_expires_vn is not null then to_char(v_expires_vn, 'DD/MM/YYYY') else '' end,
          'user_email', v_user_email,
          'user_name', v_user_name,
          'custom_message', p_custom_message
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Apikey ' || v_key
        )
      );
      v_email_status := 'sent';
    exception when others then
      v_email_status := 'failed';
      raise warning '[admin_send_manual_expiry_reminder] net.http_post failed: %', sqlerrm;
    end;
  else
    v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
  end if;

  -- 3. Ghi nhận tracking lịch sử gửi
  insert into public.order_expiry_notifications(
    order_id,
    user_id,
    notification_type,
    days_left,
    scheduled_for,
    sent_at,
    email_status,
    web_status,
    metadata
  )
  values (
    v_order.id,
    v_order.user_id,
    'manual_reminder',
    coalesce(v_days_left, 0),
    now(),
    now(),
    v_email_status,
    'sent',
    jsonb_build_object(
      'user_email', v_user_email,
      'custom_message', p_custom_message,
      'sent_by_admin', true
    )
  )
  on conflict (order_id, notification_type) 
  do update set
    sent_at = now(),
    days_left = coalesce(excluded.days_left, order_expiry_notifications.days_left),
    email_status = excluded.email_status,
    metadata = excluded.metadata;

  return jsonb_build_object(
    'success', true,
    'message', 'Đã gửi thông báo & Email nhắc hạn thành công tới khách hàng!',
    'user_email', v_user_email,
    'email_status', v_email_status
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. CẤU HÌNH SCHEDULERS ĐỘC LẬP TRÊN PG_CRON
-- ────────────────────────────────────────────────────────────

-- 4.1. Scheduler Hàng ngày (08:00 AM VN = 01:00 AM UTC): Quét các mốc nhắc hạn mới (7/3/1/expired)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('check_expiring_orders_daily');
    exception when others then null;
    end;

    perform cron.schedule(
      'check_expiring_orders_daily',
      '0 1 * * *',
      'select public.check_and_notify_expiring_orders();'
    );
  end if;
end$$;

-- 4.2. Scheduler Định kỳ (Mỗi 15 phút): Phục hồi Stale Sending và Retry các email thất bại
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('retry_failed_expiry_emails_hourly');
    exception when others then null;
    end;

    perform cron.schedule(
      'retry_failed_expiry_emails_hourly',
      '*/15 * * * *',
      'select public.reset_stale_sending_expiry_reminders(); select public.retry_failed_expiry_emails(3);'
    );
  end if;
end$$;
