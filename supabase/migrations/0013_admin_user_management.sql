-- ============================================================
-- BOW — Migration 0013: QUẢN LÝ NGƯỜI DÙNG BẢO MẬT DÀNH CHO ADMIN
-- ============================================================

-- ── 0. XÓA BỎ HÀM CŨ ĐỂ TRÁNH XUNG ĐỘT THAM SỐ ──
drop function if exists public.admin_get_users_list();
drop function if exists public.admin_update_user(uuid, text, text);
drop function if exists public.admin_delete_user(uuid);
drop function if exists public.admin_adjust_balance(uuid, numeric, text);

-- ── 1. BỔ SUNG CỘT PHONE NẾU CHƯA CÓ ──
alter table public.profiles add column if not exists phone text;

-- ── 2. RLS POLICIES CHO ADMIN BẢNG PROFILES ──
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles
  for select to authenticated
  using (is_admin());

drop policy if exists "admin update all profiles" on public.profiles;
create policy "admin update all profiles" on public.profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin delete profiles" on public.profiles;
create policy "admin delete profiles" on public.profiles
  for delete to authenticated
  using (is_admin());

-- ── 3. RPC SỬA THÔNG TIN NGƯỜI DÙNG (HỌ TÊN, SĐT) ──
create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_full_name text default null,
  p_phone     text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return 'unauthorized';
  end if;

  update public.profiles
  set full_name  = coalesce(p_full_name, full_name),
      phone      = coalesce(p_phone, phone),
      updated_at = now()
  where id = p_user_id;

  if not found then
    return 'user_not_found';
  end if;

  return 'success';
end$$;

-- ── 4. RPC XÓA NGƯỜI DÙNG (CẤM XÓA ADMIN) ──
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
    return 'unauthorized';
  end if;

  select lower(email) into v_target_email
  from auth.users
  where id = p_user_id;

  if not found then
    return 'user_not_found';
  end if;

  if v_target_email = 'hoankb4@gmail.com' then
    return 'cannot_delete_admin';
  end if;

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;

  return 'success';
end$$;

-- ── 5. RPC LẤY DANH SÁCH NGƯỜI DÙNG ──
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
    raise exception 'Unauthorized';
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', 'Thành viên') as full_name,
    coalesce(u.email, 'N/A') as email,
    p.avatar_url,
    p.phone,
    p.balance,
    p.created_at,
    count(o.id) as total_orders,
    (lower(u.email) = 'hoankb4@gmail.com') as is_admin_user
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.orders o on o.user_id = p.id
  group by p.id, p.full_name, u.email, u.raw_user_meta_data, p.avatar_url, p.phone, p.balance, p.created_at
  order by p.created_at desc;
end$$;

-- ── 6. CẤP QUYỀN THỰC THI CHO HÀM RPC ──
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_get_users_list() to authenticated;
