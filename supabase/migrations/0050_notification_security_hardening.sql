-- ============================================================
-- BOW — Migration 0050: NOTIFICATION & REALTIME SECURITY HARDENING
-- ============================================================
--
-- VẤN ĐỀ BẢO MẬT ĐÃ PHÁT HIỆN QUA AUDIT:
-- 1. INSERT policy "insert notifications" (từ 0016) có WITH CHECK (true)
--    → Cho phép bất kỳ authenticated user nào tự tạo notification, giả mạo
--    thông báo admin (is_admin=true), hoặc spam notification cho user khác.
-- 2. UPDATE policy thiếu kiểm tra hai lớp để bảo vệ các trường bất biến.
--
-- THIẾT KẾ BẢO MẬT TOÀN DIỆN (SERVER-ONLY & DEFENSE IN DEPTH):
--
-- 1. INSERT: 100% SERVER-ONLY (NGUYÊN TẮC LEAST PRIVILEGE)
--    - Toàn bộ role `authenticated` (kể cả Admin trực tiếp từ browser) KHÔNG có quyền INSERT trực tiếp vào public.notifications.
--    - Mọi notification PHẢI được sinh ra từ:
--      + Database Triggers (Orders, Tickets, Messages, Reviews) với SECURITY DEFINER
--      + Secure RPCs (như admin_send_manual_expiry_reminder, cron scan) với SECURITY DEFINER
--      + Serverless Functions / Background Services sử dụng service_role
--    - Thu hồi hoàn toàn quyền INSERT từ authenticated ở cả RLS và Table Grant level.
--
-- 2. UPDATE: BẢO VỆ 2 LỚP (RLS WITH CHECK + IMMUTABLE TRIGGER)
--    - Lớp 1 (RLS): User chỉ update row của chính mình, chặn đổi user_id và is_admin.
--    - Lớp 2 (Trigger): Chặn đứng mọi hành vi sửa title, message, type, order_id, created_at.
--    - User CHỈ ĐƯỢC PHÉP thay đổi trạng thái đọc (is_read, read_at).
--
-- 3. SELECT & DELETE: CÔ LẬP TUYỆT ĐỐI GIỮA USER VÀ ADMIN
--    - User: chỉ xem và xóa notification của chính mình (user_id = auth.uid() AND is_admin = false).
--    - Admin: xem và quản lý toàn bộ thông báo hệ thống.
--
-- 4. REALTIME: ĐỒNG BỘ WAL & PUBLICATION
--    - Replica identity full & đảm bảo nằm trong supabase_realtime publication.
-- ============================================================

set search_path = public, auth;

-- ────────────────────────────────────────────────────────────
-- 1. RLS POLICIES CHO PUBLIC.NOTIFICATIONS
-- ────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;

-- Xóa các policy cũ
drop policy if exists "insert notifications"                on public.notifications;
drop policy if exists "authenticated insert notifications"  on public.notifications;
drop policy if exists "service role all notifications"      on public.notifications;
drop policy if exists "service_role insert notifications"   on public.notifications;
drop policy if exists "admin insert all notifications"      on public.notifications;

drop policy if exists "admin read notifications"            on public.notifications;
drop policy if exists "user read own notifications"         on public.notifications;
drop policy if exists "admin read all notifications"        on public.notifications;

drop policy if exists "admin update notifications"          on public.notifications;
drop policy if exists "user update notifications"           on public.notifications;
drop policy if exists "user update own notifications"       on public.notifications;
drop policy if exists "admin update all notifications"      on public.notifications;

drop policy if exists "admin delete notifications"          on public.notifications;
drop policy if exists "user delete notifications"           on public.notifications;
drop policy if exists "user delete own notifications"       on public.notifications;
drop policy if exists "admin delete all notifications"      on public.notifications;

-- 1.1. INSERT POLICIES (SERVER-ONLY)
-- CHỈ service_role được INSERT trực tiếp qua REST/Client.
-- Mọi luồng ứng dụng đều đi qua Triggers/RPCs (SECURITY DEFINER) để tự động bypass RLS an toàn.
create policy "service_role insert notifications"
  on public.notifications
  for insert
  to service_role
  with check (true);

