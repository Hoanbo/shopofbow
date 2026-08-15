-- ============================================================================
-- BOW — Migration 0041: TỰ ĐỘNG GỬI THÔNG BÁO KHI CẤP HOẶC HẠ QUYỀN CTV
-- ============================================================================

set search_path = public, auth;

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
  v_target_name     text;
  v_clean_role      text;
  v_old_role        text;
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

  -- 3. Lấy thông tin user hiện tại
  select email, full_name, role into v_target_email, v_target_name, v_old_role
  from public.profiles where id = p_user_id;

  -- 4. Không cho phép hạ quyền Admin chính
  if v_target_email = 'hoankb4@gmail.com' and v_clean_role <> 'admin' then
    return 'cannot_demote_superadmin';
  end if;

  -- 5. Cập nhật role
  update public.profiles
  set role = v_clean_role,
      updated_at = now()
  where id = p_user_id;

  -- 6. Gửi thông báo trong hệ thống (In-App Notification) đến khách hàng
  if v_clean_role = 'ctv' and v_old_role <> 'ctv' then
    insert into public.notifications (
      user_id, title, message, type, is_admin, is_read, created_at
    ) values (
      p_user_id,
      '👑 Chúc mừng! Bạn đã trở thành CTV Sỉ',
      'Tài khoản của bạn đã được Admin nâng cấp lên Cộng Tác Viên. Bạn có thể mua tất cả sản phẩm với Giá Sỉ ưu đãi ngay bây giờ!',
      'role_ctv',
      false,
      false,
      now()
    );
  elsif v_clean_role = 'member' and v_old_role = 'ctv' then
    insert into public.notifications (
      user_id, title, message, type, is_admin, is_read, created_at
    ) values (
      p_user_id,
      'ℹ️ Thông báo cấp tài khoản',
      'Tài khoản của bạn đã được chuyển về cấp Thành viên thường.',
      'role_member',
      false,
      false,
      now()
    );
  end if;

  -- 7. Ghi log audit an toàn
  perform public.log_audit_event(
    p_action      => 'role_updated',
    p_entity_type => 'user',
    p_description => 'Admin đã thay đổi vai trò của người dùng ' || coalesce(v_target_email, p_user_id::text) || ' thành ' || upper(v_clean_role),
    p_actor_id    => auth.uid(),
    p_entity_id   => p_user_id::text,
    p_metadata    => jsonb_build_object(
      'user_id', p_user_id,
      'email', v_target_email,
      'old_role', v_old_role,
      'new_role', v_clean_role,
      'updated_by', auth.uid()
    )
  );

  return 'success';
end;
$$;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
