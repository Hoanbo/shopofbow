-- ============================================================
-- BOW — Migration 0005: notifications table
-- Chạy script này trong Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  -- Loại: 'new_order', 'order_completed', 'order_cancelled', 'order_processing', 'system'
  title       text not null,
  message     text not null,
  order_id    uuid references orders(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  -- user_id = null có nghĩa là thông báo dành cho Admin
  is_admin    boolean not null default false,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_is_admin_idx on notifications(is_admin);
create index if not exists notifications_is_read_idx on notifications(is_read);
create index if not exists notifications_created_at_idx on notifications(created_at desc);

-- RLS
alter table notifications enable row level security;

-- Admin xem tất cả notifications
drop policy if exists "admin read notifications" on notifications;
create policy "admin read notifications" on notifications
  for select to authenticated
  using (is_admin());

-- User xem thông báo của chính mình
drop policy if exists "user read own notifications" on notifications;
create policy "user read own notifications" on notifications
  for select to authenticated
  using (user_id = auth.uid() and is_admin = false);

-- Admin có thể cập nhật (đánh dấu đã đọc...)
drop policy if exists "admin update notifications" on notifications;
create policy "admin update notifications" on notifications
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- User cập nhật thông báo của chính mình
drop policy if exists "user update notifications" on notifications;
create policy "user update notifications" on notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_admin = false);

-- Admin xóa thông báo
drop policy if exists "admin delete notifications" on notifications;
create policy "admin delete notifications" on notifications
  for delete to authenticated
  using (is_admin());

-- User xóa thông báo của chính mình
drop policy if exists "user delete notifications" on notifications;
create policy "user delete notifications" on notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Service role có toàn quyền
drop policy if exists "service role all notifications" on notifications;
create policy "service role all notifications" on notifications
  for all to service_role using (true);

-- Authenticated insert: User thường chỉ chèn thông báo cho chính mình (is_admin = false), admin được chèn tất cả
drop policy if exists "authenticated insert notifications" on notifications;
create policy "authenticated insert notifications" on notifications
  for insert to authenticated
  with check ((is_admin = false and user_id = auth.uid()) or is_admin());

-- Bật Realtime cho bảng notifications (an toàn khi chạy lại)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end$$;
