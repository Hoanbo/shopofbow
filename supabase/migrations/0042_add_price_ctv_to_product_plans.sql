-- ============================================================================
-- BOW — Migration 0042: BỔ SUNG CỘT PRICE_CTV & CÁC CỘT HỖ TRỢ ĐƠN HÀNG
-- Khắc phục triệt để lỗi column "price_ctv" does not exist khi mua hàng
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Bổ sung cột price_ctv vào bảng product_plans
alter table public.product_plans
  add column if not exists price_ctv numeric default null;

-- 2. Bổ sung cột price_ctv vào bảng products
alter table public.products
  add column if not exists price_ctv numeric default null,
  add column if not exists affiliate_enabled boolean default true,
  add column if not exists affiliate_type text default 'fixed',
  add column if not exists affiliate_reward numeric default 0,
  add column if not exists affiliate_discount numeric default 0;

-- 3. Bổ sung cột cho bảng orders
alter table public.orders
  add column if not exists is_ctv_order boolean default false,
  add column if not exists coupon_id uuid default null,
  add column if not exists coupon_code text default null,
  add column if not exists discount_amount numeric default 0,
  add column if not exists original_price numeric default null,
  add column if not exists product_id uuid default null,
  add column if not exists plan_id uuid default null,
  add column if not exists quantity integer default 1;

-- 4. Bổ sung cột cho bảng profiles
alter table public.profiles
  add column if not exists role text default 'member',
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists affiliate_earnings numeric default 0;
