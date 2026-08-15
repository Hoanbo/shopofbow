-- ============================================================================
-- BOW — Migration 0040: RPC ADMIN CẬP NHẬT QUYỀN USER (CTV / MEMBER) & OVERLOAD LOG_AUDIT_EVENT
-- ============================================================================

set search_path = public, auth;

-- 1. Thêm Overload cho log_audit_event nhận (action, entity_type, description, entity_id uuid, metadata jsonb)
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_description text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth as $$
begin
  return public.log_audit_event(
    p_action,
    p_entity_type,
    p_description,
    auth.uid(),
    null,
    'system',
    p_entity_id::text,
    p_metadata
  );
end;
$$;

-- 2. Thêm Overload cho log_audit_event nhận (action, entity_type, description, entity_id text, metadata jsonb)
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_description text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth as $$
begin
  return public.log_audit_event(
    p_action,
    p_entity_type,
    p_description,
    auth.uid(),
    null,
    'system',
    p_entity_id,
    p_metadata
  );
end;
$$;

grant execute on function public.log_audit_event(text, text, text, uuid, jsonb) to authenticated, anon;
grant execute on function public.log_audit_event(text, text, text, text, jsonb) to authenticated, anon;

-- 3. Tạo RPC admin_set_user_role
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    text
)
returns text
language plpgsql
security definer
set search_path = public, auth as $$
declare
  v_caller_is_admin boolean;
  v_target_email    text;
  v_clean_role      text;
begin
  -- 1. Kiểm tra quyền Admin của người gọi
  v_caller_is_admin := public.is_admin();
  if not v_caller_is_admin then
    return 'unauthorized';
  end if;

  -- 2. Chuẩn hóa role
  v_clean_role := lower(trim(p_role));
  if v_clean_role not in ('member', 'ctv', 'admin') then
    return 'invalid_role';
  end if;

  -- 3. Không cho phép hạ quyền Admin chính
  select email into v_target_email from public.profiles where id = p_user_id;
  if v_target_email = 'hoankb4@gmail.com' and v_clean_role <> 'admin' then
    return 'cannot_demote_superadmin';
  end if;

  -- 4. Cập nhật role
  update public.profiles
  set role = v_clean_role,
      updated_at = now()
  where id = p_user_id;

  -- 5. Ghi log audit an toàn
  perform public.log_audit_event(
    p_action      => 'role_updated',
    p_entity_type => 'user',
    p_description => 'Admin đã thay đổi vai trò của người dùng ' || coalesce(v_target_email, p_user_id::text) || ' thành ' || upper(v_clean_role),
    p_actor_id    => auth.uid(),
    p_entity_id   => p_user_id::text,
    p_metadata    => jsonb_build_object(
      'user_id', p_user_id,
      'email', v_target_email,
      'new_role', v_clean_role,
      'updated_by', auth.uid()
    )
  );

  return 'success';
end;
$$;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
