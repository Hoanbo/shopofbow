-- ============================================================
-- Migration 0031: Fix Foreign Key on product_reviews to public.profiles
-- Ensures Supabase PostgREST can embed profiles relation directly
-- ============================================================

set search_path = public, auth;

-- Add explicit foreign key constraint from product_reviews(user_id) -> public.profiles(id)
alter table public.product_reviews
  drop constraint if exists product_reviews_user_id_fkey;

alter table public.product_reviews
  add constraint product_reviews_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
