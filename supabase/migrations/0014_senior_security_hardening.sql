-- ============================================================
-- BOW — Migration 0014: QUẢN LÝ USER VÀ BẢO MẬT ADMIN CAO CẤP
-- ============================================================

-- ── 0. XÓA TRIỆT ĐỂ CÁC HÀM CŨ BẰNG CASCADE ──
drop function if exists public.admin_get_users_list() cascade;
drop function if exists public.admin_update_user(uuid, text, text) cascade;
drop function if exists public.admin_delete_user(uuid) cascade;
drop function if exists public.is_admin() cascade;

-- ── 1. TẠO BẢNG PUBLIC.ADMINS ──
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admin read admins table" on public.admins;
create policy "admin read admins table" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- ── 2. DỌN SẠCH CÁC USER THƯỜNG KHỎI BẢNG ADMINS & CHỈ GIỮ DUY NHẤT CHỦ SỞ HỮU (EMAIL ADMIN) ──
delete from public.admins
where user_id not in (
  select id from auth.users where lower(email) = 'hoankb4@gmail.com'
);

insert into public.admins (user_id)
select id from auth.users where lower(email) = 'hoankb4@gmail.com'
on conflict (user_id) do nothing;

-- ── 3. HÀM IS_ADMIN BẢO MẬT CHẶT CHẼ (CHỈ CHO PHÉP EMAIL ADMIN VÀ BẢNG ADMINS) ──
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

-- ── 4. BỔ SUNG CỘT BẢO MẬT PROFILES VÀ KÊNH MXH CONTACT_SETTINGS ──
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists phone text;

alter table public.contact_settings add column if not exists instagram_url text;
alter table public.contact_settings add column if not exists tiktok_url text;
alter table public.contact_settings add column if not exists discord_url text;
alter table public.contact_settings add column if not exists locket_url text;

-- ── 5. HÀM LẤY DANH SÁCH USER (BẢO MẬT ADMIN & ÉP KIỂU TƯƠNG THÍCH) ──
create or replace function public.admin_get_users_list()
returns table (
  id           uuid,
  full_name    text,
  email        text,
  avatar_url   text,
  phone        text,
  balance      numeric,
  created_at   timestamptz,
  total_orders bigint,
  is_admin_user boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized: Admin privileges required';
  end if;

  return query
  select
    p.id::uuid,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', 'Thành viên')::text as full_name,
    coalesce(u.email::text, 'N/A')::text as email,
    p.avatar_url::text,
    p.phone::text,
    coalesce(p.balance, 0)::numeric as balance,
    p.created_at::timestamptz,
    count(o.id)::bigint as total_orders,
    (coalesce(lower(u.email::text), '') = 'hoankb4@gmail.com' or exists (select 1 from public.admins a where a.user_id = p.id))::boolean as is_admin_user
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.orders o on o.user_id = p.id
  group by p.id, p.full_name, u.email, u.raw_user_meta_data, p.avatar_url, p.phone, p.balance, p.created_at
  order by p.created_at desc;
end;
$$;

-- ── 6. RPC SỬA THÔNG TIN NGƯỜI DÙNG ──
create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_full_name text,
  p_phone     text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not is_admin() then
    return 'unauthorized'::text;
  end if;

  update public.profiles
  set full_name = p_full_name,
      phone = p_phone,
      updated_at = now()
  where id = p_user_id;

  return 'success'::text;
end;
$$;

-- ── 7. RPC XÓA USER ──
create or replace function public.admin_delete_user(
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_email text;
begin
  if not is_admin() then
    return 'unauthorized'::text;
  end if;

  select lower(email::text) into v_target_email from auth.users where id = p_user_id;

  if v_target_email = 'hoankb4@gmail.com' or exists (select 1 from public.admins where user_id = p_user_id) then
    return 'cannot_delete_admin'::text;
  end if;

  update public.profiles
  set is_banned = true,
      updated_at = now()
  where id = p_user_id;

  delete from auth.users where id = p_user_id;

  return 'success'::text;
end;
$$;

-- ── 8. CẤP QUYỀN THỰC THI CHO HÀM RPC ──
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.admin_get_users_list() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