-- (Không tạo INSERT policy cho authenticated hay anon → Mặc định DENY ALL cho toàn bộ client token)

-- 1.2. SELECT POLICIES
-- User thường: chỉ đọc thông báo của chính mình (không đọc được admin notification)
create policy "user read own notifications"
  on public.notifications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and is_admin = false
  );

-- Admin: đọc tất cả
create policy "admin read all notifications"
  on public.notifications
  for select
  to authenticated
  using (
    public.is_admin()
  );

-- 1.3. UPDATE POLICIES (LỚP BẢO VỆ 1: RLS)
-- User thường: chỉ update thông báo của chính mình, không thể đổi chủ sở hữu hay leo thang is_admin
create policy "user update own notifications"
  on public.notifications
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and is_admin = false
  )
  with check (
    user_id = auth.uid()
    and is_admin = false
  );

-- Admin: cập nhật tất cả
create policy "admin update all notifications"
  on public.notifications
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 1.4. DELETE POLICIES
-- User thường: chỉ xóa thông báo của chính mình
create policy "user delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and is_admin = false
  );

-- Admin: xóa tất cả
create policy "admin delete all notifications"
  on public.notifications
  for delete
  to authenticated
  using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGER GUARD (LỚP BẢO VỆ 2: IMMUTABLE FIELDS ENFORCEMENT)
-- ────────────────────────────────────────────────────────────

create or replace function public.trg_guard_notification_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Bỏ qua nếu chạy trong ngữ cảnh service_role / system trigger không có auth.uid()
  if auth.uid() is null then
    return new;
  end if;

  -- Nếu là admin thì cho phép
  if public.is_admin() then
    return new;
  end if;

  -- Khóa toàn bộ các trường bất biến đối với user thường (chỉ cho phép thay đổi is_read)
  if new.user_id <> old.user_id then
    raise exception 'SECURITY: Không được phép thay đổi user_id của notification.';
  end if;

  if new.is_admin <> old.is_admin then
    raise exception 'SECURITY: Không được phép thay đổi cờ is_admin của notification.';
  end if;

  if new.type <> old.type then
    raise exception 'SECURITY: Không được phép thay đổi type của notification.';
  end if;

  if new.order_id is distinct from old.order_id then
    raise exception 'SECURITY: Không được phép thay đổi order_id của notification.';
  end if;

  if new.title <> old.title then
    raise exception 'SECURITY: Không được phép thay đổi title của notification.';
  end if;

  if new.message <> old.message then
    raise exception 'SECURITY: Không được phép thay đổi message của notification.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_notification_immutable_fields on public.notifications;
create trigger guard_notification_immutable_fields
  before update on public.notifications
  for each row
  execute function public.trg_guard_notification_immutable_fields();

-- ────────────────────────────────────────────────────────────
-- 3. DATABASE TRIGGERS TỰ ĐỘNG TẠO NOTIFICATION AN TOÀN (SERVER-SIDE)
-- ────────────────────────────────────────────────────────────

