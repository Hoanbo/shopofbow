-- ============================================================================
-- BOW — Migration 0048: HỆ THỐNG PHÁT HIỆN & XÁC ĐỊNH GIA HẠN / THAY THẾ ĐƠN HÀNG (SUPERSEDING ENGINE)
-- HỖ TRỢ CẢ CASE A (GIA HẠN TƯỜNG MINH) & CASE B (MUA LẠI BÌNH THƯỜNG TRÊN WEB)
-- BẢO ĐẢM PRODUCTION-HARDENED: ATOMICITY, CONCURRENCY (FOR UPDATE), ANTI FALSE-POSITIVE
-- VÀ XỬ LÝ CHÍNH XÁC NULL AMBIGUITY (TRÁNH NHẦM LẪN MUA LẠI VỚI MUA THÊM ACCOUNT KHÁC)
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Thêm các cột theo dõi quan hệ thay thế (supersede) vào bảng orders
alter table public.orders
add column if not exists superseded_by_order_id uuid references public.orders(id) on delete set null,
add column if not exists supersede_reason text,
add column if not exists superseded_at timestamptz;

-- Chỉ mục hỗ trợ truy vấn quan hệ gia hạn cực nhanh
create index if not exists idx_orders_superseded_by on public.orders(superseded_by_order_id);
create index if not exists idx_orders_renewed_from on public.orders(renewed_from_order_id);
create index if not exists idx_orders_user_product on public.orders(user_id, product_name);

