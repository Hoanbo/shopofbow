-- ============================================================
-- BOW — Migration 0035: TỔNG RÀ SOÁT & SIẾT CHẶT TOÀN DIỆN AN NINH TẤT CẢ CHỨC NĂNG
-- Bảo vệ toàn diện cả chức năng cũ lẫn chức năng mới
-- ============================================================

set search_path = public, auth;

-- ────────────────────────────────────────────────────────────
-- 0. HÀM IS_ADMIN() CHUẨN XÁC, BẢO MẬT CHẶT CHẼ
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- 1. BẢO VỆ SỐ DƯ VÍ (PROFILES.BALANCE) & TRẠNG THÁI KHÓA (IS_BANNED)
-- Ngăn chặn triệt để user dùng DevTools/API tự sửa số dư ví của mình
-- ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create or replace function public.trg_protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Nếu là người dùng thường cập nhật qua API (không phải Admin)
  if auth.uid() is not null and not public.is_admin() then
    -- 1. Cấm tự ý sửa đổi số dư ví (Balance) nếu không được gọi từ hàm RPC nội bộ đáng tin cậy
    if current_setting('app.allow_balance_update', true) is distinct from 'true' then
      if NEW.balance is distinct from OLD.balance then
        NEW.balance := OLD.balance;
      end if;
    end if;

    -- 2. Cấm tự ý gỡ trạng thái bị khóa (is_banned)
    if NEW.is_banned is distinct from OLD.is_banned then
      NEW.is_banned := OLD.is_banned;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_profiles on public.profiles;
create trigger trg_protect_profiles
  before update on public.profiles
  for each row execute function public.trg_protect_profile_sensitive_fields();

-- ────────────────────────────────────────────────────────────
-- 2. BẢO VỆ BẢNG SẢN PHẨM & DANH MỤC (CATALOG TABLES)
-- Chỉ Admin được thêm, sửa, xóa sản phẩm, gói, tính năng, FAQ, cài đặt
-- ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_plans',
    'product_features','faqs','contact_settings'
  ]
  loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists "public read %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin insert %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin update %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$s;', t);

    -- Đọc công khai
    execute format('create policy "public read %1$s" on public.%1$s for select using (true);', t);
    -- Thao tác thay đổi chỉ Admin
    execute format('create policy "admin insert %1$s" on public.%1$s for insert to authenticated with check (public.is_admin());', t);
    execute format('create policy "admin update %1$s" on public.%1$s for update to authenticated using (public.is_admin()) with check (public.is_admin());', t);
    execute format('create policy "admin delete %1$s" on public.%1$s for delete to authenticated using (public.is_admin());', t);
  end loop;
end$$;

-- ────────────────────────────────────────────────────────────
-- 3. CHỐNG GIẢ MẠO ADMIN TRONG SUPPORT TICKETS & MESSAGES
-- ────────────────────────────────────────────────────────────
create or replace function public.trg_enforce_support_message_security()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null then
    NEW.sender_id := auth.uid();

    -- Nếu không phải admin, bắt buộc role là 'user'
    if not public.is_admin() then
      NEW.sender_role := 'user';
    else
      if NEW.sender_role is null or NEW.sender_role = '' then
        NEW.sender_role := 'admin';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_support_message_security on public.support_messages;
create trigger trg_support_message_security
  before insert on public.support_messages
  for each row execute function public.trg_enforce_support_message_security();

drop policy if exists "insert support_messages" on public.support_messages;
create policy "insert support_messages" on public.support_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or (
        sender_role = 'user'
        and exists (
          select 1 from public.support_tickets t
          where t.id = support_messages.ticket_id and t.user_id = auth.uid()
        )
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. BẢO MẬT TUYỆT ĐỐI NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS)
-- ────────────────────────────────────────────────────────────
alter table public.audit_logs enable row level security;

drop policy if exists "admin read all audit_logs" on public.audit_logs;
create policy "admin read all audit_logs"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "anyone insert audit_logs" on public.audit_logs;
create policy "anyone insert audit_logs"
  on public.audit_logs
  for insert
  with check (true);

-- ────────────────────────────────────────────────────────────
-- 5. CHỐNG TỰ Ý ĐÁNH GIÁ SẢN PHẨM KHI CHƯA MUA / ĐƠN CHƯA HOÀN TẤT
-- ────────────────────────────────────────────────────────────
alter table public.product_reviews enable row level security;

drop policy if exists "user insert own pending product_reviews" on public.product_reviews;
create policy "user insert own pending product_reviews"
  on public.product_reviews
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and exists (
      select 1 from public.orders o
      where o.id = product_reviews.order_id
        and o.user_id = auth.uid()
        and o.status = 'completed'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. CHỐNG TỰ TẠO / SỬA / XÓA MÃ GIẢM GIÁ (COUPONS)
-- ────────────────────────────────────────────────────────────
alter table public.coupons enable row level security;

drop policy if exists "admin full access coupons" on public.coupons;
create policy "admin full access coupons"
  on public.coupons
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "anyone read active coupons" on public.coupons;
create policy "anyone read active coupons"
  on public.coupons
  for select
  using (is_active = true or public.is_admin());