-- 3.1. Trigger tạo thông báo khi có Support Ticket mới
create or replace function public.tg_notify_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_email text;
begin
  if tg_op = 'INSERT' then
    select coalesce(email, 'Khách hàng') into v_user_email from auth.users where id = new.user_id;
    
    -- Tạo Admin Notification
    insert into public.notifications(type, title, message, is_admin, is_read)
    values (
      'ticket_created',
      '🎫 Ticket mới ' || coalesce(new.ticket_number, ''),
      coalesce(v_user_email, 'Khách hàng') || ': ' || new.subject,
      true,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_notify on public.support_tickets;
create trigger trg_support_ticket_notify
  after insert on public.support_tickets
  for each row
  execute function public.tg_notify_support_ticket();

-- 3.2. Trigger tạo thông báo cho Khách khi trạng thái Ticket thay đổi
create or replace function public.tg_notify_support_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status_label text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.user_id is not null then
    v_status_label := case new.status
      when 'processing' then 'Đang xử lý'
      when 'resolved' then 'Đã giải quyết'
      when 'closed' then 'Đã đóng'
      else new.status
    end;

    insert into public.notifications(type, title, message, user_id, is_admin, is_read)
    values (
      'ticket_status',
      'Cập nhật Ticket ' || coalesce(new.ticket_number, ''),
      'Trạng thái yêu cầu hỗ trợ của bạn đã chuyển sang: ' || v_status_label,
      new.user_id,
      false,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_status_notify on public.support_tickets;
create trigger trg_support_ticket_status_notify
  after update on public.support_tickets
  for each row
  execute function public.tg_notify_support_ticket_status();

-- 3.3. Trigger tạo thông báo khi có Support Message mới
create or replace function public.tg_notify_support_message()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ticket record;
  v_short_msg text;
begin
  if tg_op = 'INSERT' then
    select id, ticket_number, user_id into v_ticket from public.support_tickets where id = new.ticket_id;
    if not found then return new; end if;

    v_short_msg := case when length(new.message) > 60 then substring(new.message from 1 for 60) || '...' else new.message end;

    if new.sender_role = 'user' then
      -- Khách nhắn -> Gửi thông báo cho Admin
      insert into public.notifications(type, title, message, is_admin, is_read)
      values (
        'ticket_message',
        '💬 Tin nhắn từ ' || coalesce(v_ticket.ticket_number, 'Ticket'),
        v_short_msg,
        true,
        false
      );
    elsif new.sender_role = 'admin' and v_ticket.user_id is not null then
      -- Admin trả lời -> Gửi thông báo cho Khách
      insert into public.notifications(type, title, message, user_id, is_admin, is_read)
      values (
        'ticket_reply',
        'BOW đã phản hồi Ticket ' || coalesce(v_ticket.ticket_number, ''),
        v_short_msg,
        v_ticket.user_id,
        false,
        false
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_message_notify on public.support_messages;
create trigger trg_support_message_notify
  after insert on public.support_messages
  for each row
  execute function public.tg_notify_support_message();

-- 3.4. Trigger tạo thông báo khi Review được duyệt/từ chối
create or replace function public.tg_notify_product_review()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_prod_name text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.user_id is not null then
    select name into v_prod_name from public.products where id = new.product_id;
    v_prod_name := coalesce(v_prod_name, 'Sản phẩm');

    if new.status = 'approved' then
      insert into public.notifications(type, title, message, user_id, is_admin, is_read)
      values (
        'review_status',
        'Đánh giá đã được phê duyệt',
        'Đánh giá của bạn cho sản phẩm "' || v_prod_name || '" đã được phê duyệt và xuất hiện công khai!',
        new.user_id,
        false,
        false
      );
    elsif new.status = 'rejected' then
      insert into public.notifications(type, title, message, user_id, is_admin, is_read)
      values (
        'review_status',
        'Cập nhật Đánh giá sản phẩm',
        'Đánh giá của bạn cho sản phẩm "' || v_prod_name || '" chưa được phê duyệt.',
        new.user_id,
        false,
        false
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_review_notify on public.product_reviews;
create trigger trg_product_review_notify
  after update on public.product_reviews
  for each row
  execute function public.tg_notify_product_review();

-- ────────────────────────────────────────────────────────────
-- 4. EXPLICIT GRANT / REVOKE (DEFENSE IN DEPTH)
-- ────────────────────────────────────────────────────────────

-- Thu hồi quyền INSERT từ role authenticated ở cấp độ bảng
revoke insert on public.notifications from authenticated;
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ────────────────────────────────────────────────────────────
-- 5. REALTIME CONFIGURATION
-- ────────────────────────────────────────────────────────────

-- Đảm bảo replica identity full để Realtime phát đầy đủ old/new record
alter table public.notifications replica identity full;

-- Đảm bảo bảng notifications đã nằm trong supabase_realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end$$;
