-- ============================================================================
-- BOW — Migration 0055: FIX AUTOMATED EXPIRY CRON, TIMEZONE & SCHEDULER ENGINE
-- ============================================================================

set search_path = public, auth, extensions, vault, net;

-- ────────────────────────────────────────────────────────────
-- 1. BẢNG LOG THEO DÕI VẬN HÀNH CRON (OBSERVABILITY & AUDIT)
-- ────────────────────────────────────────────────────────────
create table if not exists public.cron_execution_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null, -- 'running', 'success', 'failed'
  details jsonb,
  error_message text,
  duration_ms numeric,
  executed_at timestamptz not null default now()
);

create index if not exists idx_cron_logs_job on public.cron_execution_logs(job_name, executed_at desc);

alter table public.cron_execution_logs enable row level security;
create policy "admin read all cron logs" on public.cron_execution_logs for select to authenticated using (public.is_admin());
create policy "service_role all cron logs" on public.cron_execution_logs for all to service_role using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 2. HÀM WRAPPER RETRY CYCLE (KẾT HỢP RESET STALE + RETRY TRONG 1 LỆNH)
-- ────────────────────────────────────────────────────────────
create or replace function public.run_expiry_retry_cycle()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, vault, net
as $$
declare
  v_start_time timestamptz := clock_timestamp();
  v_stale_reset int := 0;
  v_retry_res jsonb;
  v_duration numeric;
begin
  -- 1. Reset stale sending
  begin
    v_stale_reset := public.reset_stale_sending_expiry_reminders();
  exception when others then
    v_stale_reset := -1;
  end;

  -- 2. Retry failed emails (tối đa 3 lần thử)
  begin
    v_retry_res := public.retry_failed_expiry_emails(3);
  exception when others then
    v_retry_res := jsonb_build_object('error', sqlerrm);
  end;

  v_duration := round(extract(epoch from (clock_timestamp() - v_start_time)) * 1000, 2);

  -- 3. Ghi log vận hành
  insert into public.cron_execution_logs (job_name, status, details, duration_ms)
  values (
    'run_expiry_retry_cycle',
    'success',
    jsonb_build_object(
      'stale_reset', v_stale_reset,
      'retry_result', v_retry_res
    ),
    v_duration
  );

  return jsonb_build_object(
    'success', true,
    'stale_reset', v_stale_reset,
    'retry_result', v_retry_res,
    'duration_ms', v_duration
  );
end;
$$;

grant execute on function public.run_expiry_retry_cycle() to authenticated, service_role, anon;

-- ────────────────────────────────────────────────────────────
-- 3. HÀM QUÉT HẠN TOÀN DIỆN (CHECK_AND_NOTIFY_EXPIRING_ORDERS) CẬP NHẬT
-- ────────────────────────────────────────────────────────────
create or replace function public.check_and_notify_expiring_orders()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, vault, net
as $$
declare
  v_start_time           timestamptz := clock_timestamp();
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
  v_duration             numeric;
  v_total_orders_scanned integer := 0;
