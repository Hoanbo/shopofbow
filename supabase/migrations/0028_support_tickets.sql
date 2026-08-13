-- ============================================================
-- BOW — Migration 0028: support_tickets & support_messages
-- Chạy script này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Sequence cho ticket_number (#BOW-1001, #BOW-1002...)
create sequence if not exists support_ticket_number_seq start with 1001;

-- 2. Bảng support_tickets
create table if not exists support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id       uuid not null references profiles(id) on delete cascade,
  order_id      uuid null references orders(id) on delete set null,
  subject       text not null,
  status        text not null default 'pending' check (status in ('pending', 'processing', 'resolved', 'closed')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz null
);

create index if not exists support_tickets_user_id_idx on support_tickets(user_id);
create index if not exists support_tickets_order_id_idx on support_tickets(order_id);
create index if not exists support_tickets_status_idx on support_tickets(status);
create index if not exists support_tickets_created_at_idx on support_tickets(created_at desc);

-- Trigger tự động tạo ticket_number (#BOW-XXXX) nếu trống
create or replace function generate_support_ticket_number()
returns trigger language plpgsql as $$
begin
  if NEW.ticket_number is null or NEW.ticket_number = '' then
    NEW.ticket_number := 'BOW-' || lpad(nextval('support_ticket_number_seq')::text, 4, '0');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_generate_support_ticket_number on support_tickets;
create trigger trigger_generate_support_ticket_number
  before insert on support_tickets
  for each row execute function generate_support_ticket_number();

-- 3. Bảng support_messages
create table if not exists support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  message     text not null,
  attachments jsonb null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_ticket_id_idx on support_messages(ticket_id);
create index if not exists support_messages_created_at_idx on support_messages(created_at asc);

-- Trigger khi có message mới: Cập nhật updated_at của ticket, nếu ticket đã resolved mà user nhắn mới -> chuyển về processing
create or replace function on_support_message_inserted()
returns trigger language plpgsql security definer as $$
declare
  t_status text;
begin
  select status into t_status from support_tickets where id = NEW.ticket_id;
  
  if NEW.sender_role = 'user' and t_status = 'resolved' then
    update support_tickets 
    set updated_at = now(), status = 'processing'
    where id = NEW.ticket_id;
  else
    update support_tickets 
    set updated_at = now()
    where id = NEW.ticket_id;
  end if;
  
  return NEW;
end;
$$;

drop trigger if exists trigger_on_support_message_inserted on support_messages;
create trigger trigger_on_support_message_inserted
  after insert on support_messages
  for each row execute function on_support_message_inserted();

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table support_tickets enable row level security;
alter table support_messages enable row level security;

-- --- RLS cho support_tickets ---

-- Admin đọc tất cả, User đọc ticket của chính mình
drop policy if exists "select support_tickets" on support_tickets;
create policy "select support_tickets" on support_tickets
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- User chỉ chèn ticket của chính mình (user_id = auth.uid()), Admin chèn tất cả
drop policy if exists "insert support_tickets" on support_tickets;
create policy "insert support_tickets" on support_tickets
  for insert to authenticated
  with check ((user_id = auth.uid() and not is_admin()) or is_admin());

-- User cập nhật ticket của mình, Admin cập nhật tất cả
drop policy if exists "update support_tickets" on support_tickets;
create policy "update support_tickets" on support_tickets
  for update to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- Admin xóa ticket
drop policy if exists "delete support_tickets" on support_tickets;
create policy "delete support_tickets" on support_tickets
  for delete to authenticated
  using (is_admin());

-- Service role full access
drop policy if exists "service_role all support_tickets" on support_tickets;
create policy "service_role all support_tickets" on support_tickets
  for all to service_role using (true);


-- --- RLS cho support_messages ---

-- User chỉ đọc message của ticket thuộc sở hữu của mình, Admin đọc tất cả
drop policy if exists "select support_messages" on support_messages;
create policy "select support_messages" on support_messages
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from support_tickets t
      where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    )
  );

-- User chỉ chèn message cho ticket của mình (sender_id = auth.uid()), Admin chèn tất cả
drop policy if exists "insert support_messages" on support_messages;
create policy "insert support_messages" on support_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and (
      is_admin() or exists (
        select 1 from support_tickets t
        where t.id = support_messages.ticket_id and t.user_id = auth.uid()
      )
    )
  );

-- Admin sửa/xóa message
drop policy if exists "update support_messages" on support_messages;
create policy "update support_messages" on support_messages
  for update to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "delete support_messages" on support_messages;
create policy "delete support_messages" on support_messages
  for delete to authenticated
  using (is_admin());

-- Service role full access
drop policy if exists "service_role all support_messages" on support_messages;
create policy "service_role all support_messages" on support_messages
  for all to service_role using (true);

-- ============================================================
-- 5. BẬT REALTIME CHO TICKETS & MESSAGES
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table support_tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table support_messages;
  end if;
end$$;