-- 2. Hàm nghiệp vụ lõi: Đánh giá xem đơn hàng mới có thay thế/gia hạn đơn hàng cũ hay không
-- Trả về: { superseded: boolean, reason: text, confidence: text, old_order_id: uuid, new_order_id: uuid }
create or replace function public.evaluate_order_superseded(
  p_old_order_id uuid,
  p_new_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old            record;
  v_new            record;
  v_old_target     text;
  v_new_target     text;
  v_old_exp        timestamptz;
  v_new_exp        timestamptz;
  v_old_delivery   text;
  v_new_delivery   text;
begin
  if p_old_order_id is null or p_new_order_id is null or p_old_order_id = p_new_order_id then
    return jsonb_build_object('superseded', false, 'reason', 'INVALID_ORDER_PAIR');
  end if;

  select * into v_old from public.orders where id = p_old_order_id;
  select * into v_new from public.orders where id = p_new_order_id;

  if v_old.id is null or v_new.id is null then
    return jsonb_build_object('superseded', false, 'reason', 'ORDER_NOT_FOUND');
  end if;

  -- 1. Phải cùng một khách hàng
  if v_old.user_id is distinct from v_new.user_id then
    return jsonb_build_object('superseded', false, 'reason', 'DIFFERENT_USER');
  end if;

  -- 2. Đơn mới không được ở trạng thái hủy/hoàn tiền
  if v_new.status in ('cancelled', 'refunded') then
    return jsonb_build_object('superseded', false, 'reason', 'NEW_ORDER_CANCELLED_OR_REFUNDED');
  end if;

  -- 3. Đơn mới phải được tạo sau đơn cũ
  if v_new.created_at <= v_old.created_at then
    return jsonb_build_object('superseded', false, 'reason', 'NEW_ORDER_NOT_NEWER');
  end if;

  -- 4. Tính toán expires_at cho cả 2 đơn
  v_old_exp := coalesce(v_old.expires_at, public.calculate_order_expires_at(v_old.created_at, v_old.product_name, v_old.plan_label, v_old.notes, v_old.price));
  v_new_exp := coalesce(v_new.expires_at, public.calculate_order_expires_at(v_new.created_at, v_new.product_name, v_new.plan_label, v_new.notes, v_new.price));

  -- 5. CASE A: GIA HẠN TƯỜNG MINH (EXPLICIT RENEWAL)
  -- Khi khách hàng bấm nút "Gia hạn ngay", hệ thống truyền tường minh renewed_from_order_id
  if v_new.renewed_from_order_id = v_old.id then
    return jsonb_build_object(
      'superseded', true,
      'reason', 'EXPLICIT_RENEWAL',
      'confidence', 'HIGH',
      'old_order_id', v_old.id,
      'new_order_id', v_new.id
    );
  end if;

  -- 6. CASE B: TỰ ĐỘNG PHÁT HIỆN GIA HẠN (AUTO-DETECTED RENEWAL)
  -- 6.1. Phải cùng sản phẩm (so khớp product_id hoặc product_name chuẩn hóa)
  if coalesce(v_old.product_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(v_new.product_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and lower(trim(coalesce(v_old.product_name, ''))) <> lower(trim(coalesce(v_new.product_name, ''))) then
    return jsonb_build_object('superseded', false, 'reason', 'DIFFERENT_PRODUCT');
  end if;

  v_old_target := lower(trim(coalesce(v_old.target_account, '')));
  v_new_target := lower(trim(coalesce(v_new.target_account, '')));

  -- 6.2. ANTI FALSE-POSITIVE: Kiểm tra Tài khoản đích (target_account) & NULL AMBIGUITY
  -- Case 2a: Cả 2 đơn đều có target_account và khác nhau -> Rõ ràng là 2 tài khoản khác nhau!
  if v_old_target <> '' and v_new_target <> '' and v_old_target <> v_new_target then
    return jsonb_build_object(
      'superseded', false,
      'reason', 'DIFFERENT_TARGET_ACCOUNT',
      'old_target', v_old_target,
      'new_target', v_new_target
    );
  end if;

  -- Case 2b: Một đơn có target_account còn một đơn để trống (NULL) -> Không đủ bằng chứng để khẳng định cùng tài khoản
  if (v_old_target <> '' and v_new_target = '') or (v_old_target = '' and v_new_target <> '') then
    return jsonb_build_object(
      'superseded', false,
      'reason', 'INSUFFICIENT_EVIDENCE_TARGET_ACCOUNT_MISMATCH',
      'old_target', v_old_target,
      'new_target', v_new_target
    );
  end if;

  -- Case 2c: Mua số lượng lớn (Multi-quantity purchase: x2, x3...)
  -- Nếu đơn mới mua số lượng > 1 trong khi đơn cũ là 1 slot không rõ target account -> Coi là mua thêm nhiều tài khoản!
  if coalesce(v_new.quantity, 1) > 1 and coalesce(v_old.quantity, 1) = 1 and (v_new_target = '' or v_old_target <> v_new_target) then
    return jsonb_build_object('superseded', false, 'reason', 'MULTI_QUANTITY_PURCHASE');
  end if;

  -- Case 2d: Cả 2 đơn đều NULL target_account ("Mua lại nhưng là mua thêm slot/tài khoản khác")
  -- Đối với các dịch vụ Slot/Tài khoản cấp sẵn (Netflix, Capcut, ChatGPT, Claude, Spotify, Canva...), nếu không có target_account
  -- và không có thông tin bàn giao khớp nhau -> Không tự ý supersede để tránh ngắt reminder của tài khoản đang dùng
  v_old_delivery := lower(trim(coalesce(v_old.delivery_info, v_old.account_details, '')));
  v_new_delivery := lower(trim(coalesce(v_new.delivery_info, v_new.account_details, '')));

  if v_old_target = '' and v_new_target = '' then
    -- Nếu cả 2 đều không có target_account, chỉ cho phép auto-detect nếu đơn cũ đã hết hạn hoặc cận kề ngày hết hạn (trong vòng 3 ngày)
    if v_old_exp is not null and v_new.created_at < (v_old_exp - interval '3 days') then
      return jsonb_build_object(
        'superseded', false,
        'reason', 'INSUFFICIENT_EVIDENCE_UNIDENTIFIED_SLOT',
        'details', 'Cả 2 đơn không có target_account và đơn mới được tạo quá sớm so với ngày hết hạn của đơn cũ.'
      );
    end if;
  end if;

  -- 6.3. ANTI FALSE-POSITIVE: Đơn mới phải có hạn sử dụng (expires_at) xa hơn đơn cũ
  if v_old_exp is not null and v_new_exp is not null and v_new_exp <= v_old_exp then
    return jsonb_build_object('superseded', false, 'reason', 'EXPIRY_NOT_EXTENDED');
  end if;

  -- 6.4. ANTI FALSE-POSITIVE: Cửa sổ Thời gian (Time Window Boundary: -15 ngày đến +30 ngày)
  if v_old_exp is not null then
    if v_new.created_at < (v_old_exp - interval '15 days') then
      return jsonb_build_object('superseded', false, 'reason', 'ORDER_CREATED_TOO_EARLY_FOR_RENEWAL');
    end if;
    if v_new.created_at > (v_old_exp + interval '30 days') then
      return jsonb_build_object('superseded', false, 'reason', 'ORDER_CREATED_TOO_LATE_FOR_RENEWAL');
    end if;
  end if;

  -- Thỏa mãn toàn bộ tiêu chí an toàn -> Xác nhận AUTO_DETECTED_RENEWAL
  return jsonb_build_object(
    'superseded', true,
    'reason', 'AUTO_DETECTED_RENEWAL',
    'confidence', case when v_old_target <> '' and v_old_target = v_new_target then 'HIGH' else 'MEDIUM' end,
    'old_order_id', v_old.id,
    'new_order_id', v_new.id
  );
end;
$$;

-- 3. Hàm kích hoạt phát hiện và liên kết đơn hàng cũ khi đơn hàng mới hoàn tất
-- CƠ CHẾ ATOMIC TRANSACTION & CONCURRENCY SAFE (SELECT FOR UPDATE SKIP LOCKED)
create or replace function public.detect_and_link_superseded_order(p_new_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_new            record;
  v_candidate      record;
  v_eval           jsonb;
  v_linked_count   integer := 0;
begin
  -- Khóa dòng đơn hàng mới để đảm bảo tính tuần tự và nguyên tử (Atomic)
  select * into v_new 
  from public.orders 
  where id = p_new_order_id
  for update;

  if v_new.id is null or v_new.status in ('cancelled', 'refunded') then
    return jsonb_build_object('success', false, 'message', 'Đơn hàng không hợp lệ để phát hiện gia hạn.');
  end if;

  -- 1. CASE A: GIA HẠN TƯỜNG MINH (renewed_from_order_id)
  if v_new.renewed_from_order_id is not null then
    update public.orders
    set superseded_by_order_id = v_new.id,
        supersede_reason = 'EXPLICIT_RENEWAL',
        superseded_at = now()
    where id = v_new.renewed_from_order_id
      and (superseded_by_order_id is null or superseded_by_order_id <> v_new.id);

    perform public.log_audit_event(
      'ORDER_RENEWAL_EXPLICIT_LINKED',
      'order',
      'Đơn hàng #' || v_new.payment_code || ' đã gia hạn tường minh từ đơn cũ (ID: ' || v_new.renewed_from_order_id || ')',
      v_new.id,
      jsonb_build_object('old_order_id', v_new.renewed_from_order_id, 'reason', 'EXPLICIT_RENEWAL')
    );

    return jsonb_build_object('success', true, 'type', 'EXPLICIT_RENEWAL', 'old_order_id', v_new.renewed_from_order_id);
  end if;

  -- 2. CASE B: TỰ ĐỘNG PHÁT HIỆN GIA HẠN (FOR UPDATE SKIP LOCKED chống Race Condition)
  for v_candidate in
    select o.*
    from public.orders o
    where o.user_id = v_new.user_id
      and o.id <> v_new.id
      and o.status = 'completed'
      and o.superseded_by_order_id is null
      and o.created_at < v_new.created_at
      and (
        (o.product_id is not null and v_new.product_id is not null and o.product_id = v_new.product_id)
        or lower(trim(o.product_name)) = lower(trim(v_new.product_name))
      )
    order by coalesce(o.expires_at, o.created_at) desc
    for update skip locked
    limit 3
  loop
    v_eval := public.evaluate_order_superseded(v_candidate.id, v_new.id);

    if (v_eval->>'superseded')::boolean = true then
      -- Cập nhật 2 chiều trong cùng một giao dịch (Atomic Transaction)
      update public.orders
      set superseded_by_order_id = v_new.id,
          supersede_reason = v_eval->>'reason',
          superseded_at = now()
      where id = v_candidate.id;

      update public.orders
      set renewed_from_order_id = v_candidate.id
      where id = v_new.id and renewed_from_order_id is null;

      -- Ghi Audit Log tự động nhận diện gia hạn
      perform public.log_audit_event(
        'ORDER_RENEWAL_AUTO_DETECTED',
        'order',
        'Tự động nhận diện đơn hàng #' || v_new.payment_code || ' thay thế/tiếp nối cho đơn hàng #' || v_candidate.payment_code || ' (' || v_new.product_name || ')',
        v_new.id,
        jsonb_build_object(
          'old_order_id', v_candidate.id,
          'old_payment_code', v_candidate.payment_code,
          'new_order_id', v_new.id,
          'reason', v_eval->>'reason',
          'confidence', v_eval->>'confidence'
        )
      );

      v_linked_count := v_linked_count + 1;
      exit; -- Đã liên kết với đơn cũ gần nhất, dừng vòng lặp
    end if;
  end loop;

  return jsonb_build_object('success', true, 'linked_count', v_linked_count);
end;
$$;

-- 4. Trigger tự động chạy phát hiện gia hạn ngay khi đơn hàng chuyển sang trạng thái completed
create or replace function public.tg_on_order_detect_renewal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (new.status = 'completed' and (old.status is null or old.status <> 'completed'))
     or (new.renewed_from_order_id is not null and (old.renewed_from_order_id is null or old.renewed_from_order_id <> new.renewed_from_order_id)) then
    perform public.detect_and_link_superseded_order(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tg_order_detect_renewal_trigger on public.orders;
create trigger tg_order_detect_renewal_trigger
  after insert or update of status, renewed_from_order_id on public.orders
  for each row
  execute function public.tg_on_order_detect_renewal();

-- 5. Cập nhật RPC check_and_notify_expiring_orders
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
  begin
    select decrypted_secret into v_email_url from vault.decrypted_secrets where name = 'email_notify_url';
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'internal_api_key';
  exception when others then
    v_email_url := null;
    v_key := null;
  end;

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
    -- 1. Gói vĩnh viễn -> Bỏ qua
    if v_order.expires_at is null then
      continue;
    end if;

    -- 2. Tài khoản bị khóa -> Dừng gửi
    if coalesce(v_order.is_banned, false) = true then
      continue;
    end if;

    -- 3. 🌟 QUAN TRỌNG: DỪNG NẾU ĐƠN HÀNG ĐÃ ĐƯỢC GIA HẠN / THAY THẾ
    if v_order.superseded_by_order_id is not null then
      if exists (select 1 from public.orders s where s.id = v_order.superseded_by_order_id and s.status not in ('cancelled', 'refunded')) then
        v_skipped_renewed := v_skipped_renewed + 1;
        continue; -- DỪNG tất cả các reminder tương lai của đơn cũ!
      end if;
    end if;

    -- Fallback check
    if exists (
      select 1 from public.orders b 
      where b.renewed_from_order_id = v_order.id 
        and b.status not in ('cancelled', 'refunded')
    ) then
      v_skipped_renewed := v_skipped_renewed + 1;
      continue;
    end if;

    v_user_email := coalesce(v_order.profile_email, v_order.auth_email, '');
    v_user_name := coalesce(v_order.profile_name, 'Quý khách');
    v_expires_vn := (v_order.expires_at at time zone 'Asia/Ho_Chi_Minh');

    v_days_left_exact := extract(epoch from (v_order.expires_at - v_now)) / 86400.0;

    -- MỐC 1: CÒN 7 NGÀY
    if v_days_left_exact <= 7.0 and v_days_left_exact > 3.0 then
      v_notif_type := 'expiry_7_days';

      if not exists (
        select 1 from public.order_expiry_notifications
        where order_id = v_order.id and notification_type = v_notif_type
      ) then
        v_title := '⏰ Gói dịch vụ sắp hết hạn sau 7 ngày';
        v_msg := 'Gói ' || v_order.product_name || ' (Đơn #' || v_order.payment_code || ') của bạn sẽ hết hạn vào ngày ' || to_char(v_expires_vn, 'DD/MM/YYYY') || '. Vui lòng liên hệ shop hoặc gia hạn trên web để không gián đoạn dịch vụ.';

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

    -- MỐC 2: CÒN 3 NGÀY
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

    -- MỐC 3: CÒN 1 NGÀY
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

    -- MỐC 4: ĐÃ HẾT HẠN
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
