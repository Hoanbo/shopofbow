-- ============================================================
-- BOW — Migration 0037: HỆ THỐNG TIẾP THỊ LIÊN KẾT (AFFILIATE) & PHÂN CẤP GIÁ SỈ CTV
-- ============================================================

set search_path = public, auth, extensions;

-- ── 1. MỞ RỘNG BẢNG PRODUCTS (Cấu hình hoa hồng & Giá sỉ CTV) ──
alter table public.products
  add column if not exists affiliate_enabled boolean default true,
  add column if not exists affiliate_type text default 'fixed',
  add column if not exists affiliate_reward numeric default 0,
  add column if not exists affiliate_discount numeric default 0,
  add column if not exists price_ctv numeric default null;

-- ── 2. MỞ RỘNG BẢNG PROFILES (Mã giới thiệu & Role CTV) ──
alter table public.profiles
  add column if not exists role text default 'member',
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists affiliate_earnings numeric default 0;

-- ── 3. HÀM TỰ SINH MÃ GIỚI THIỆU DUY NHẤT CHO USER ──
create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  is_taken boolean := true;
begin
  while is_taken loop
    new_code := 'BOW' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 5));
    select exists (
      select 1 from public.profiles where referral_code = new_code
    ) into is_taken;
  end loop;
  return new_code;
end;
$$;

-- Cập nhật mã referral_code cho các profile hiện có nếu đang null
do $$
declare
  p record;
begin
  for p in select id from public.profiles where referral_code is null or referral_code = '' loop
    update public.profiles
    set referral_code = public.generate_unique_referral_code()
    where id = p.id;
  end loop;
end;
$$;

-- Trigger tự sinh mã referral_code cho Profile mới tạo
create or replace function public.handle_new_profile_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.generate_unique_referral_code();
  end if;
  if new.role is null or new.role = '' then
    new.role := 'member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_referral_code on public.profiles;
create trigger trg_profile_referral_code
  before insert on public.profiles
  for each row
  execute function public.handle_new_profile_referral_code();

-- ── 4. TẠO BẢNG AFFILIATE_CONVERSIONS (Nhật ký giao dịch tiếp thị) ──
create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) on delete set null,
  referee_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  order_amount numeric not null default 0,
  commission_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  is_ctv_order boolean default false,
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_affiliate_referrer on public.affiliate_conversions(referrer_id);
create index if not exists idx_affiliate_order on public.affiliate_conversions(order_id);
create index if not exists idx_affiliate_status on public.affiliate_conversions(status);
create index if not exists idx_affiliate_created on public.affiliate_conversions(created_at desc);

-- ── 5. RLS POLICIES CHO BẢNG AFFILIATE_CONVERSIONS ──
alter table public.affiliate_conversions enable row level security;

drop policy if exists "admin all affiliate_conversions" on public.affiliate_conversions;
create policy "admin all affiliate_conversions"
  on public.affiliate_conversions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user read own conversions" on public.affiliate_conversions;
create policy "user read own conversions"
  on public.affiliate_conversions for select
  to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid());

drop policy if exists "user insert own conversion" on public.affiliate_conversions;
create policy "user insert own conversion"
  on public.affiliate_conversions for insert
  to authenticated
  with check (referee_id = auth.uid() or public.is_admin());

-- ── 6. TRIGGER TỰ ĐỘNG CỘNG TIỀN VÍ KHI ĐƠN HÀNG HOÀN THÀNH ──
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
      -- Nếu có người giới thiệu hợp lệ VÀ có hoa hồng > 0 VÀ không phải đơn mua sỉ CTV
      if conv.referrer_id is not null and conv.commission_amount > 0 and not coalesce(conv.is_ctv_order, false) then
        -- Cộng tiền hoa hồng vào ví tiền web của người giới thiệu
        update public.profiles
        set balance = coalesce(balance, 0) + conv.commission_amount,
            affiliate_earnings = coalesce(affiliate_earnings, 0) + conv.commission_amount
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
      end if;

      -- Đánh dấu conversion hoàn tất
      update public.affiliate_conversions
      set status = 'completed',
          completed_at = now()
      where id = conv.id;
    end loop;

  -- Khi đơn hàng bị hủy hoặc hoàn tiền
  elsif new.status in ('cancelled', 'refunded') and (old.status is null or old.status not in ('cancelled', 'refunded')) then
    update public.affiliate_conversions
    set status = 'cancelled'
    where order_id = new.id and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_affiliate_order_complete on public.orders;
create trigger trg_affiliate_order_complete
  after update of status on public.orders
  for each row
  execute function public.handle_affiliate_order_completion();
