-- ============================================================
-- Migration 0030: Product Reviews System with RLS, Triggers & Security RPC
-- ⭐ Hệ thống Đánh giá Sản phẩm an toàn, kiểm soát bởi Admin
-- ============================================================

set search_path = public, auth;

-- 1. Create product_reviews table
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  content text not null check (char_length(trim(content)) >= 5),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_order_product unique (user_id, order_id, product_id)
);

-- 2. Indexes for performance
create index if not exists idx_product_reviews_product_id on public.product_reviews(product_id);
create index if not exists idx_product_reviews_user_id on public.product_reviews(user_id);
create index if not exists idx_product_reviews_order_id on public.product_reviews(order_id);
create index if not exists idx_product_reviews_status on public.product_reviews(status);

-- Updated_at trigger
drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function set_updated_at();

-- 3. Row Level Security (RLS)
alter table public.product_reviews enable row level security;

-- Policy 1: Public READ (anyone can read APPROVED reviews)
drop policy if exists "public read approved product_reviews" on public.product_reviews;
create policy "public read approved product_reviews"
  on public.product_reviews
  for select
  using (
    status = 'approved'
    or (auth.uid() is not null and user_id = auth.uid())
    or public.is_admin()
  );

-- Policy 2: User INSERT (authenticated user can insert their own pending review)
drop policy if exists "user insert own pending product_reviews" on public.product_reviews;
create policy "user insert own pending product_reviews"
  on public.product_reviews
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );

-- Policy 3: Admin UPDATE / DELETE (only admin can change status or delete reviews)
drop policy if exists "admin update product_reviews" on public.product_reviews;
create policy "admin update product_reviews"
  on public.product_reviews
  for update
  using (public.is_admin());

drop policy if exists "admin delete product_reviews" on public.product_reviews;
create policy "admin delete product_reviews"
  on public.product_reviews
  for delete
  using (public.is_admin());

-- 4. PL/pgSQL RPC Function: Security-enforced submit_product_review
create or replace function public.submit_product_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_content text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_user_id uuid;
  v_order_status text;
  v_order_prod_name text;
  v_prod_name text;
  v_existing_id uuid;
begin
  -- 1. Check authentication
  if v_user_id is null then
    return 'unauthorized';
  end if;

  -- 2. Check rating valid range
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return 'invalid_rating';
  end if;

  -- 3. Check content valid length
  if p_content is null or char_length(trim(p_content)) < 5 then
    return 'invalid_content';
  end if;

  -- 4. Check order exists and belongs to user
  select user_id, status, product_name
  into v_order_user_id, v_order_status, v_order_prod_name
  from public.orders
  where id = p_order_id;

  if v_order_user_id is null or v_order_user_id is distinct from v_user_id then
    return 'not_purchased';
  end if;

  -- 5. Check order status is completed
  if v_order_status is distinct from 'completed' then
    return 'order_not_completed';
  end if;

  -- 6. Check product exists
  select name into v_prod_name
  from public.products
  where id = p_product_id;

  if v_prod_name is null then
    return 'product_not_found';
  end if;

  -- 7. Check duplicate review for this order and product
  select id into v_existing_id
  from public.product_reviews
  where user_id = v_user_id and order_id = p_order_id and product_id = p_product_id;

  if v_existing_id is not null then
    return 'already_reviewed';
  end if;

  -- Insert review
  insert into public.product_reviews (
    product_id, user_id, order_id, rating, content, status
  ) values (
    p_product_id, v_user_id, p_order_id, p_rating, trim(p_content), 'pending'
  );

  return 'success';
end;
$$;

-- 5. Automatic Database Trigger: Recalculate products.rating on approved reviews
create or replace function public.trg_recalculate_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_prod_id uuid;
  v_avg_rating numeric(2,1);
begin
  if (TG_OP = 'DELETE') then
    v_prod_id := OLD.product_id;
  else
    v_prod_id := NEW.product_id;
  end if;

  if v_prod_id is not null then
    select coalesce(round(avg(rating)::numeric, 1), 5.0)
    into v_avg_rating
    from public.product_reviews
    where product_id = v_prod_id and status = 'approved';

    update public.products
    set rating = v_avg_rating, updated_at = now()
    where id = v_prod_id;
  end if;

  return null;
end;
$$;

drop trigger if exists on_review_rating_change on public.product_reviews;
create trigger on_review_rating_change
  after insert or update of status, rating or delete on public.product_reviews
  for each row execute function public.trg_recalculate_product_rating();
