-- ============================================================
-- BOW — Migration 0018: KHẮC PHỤC RLS VỚI BẢNG PRODUCT_PLANS, PRODUCTS, CATEGORIES
-- ============================================================

-- ── 1. ĐẢM BẢO HOANKB4@GMAIL.COM LUÔN CÓ TRONG BẢNG ADMINS ──
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'hoankb4@gmail.com'
on conflict (user_id) do nothing;

-- ── 2. CẬP NHẬT RLS CHÍNH XÁC CHO CÁC BẢNG CATALOG ──
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_plans',
    'product_features','faqs','contact_settings'
  ]
  loop
    execute format('alter table public.%1$s enable row level security;', t);

    execute format('drop policy if exists "public read %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin insert %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin update %1$s" on public.%1$s;', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$s;', t);

    -- Đọc công khai cho mọi người
    execute format('create policy "public read %1$s" on public.%1$s for select using (true);', t);

    -- Thêm/Sửa/Xóa dành cho Admin
    execute format('create policy "admin insert %1$s" on public.%1$s for insert to authenticated with check (is_admin());', t);
    execute format('create policy "admin update %1$s" on public.%1$s for update to authenticated using (is_admin()) with check (is_admin());', t);
    execute format('create policy "admin delete %1$s" on public.%1$s for delete to authenticated using (is_admin());', t);
  end loop;
end$$;
