-- ============================================================================
-- BOW — Migration 0039: SIẾT CHẶT BẢO MẬT PHÂN QUYỀN CTV & TIẾP THỊ LIÊN KẾT (AFFILIATE)
-- 1. Chống leo thang đặc quyền (User không thể tự gán role = 'ctv' / 'admin')
-- 2. Chống giả mạo hoa hồng (Chỉ Database Server được tính toán hoa hồng từ bảng products)
-- 3. Chống tự giới thiệu (Self-referral prevention) & Chống trùng lặp (Unique order conversion)
-- 4. Đảm bảo trigger cộng tiền hoa hồng vào ví hoạt động trơn tru với bảo vệ số dư
-- ============================================================================

set search_path = public, auth;

-- ── 1. BẢO VỆ PROFILES: CHỐNG USER TỰ Ý THAY ĐỔI ROLE, AFFILIATE_EARNINGS & SỐ DƯ ──
create or replace function public.trg_protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Nếu là người dùng thường cập nhật qua API Supabase (không phải Admin)
  if auth.uid() is not null and not public.is_admin() then
    -- 1. Cấm tự ý sửa đổi số dư ví (Balance) nếu không được gọi từ RPC nội bộ
    if current_setting('app.allow_balance_update', true) is distinct from 'true' then
      if NEW.balance is distinct from OLD.balance then
        NEW.balance := OLD.balance;
      end if;
    end if;

    -- 2. Cấm tự ý sửa đổi role (Thành viên không thể tự nâng cấp lên 'ctv' hoặc 'admin')
    if NEW.role is distinct from OLD.role then
      NEW.role := OLD.role;
    end if;

    -- 3. Cấm tự ý sửa đổi affiliate_earnings (Hoa hồng tích lũy)
    if NEW.affiliate_earnings is distinct from OLD.affiliate_earnings then
      NEW.affiliate_earnings := OLD.affiliate_earnings;
    end if;

    -- 4. Cấm tự ý gỡ trạng thái bị khóa (is_banned)
    if NEW.is_banned is distinct from OLD.is_banned then
      NEW.is_banned := OLD.is_banned;
    end if;

    -- 5. Cấm tự ý sửa referral_code sau khi đã được cấp
    if OLD.referral_code is not null and NEW.referral_code is distinct from OLD.referral_code then
      NEW.referral_code := OLD.referral_code;
    end if;

    -- 6. Cấm tự ý sửa người giới thiệu của mình (referred_by)
    if OLD.referred_by is not null and NEW.referred_by is distinct from OLD.referred_by then
      NEW.referred_by := OLD.referred_by;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_profiles on public.profiles;
create trigger trg_protect_profiles
  before update on public.profiles
  for each row execute function public.trg_protect_profile_sensitive_fields();

-- ── 2. KHÓA RLS TRÊN BẢNG AFFILIATE_CONVERSIONS: CẤM CLIENT TỰ INSERT/UPDATE ──
alter table public.affiliate_conversions enable row level security;

-- Thêm UNIQUE constraint trên order_id (1 đơn hàng chỉ tạo 1 bản ghi conversion duy nhất)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_conversions_order_id_unique'
  ) then
    alter table public.affiliate_conversions
      add constraint affiliate_conversions_order_id_unique unique (order_id);
  end if;
end $$;

-- Xóa các policy insert tự do từ client
drop policy if exists "user insert own conversion" on public.affiliate_conversions;
drop policy if exists "user update own conversion" on public.affiliate_conversions;
drop policy if exists "user delete own conversion" on public.affiliate_conversions;

-- Chỉ Admin mới có quyền thao tác trực tiếp trên bảng conversion
drop policy if exists "admin insert conversions" on public.affiliate_conversions;
create policy "admin insert conversions"
  on public.affiliate_conversions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update conversions" on public.affiliate_conversions;
create policy "admin update conversions"
  on public.affiliate_conversions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete conversions" on public.affiliate_conversions;
create policy "admin delete conversions"
  on public.affiliate_conversions for delete
  to authenticated
  using (public.is_admin());

-- User chỉ có quyền đọc (SELECT) các giao dịch liên quan đến mình
drop policy if exists "user read own conversions" on public.affiliate_conversions;
create policy "user read own conversions"
  on public.affiliate_conversions for select
  to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid() or public.is_admin());

