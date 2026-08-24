-- ============================================================================
-- BOW — Migration 0056: EXCLUDE TOP-UP / WALLET DEPOSITS FROM EXPIRY & WARRANTY
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. CẬP NHẬT HÀM TÍNH TOÁN EXPIRY: LOẠI BỎ TOÀN BỘ ĐƠN NẠP TIỀN / VÍ
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
  -- 0. Nạp tiền vào ví / Giao dịch ví -> Tuyệt đối không có ngày hết hạn
  if v_plan_str like '%nạp tiền%' 
     or v_plan_str like '%nạp số dư%' 
     or v_plan_str like '%ví%' 
     or p_product_name = 'Nạp tiền vào ví' then
    return null;
  end if;

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

-- 2. CẬP NHẬT TRIGGER TỰ ĐỘNG GÁN EXPIRES_AT
create or replace function public.tg_set_order_expires_at()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Nếu là đơn nạp tiền thì luôn luôn để expires_at là null
  if new.product_name = 'Nạp tiền vào ví' or upper(coalesce(new.payment_code, '')) like 'BOWN%' then
    new.expires_at := null;
    return new;
  end if;

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

-- 3. DỌN SẠCH DỮ LIỆU ĐƠN NẠP TIỀN HIỆN TẠI TRONG CƠ SỞ DỮ LIỆU
update public.orders
set expires_at = null
where product_name = 'Nạp tiền vào ví' 
   or payment_code ilike 'BOWN%' 
   or notes ilike '%nạp số dư%'
   or notes ilike '%sepay%';

delete from public.order_expiry_notifications
where order_id in (
  select id from public.orders 
  where product_name = 'Nạp tiền vào ví' 
     or payment_code ilike 'BOWN%'
);
