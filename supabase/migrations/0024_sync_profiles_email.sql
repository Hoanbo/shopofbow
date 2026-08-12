-- ============================================================
-- Migration 0024: Synchronize profiles.email with auth.users.email
-- Fixes missing/null email in public.profiles table
-- ============================================================

set search_path = public, auth;

-- 1. Backfill email for all existing profiles from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '' or p.email is distinct from u.email);

-- 2. Insert missing profiles for any auth.users that don't have a profile row
insert into public.profiles (id, full_name, avatar_url, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Thành viên') as full_name,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do update
set email = excluded.email;

-- 3. Enhance handle_new_user trigger to keep email synchronized
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Thành viên'),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;
