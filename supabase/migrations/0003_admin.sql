-- ============================================================
-- BOW — Let's Connect · Admin write access + Storage
-- Grants authenticated users full CRUD on all tables, and sets
-- up a public "assets" storage bucket for logo/banner uploads.
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Write policies: any authenticated user is treated as admin.
-- (Sign-ups are disabled in Supabase Auth settings so only
--  invited/created users can log in.)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_plans',
    'product_features','faqs','contact_settings'
  ]
  loop
    execute format('drop policy if exists "admin insert %1$s" on %1$s;', t);
    execute format('drop policy if exists "admin update %1$s" on %1$s;', t);
    execute format('drop policy if exists "admin delete %1$s" on %1$s;', t);

    execute format(
      'create policy "admin insert %1$s" on %1$s for insert to authenticated with check (true);', t
    );
    execute format(
      'create policy "admin update %1$s" on %1$s for update to authenticated using (true) with check (true);', t
    );
    execute format(
      'create policy "admin delete %1$s" on %1$s for delete to authenticated using (true);', t
    );
  end loop;
end$$;

-- ------------------------------------------------------------
-- Storage bucket for uploaded logos / banners
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Public read of the assets bucket; authenticated users manage files.
drop policy if exists "assets public read" on storage.objects;
create policy "assets public read"
  on storage.objects for select
  using (bucket_id = 'assets');

drop policy if exists "assets admin insert" on storage.objects;
create policy "assets admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assets');

drop policy if exists "assets admin update" on storage.objects;
create policy "assets admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'assets') with check (bucket_id = 'assets');

drop policy if exists "assets admin delete" on storage.objects;
create policy "assets admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'assets');
