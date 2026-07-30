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

-- Admin (authenticated users with admin email) xem thông báo is_admin=true
drop policy if exists "admin read notifications" on notifications;
create policy "admin read notifications" on notifications
  for select to authenticated
  using (is_admin = true);

-- Admin có thể cập nhật (đánh dấu đã đọc)
drop policy if exists "admin update notifications" on notifications;
create policy "admin update notifications" on notifications
  for update to authenticated
  using (is_admin = true);

-- User xem thông báo của chính mình
drop policy if exists "user read own notifications" on notifications;
create policy "user read own notifications" on notifications
  for select to authenticated
  using (user_id = auth.uid() and is_admin = false);

-- Service role có toàn quyền (để insert từ edge function hoặc trigger)
drop policy if exists "service role all notifications" on notifications;
create policy "service role all notifications" on notifications
  for all to service_role using (true);

-- Authenticated có thể insert (Frontend tạo thông báo admin sau khi đặt hàng)
drop policy if exists "authenticated insert notifications" on notifications;
create policy "authenticated insert notifications" on notifications
  for insert to authenticated with check (true);

-- Bật Realtime cho bảng notifications
alter publication supabase_realtime add table notifications;