begin
  -- 1. Đọc cấu hình từ Supabase Vault
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

  -- 2. Quét toàn bộ đơn hàng hoàn tất có hạn dùng
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
    v_total_orders_scanned := v_total_orders_scanned + 1;

    -- A. Bỏ qua gói vĩnh viễn hoặc đơn không có hạn
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

    -- D. Xác định Recipient chính xác
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

      insert into public.order_expiry_notifications (
        order_id, user_id, notification_type, days_left,
        scheduled_for, sent_at, email_status, web_status, metadata
      )
      values (
        v_order.id, v_order.user_id, v_notif_type, v_days_left_exact,
        v_order.expires_at - interval '7 days', v_now, 'pending', 'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 7)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '⏰ Gói dịch vụ sắp hết hạn sau 7 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Vui lòng liên hệ shop hoặc gia hạn trên web để không gián đoạn dịch vụ.';
        v_email_error := null;

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false, 'order', v_order.id::text);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

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
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        update public.order_expiry_notifications
        set email_status = v_email_status, web_status = v_web_status, email_error = v_email_error, sent_at = now()
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

      insert into public.order_expiry_notifications (
        order_id, user_id, notification_type, days_left,
        scheduled_for, sent_at, email_status, web_status, metadata
      )
      values (
        v_order.id, v_order.user_id, v_notif_type, v_days_left_exact,
        v_order.expires_at - interval '3 days', v_now, 'pending', 'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 3)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '⚠️ Gói dịch vụ sắp hết hạn sau 3 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn chỉ còn 3 ngày sử dụng (đến ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Hãy gia hạn ngay để không gián đoạn công việc.';
        v_email_error := null;

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false, 'order', v_order.id::text);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

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
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        update public.order_expiry_notifications
        set email_status = v_email_status, web_status = v_web_status, email_error = v_email_error, sent_at = now()
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

      insert into public.order_expiry_notifications (
        order_id, user_id, notification_type, days_left,
        scheduled_for, sent_at, email_status, web_status, metadata
      )
      values (
        v_order.id, v_order.user_id, v_notif_type, v_days_left_exact,
        v_order.expires_at - interval '1 day', v_now, 'pending', 'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 1)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '🚨 Gói dịch vụ sẽ hết hạn vào ngày mai';
        v_msg := 'Khẩn cấp: Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày mai (' || to_char(v_expires_vn, 'DD/MM/YYYY') || '). Vui lòng gia hạn ngay.';
        v_email_error := null;

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false, 'order', v_order.id::text);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

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
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        update public.order_expiry_notifications
        set email_status = v_email_status, web_status = v_web_status, email_error = v_email_error, sent_at = now()
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

      insert into public.order_expiry_notifications (
        order_id, user_id, notification_type, days_left,
        scheduled_for, sent_at, email_status, web_status, metadata
      )
      values (
        v_order.id, v_order.user_id, v_notif_type, v_days_left_exact,
        v_order.expires_at, v_now, 'pending', 'pending',
        jsonb_build_object('user_email', v_user_email, 'days_left', 0)
      )
      on conflict (order_id, notification_type) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_title := '🔴 Gói dịch vụ đã hết hạn sử dụng';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn đã hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Hãy gia hạn hoặc đặt gói mới bất kỳ lúc nào.';
        v_email_error := null;

        if v_order.user_id is not null then
          insert into public.notifications(type, title, message, order_id, user_id, is_admin, is_read, target_type, target_id)
          values ('order_expiring_soon', v_title, v_msg, v_order.id, v_order.user_id, false, false, 'order', v_order.id::text);
          v_web_status := 'sent';
        else
          v_web_status := 'skipped_no_user';
        end if;

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
          end;
        else
          v_email_status := case when v_user_email = '' then 'skipped_no_email' else 'failed_missing_vault_config' end;
        end if;

        update public.order_expiry_notifications
        set email_status = v_email_status, web_status = v_web_status, email_error = v_email_error, sent_at = now()
        where id = v_inserted_id;

        v_processed_exp := v_processed_exp + 1;
      end if;
    end if;

  end loop;

  v_duration := round(extract(epoch from (clock_timestamp() - v_start_time)) * 1000, 2);

  -- 3. Ghi log thực thi
  insert into public.cron_execution_logs (job_name, status, details, duration_ms)
  values (
    'check_and_notify_expiring_orders',
    'success',
    jsonb_build_object(
      'total_scanned', v_total_orders_scanned,
      'processed_7d', v_processed_7d,
      'processed_3d', v_processed_3d,
      'processed_1d', v_processed_1d,
      'processed_expired', v_processed_exp,
      'skipped_renewed', v_skipped_renewed
    ),
    v_duration
  );

  return jsonb_build_object(
    'success', true,
    'checked_at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS'),
    'duration_ms', v_duration,
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

grant execute on function public.check_and_notify_expiring_orders() to authenticated, service_role, anon;

-- ────────────────────────────────────────────────────────────
-- 4. ĐĂNG KÝ SCHEDULER PG_CRON ĐỘC LẬP & AN TOÀN
-- ────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule các job cũ
    begin perform cron.unschedule('check_expiring_orders_daily'); exception when others then null; end;
    begin perform cron.unschedule('retry_failed_expiry_emails_hourly'); exception when others then null; end;
    begin perform cron.unschedule('bow_daily_expiry_scan'); exception when others then null; end;
    begin perform cron.unschedule('bow_retry_failed_emails'); exception when others then null; end;

    -- Đăng ký job hàng ngày quét mốc mới (01:00 UTC = 08:00 AM VN)
    perform cron.schedule(
      'bow_daily_expiry_scan',
      '0 1 * * *',
      'select public.check_and_notify_expiring_orders();'
    );

    -- Đăng ký job định kỳ mỗi 15 phút retry email thất bại
    perform cron.schedule(
      'bow_retry_failed_emails',
      '*/15 * * * *',
      'select public.run_expiry_retry_cycle();'
    );
  end if;
end$$;
