-- ============================================================
-- Migration 0027: Create user_favorites table for wishlists
-- ============================================================

set search_path = public, auth;

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_favorites_user_product_unique unique (user_id, product_id)
);

-- Indexes for fast lookup by user_id and product_id
create index if not exists idx_user_favorites_user_id on public.user_favorites(user_id);
create index if not exists idx_user_favorites_product_id on public.user_favorites(product_id);

-- Enable RLS
alter table public.user_favorites enable row level security;

-- Policies: Only authenticated users can read, insert, delete their OWN favorites
drop policy if exists "users select own favorites" on public.user_favorites;
create policy "users select own favorites"
  on public.user_favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users insert own favorites" on public.user_favorites;
create policy "users insert own favorites"
  on public.user_favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users delete own favorites" on public.user_favorites;
create policy "users delete own favorites"
  on public.user_favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);
