-- BOW — Migration 0049: Realtime Hardening - REPLICA IDENTITY FULL
-- Cho phép Supabase Realtime gửi toàn bộ thông tin bản ghi cũ (old record)
-- trong payload.old khi có UPDATE event thay vì chỉ gửi primary key (id).

alter table if exists public.orders replica identity full;
alter table if exists public.support_tickets replica identity full;
alter table if exists public.product_reviews replica identity full;
alter table if exists public.profiles replica identity full;
alter table if exists public.notifications replica identity full;