-- ── 3. RPC GHI NHẬN CONVERSION BẢO MẬT CHẶT CHẼ TRÊN SERVER ──
create or replace function public.record_affiliate_conversion(
  p_order_id      uuid,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth as $$
declare
  v_order         record;
  v_referrer      record;
  v_buyer         record;
  v_product       record;
  v_clean_code    text;
  v_commission    numeric := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  -- 1. Tìm đơn hàng
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  -- Xác thực quyền: Chỉ người tạo đơn hoặc Admin mới được yêu cầu record
  if v_order.user_id <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden_order');
  end if;

  -- 2. Kiểm tra nếu đơn hàng đã được ghi nhận trước đó
  if exists (select 1 from public.affiliate_conversions where order_id = p_order_id) then
    return jsonb_build_object('success', true, 'already_recorded', true);
  end if;

  -- 3. Lấy thông tin người mua (Kiểm tra xem có phải là CTV sỉ hay không)
  select * into v_buyer from public.profiles where id = v_order.user_id;

  if v_buyer.role = 'ctv' then
    -- Đơn hàng CTV mua sỉ -> Lưu lại log nhưng commission_amount = 0 (Không tính hoa hồng)
    insert into public.affiliate_conversions (
      referrer_id, referee_id, order_id, product_name,
      order_amount, commission_amount, discount_amount, is_ctv_order, status
    ) values (
      null, v_order.user_id, p_order_id, v_order.product_name,
      v_order.price, 0, coalesce(v_order.discount_amount, 0), true, 'pending'
    );
    return jsonb_build_object('success', true, 'is_ctv_order', true);
  end if;

  -- 4. Nếu không có referral_code -> Kiểm tra referred_by đã lưu sẵn trong profile
  if p_referral_code is null or trim(p_referral_code) = '' then
    if v_buyer.referred_by is not null then
      select * into v_referrer from public.profiles where id = v_buyer.referred_by;
    end if;
  else
    v_clean_code := upper(trim(p_referral_code));
    select * into v_referrer from public.profiles where upper(referral_code) = v_clean_code;
  end if;

  -- 5. Kiểm tra tính hợp lệ của người giới thiệu (Chống tự giới thiệu)
  if v_referrer.id is null or v_referrer.id = v_order.user_id then
    -- Không có người giới thiệu hoặc tự giới thiệu -> Không tính hoa hồng
    insert into public.affiliate_conversions (
      referrer_id, referee_id, order_id, product_name,
      order_amount, commission_amount, discount_amount, is_ctv_order, status
    ) values (
      null, v_order.user_id, p_order_id, v_order.product_name,
      v_order.price, 0, coalesce(v_order.discount_amount, 0), false, 'pending'
    );
    return jsonb_build_object('success', true, 'no_referrer', true);
  end if;

  -- 6. Tính toán hoa hồng chính xác từ Database sản phẩm (Không tin tưởng Client)
  select * into v_product
  from public.products
  where name = v_order.product_name or id in (select product_id from public.product_plans where name = v_order.plan_label limit 1)
  limit 1;

  if found and (v_product.affiliate_enabled is null or v_product.affiliate_enabled = true) and v_product.affiliate_reward > 0 then
    if v_product.affiliate_type = 'percent' or v_product.affiliate_type = 'percentage' then
      v_commission := round((v_order.price * v_product.affiliate_reward) / 100.0);
    else
      v_commission := v_product.affiliate_reward;
    end if;
  else
    v_commission := 0;
  end if;

  -- 7. Ghi nhận giao dịch affiliate an toàn
  insert into public.affiliate_conversions (
    referrer_id,
    referee_id,
    order_id,
    product_id,
    product_name,
    order_amount,
    commission_amount,
    discount_amount,
    is_ctv_order,
    status
  )
  values (
    v_referrer.id,
    v_order.user_id,
    p_order_id,
    v_product.id,
    v_order.product_name,
    v_order.price,
    v_commission,
    coalesce(v_order.discount_amount, 0),
    false,
    'pending'
  );

  -- Lưu referrer_id vào profile người mua nếu chưa có
  if v_buyer.referred_by is null then
    update public.profiles set referred_by = v_referrer.id where id = v_order.user_id;
  end if;

  return jsonb_build_object('success', true, 'commission', v_commission, 'referrer_id', v_referrer.id);
end;
$$;

-- ── 4. NÂNG CẤP TRIGGER CỘNG TIỀN HOA HỒNG KHI ĐƠN HÀNG HOÀN THÀNH ──
create or replace function public.handle_affiliate_order_completion()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  conv record;
begin
  -- Khi đơn hàng hoàn thành
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    for conv in
      select * from public.affiliate_conversions
      where order_id = new.id and status = 'pending'
    loop
      -- Nếu có người giới thiệu hợp lệ VÀ có hoa hồng > 0 VÀ không phải đơn mua sỉ CTV VÀ không tự giới thiệu
      if conv.referrer_id is not null 
         and conv.commission_amount > 0 
         and not coalesce(conv.is_ctv_order, false)
         and conv.referrer_id <> conv.referee_id then

        -- Mở khóa cờ balance update để cập nhật số dư ví cho referrer
        perform set_config('app.allow_balance_update', 'true', true);

        -- Cộng tiền hoa hồng vào ví tiền của người giới thiệu
        update public.profiles
        set balance = coalesce(balance, 0) + conv.commission_amount,
            affiliate_earnings = coalesce(affiliate_earnings, 0) + conv.commission_amount,
            updated_at = now()
        where id = conv.referrer_id;

        -- Gửi thông báo đến người giới thiệu
        insert into public.notifications (user_id, title, content, type, link)
        values (
          conv.referrer_id,
          '🎉 Nhận hoa hồng giới thiệu mới!',
          'Bạn vừa nhận được +' || to_char(conv.commission_amount, 'FM999,999,999') || 'đ hoa hồng từ đơn hàng ' || coalesce(conv.product_name, 'sản phẩm') || ' của bạn bè.',
          'order',
          '/dashboard?tab=affiliate'
        );

        -- Ghi log audit an toàn
        perform public.log_audit_event(
          'affiliate_commission_paid',
          'affiliate',
          'Đã cộng +' || to_char(conv.commission_amount, 'FM999,999,999') || 'đ hoa hồng cho người dùng ' || conv.referrer_id || ' từ đơn hàng #' || new.payment_code,
          conv.referrer_id,
          jsonb_build_object(
            'order_id', new.id,
            'payment_code', new.payment_code,
            'commission', conv.commission_amount,
            'referrer_id', conv.referrer_id,
            'referee_id', conv.referee_id
          )
        );
      end if;

      -- Cập nhật trạng thái conversion sang completed
      update public.affiliate_conversions
      set status = 'completed', completed_at = now()
      where id = conv.id;
    end loop;
  end if;

  return new;
end;
$$;
