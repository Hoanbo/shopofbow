-- ============================================================================
-- BOW — Migration 0057: ADD COST PRICE & FULL CATALOG SYNC
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. Thêm cột cost_price vào bảng products và product_plans nếu chưa có
alter table public.products add column if not exists cost_price numeric default null;
alter table public.product_plans add column if not exists cost_price numeric default null;

create index if not exists idx_products_cost_price on public.products(cost_price);
create index if not exists idx_product_plans_cost_price on public.product_plans(cost_price);

-- 2. ĐẢM BẢO CÁC CATEGORIES CẦN THIẾT TỒN TẠI
insert into public.categories (id, name, slug, type, sort_order, is_active)
values 
  ('607b85cf-e110-4870-8577-746eb0f972cd', 'AI Tools', 'ai-tools', 'ai-tool', 1, true),
  ('9f0fab3e-9680-48ba-b05d-4d03ac5052af', 'Premium Apps', 'premium-apps', 'premium-app', 2, true),
  ('763a7843-015f-41bc-b54b-6bca28a9a0ef', 'Featured Products', 'products', 'product', 3, true)
on conflict (id) do update set is_active = true;

-- 3. HÀM HELPER ĐỒNG BỘ PRODUCT VÀ PLANS
create or replace function public.sync_product_and_plans(
  p_name text,
  p_slug text,
  p_category_slug text,
  p_base_price numeric,
  p_ctv_price numeric,
  p_cost_price numeric,
  p_affiliate_rate numeric,
  p_plans jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prod_id uuid;
  v_cat_id uuid;
  v_type text;
  v_plan jsonb;
  v_plan_id uuid;
begin
  select id, coalesce(type::text, 'premium-app') into v_cat_id, v_type from public.categories where slug = p_category_slug;
  if v_cat_id is null then
    select id, coalesce(type::text, 'premium-app') into v_cat_id, v_type from public.categories limit 1;
  end if;
  if v_type is null then
    v_type := 'premium-app';
  end if;

  -- 1. Tìm hoặc tạo Product (giữ nguyên ID cũ)
  select id into v_prod_id from public.products where slug = p_slug;

  if v_prod_id is null then
    insert into public.products (
      name, slug, category_id, type, short_description, description,
      base_price, price_ctv, cost_price, affiliate_enabled, affiliate_type, affiliate_reward,
      is_active, is_featured
    ) values (
      p_name, p_slug, v_cat_id, v_type::public.product_type,
      'Tài khoản ' || p_name || ' chính hãng giá tốt, bảo hành uy tín tại BOW.',
      'Dịch vụ tài khoản và gói nâng cấp ' || p_name || ' chính hãng. Kích hoạt nhanh chóng, hỗ trợ 24/7.',
      p_base_price, p_ctv_price, p_cost_price, true, 'percent', p_affiliate_rate,
      true, false
    ) returning id into v_prod_id;
  else
    update public.products
    set 
      base_price = p_base_price,
      price_ctv = p_ctv_price,
      cost_price = p_cost_price,
      affiliate_enabled = true,
      affiliate_type = 'percent',
      affiliate_reward = p_affiliate_rate
    where id = v_prod_id;
  end if;

  -- 2. Cập nhật hoặc tạo các Plans
  for v_plan in select * from jsonb_array_elements(p_plans)
  loop
    select id into v_plan_id from public.product_plans 
    where product_id = v_prod_id 
      and (name = (v_plan->>'name') or duration = (v_plan->>'duration'));

    if v_plan_id is not null then
      update public.product_plans
      set
        name = (v_plan->>'name'),
        duration = (v_plan->>'duration'),
        price = (v_plan->>'price')::numeric,
        price_ctv = (v_plan->>'price_ctv')::numeric,
        cost_price = (v_plan->>'cost_price')::numeric,
        badge = (v_plan->>'badge'),
        notes = case when (v_plan->>'warranty') is not null then 'Bảo hành: ' || (v_plan->>'warranty') else null end,
        is_active = true
      where id = v_plan_id;
    else
      insert into public.product_plans (
        product_id, name, duration, price, price_ctv, cost_price, badge, notes, is_active, sort_order
      ) values (
        v_prod_id,
        (v_plan->>'name'),
        (v_plan->>'duration'),
        (v_plan->>'price')::numeric,
        (v_plan->>'price_ctv')::numeric,
        (v_plan->>'cost_price')::numeric,
        (v_plan->>'badge'),
        case when (v_plan->>'warranty') is not null then 'Bảo hành: ' || (v_plan->>'warranty') else null end,
        true,
        coalesce((select count(*) from public.product_plans where product_id = v_prod_id), 0) + 1
      );
    end if;
  end loop;

  return v_prod_id;
end;
$$;

-- 4. THỰC THI ĐỒNG BỘ TOÀN BỘ 54 MỤC CATALOG ĐÃ ĐƯỢC DUYỆT

-- 1. CapCut Pro
select public.sync_product_and_plans(
  'CapCut Pro', 'capcut-pro', 'products', 15000, 12000, 3000, 10,
  '[
    {"name": "1 tuần", "duration": "7 ngày", "warranty": "Full thời gian", "cost_price": 3000, "price": 15000, "price_ctv": 12000, "badge": "Gói tuần"},
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 40000, "price": 79000, "price_ctv": 69000, "badge": "Phổ biến"},
    {"name": "6 tháng", "duration": "180 ngày", "warranty": "Full thời gian", "cost_price": 320000, "price": 429000, "price_ctv": 389000, "badge": "Tiết kiệm"}
  ]'::jsonb
);

-- 2. Netflix Premium & Extra Member
select public.sync_product_and_plans(
  'Netflix Premium', 'netflix-premium', 'premium-apps', 45000, 39000, 20000, 8,
  '[
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 20000, "price": 45000, "price_ctv": 39000, "badge": "Bán chạy"},
    {"name": "Extra Member 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 70000, "price": 119000, "price_ctv": 105000, "badge": "Chính chủ"}
  ]'::jsonb
);

-- 3. Canva Pro
select public.sync_product_and_plans(
  'Canva Pro', 'canva-pro', 'products', 25000, 22000, 10000, 8,
  '[
    {"name": "Slot 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 10000, "price": 25000, "price_ctv": 22000, "badge": "Slot riêng"},
    {"name": "Slot Edu 1 năm", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 29000, "price": 59000, "price_ctv": 52000, "badge": "Edu 1 năm"},
    {"name": "Admin Business 100 Slot (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 49000, "price": 79000, "price_ctv": 69000, "badge": "Admin 100 Slot"},
    {"name": "Admin Business 100 Slot (3 tháng)", "duration": "90 ngày", "warranty": "Full thời gian", "cost_price": 55000, "price": 119000, "price_ctv": 105000, "badge": "Admin 100 Slot"}
  ]'::jsonb
);

-- 4. Adobe Full Apps
select public.sync_product_and_plans(
  'Adobe Full Apps', 'adobe-full-apps', 'premium-apps', 119000, 105000, 65000, 6,
  '[
    {"name": "2 tháng (BH 24H)", "duration": "60 ngày", "warranty": "24 Giờ", "cost_price": 65000, "price": 119000, "price_ctv": 105000, "badge": "Creative Cloud"}
  ]'::jsonb
);

-- 5. YouTube Premium
select public.sync_product_and_plans(
  'YouTube Premium', 'youtube-premium', 'premium-apps', 59000, 52000, 35000, 8,
  '[
    {"name": "Slot 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 35000, "price": 59000, "price_ctv": 52000, "badge": "Gói 1 tháng"},
    {"name": "Slot 3 tháng", "duration": "90 ngày", "warranty": "Full thời gian", "cost_price": 119000, "price": 189000, "price_ctv": 169000, "badge": "Gói 3 tháng"},
    {"name": "Slot 6 tháng", "duration": "180 ngày", "warranty": "Full thời gian", "cost_price": 219000, "price": 339000, "price_ctv": 309000, "badge": "Gói 6 tháng"},
    {"name": "Slot 12 tháng", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 450000, "price": 649000, "price_ctv": 589000, "badge": "Gói 1 năm"}
  ]'::jsonb
);

-- 6. Google One AI Pro 5TB
select public.sync_product_and_plans(
  'Google One AI Pro 5TB', 'google-ai-pro-5tb', 'ai-tools', 119000, 105000, 75000, 6,
  '[
    {"name": "Nâng chính chủ 1 năm (BH 1 tháng)", "duration": "365 ngày", "warranty": "1 tháng", "cost_price": 75000, "price": 119000, "price_ctv": 105000, "badge": "5TB Chính chủ"},
    {"name": "Nâng chính chủ 1 năm (BH Full 1 năm)", "duration": "365 ngày", "warranty": "Full 1 năm", "cost_price": 399000, "price": 529000, "price_ctv": 479000, "badge": "Full BH 1 năm"}
  ]'::jsonb
);

-- 7. Gemini AI Pro
select public.sync_product_and_plans(
  'Gemini Pro', 'gemini-pro', 'ai-tools', 79000, 69000, 49000, 7,
  '[
    {"name": "Slot 1 năm (BH 1 tháng)", "duration": "365 ngày", "warranty": "1 tháng", "cost_price": 49000, "price": 79000, "price_ctv": 69000, "badge": "BH 1 tháng"},
    {"name": "Slot 1 năm (BH 3 tháng)", "duration": "365 ngày", "warranty": "3 tháng", "cost_price": 69000, "price": 119000, "price_ctv": 105000, "badge": "BH 3 tháng"},
    {"name": "Slot 1 năm (BH 6 tháng)", "duration": "365 ngày", "warranty": "6 tháng", "cost_price": 99000, "price": 149000, "price_ctv": 135000, "badge": "BH 6 tháng"},
    {"name": "Slot Gemini Pro + GG 5TB (1 năm)", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 50000, "price": 79000, "price_ctv": 69000, "badge": "Combo 5TB"}
  ]'::jsonb
);

-- 8. Wink VIP+
select public.sync_product_and_plans(
  'Wink VIP+', 'wink-vip', 'premium-apps', 45000, 39000, 20000, 8,
  '[
    {"name": "1 tuần", "duration": "7 ngày", "warranty": "Full thời gian", "cost_price": 20000, "price": 45000, "price_ctv": 39000, "badge": "Gói tuần"},
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 75000, "price": 119000, "price_ctv": 105000, "badge": "Gói tháng"}
  ]'::jsonb
);

-- 9. MeiTu SVIP
select public.sync_product_and_plans(
  'Meitu SVIP', 'meitu-svip', 'products', 45000, 39000, 25000, 8,
  '[
    {"name": "1 tuần", "duration": "7 ngày", "warranty": "Full thời gian", "cost_price": 25000, "price": 45000, "price_ctv": 39000, "badge": "Gói tuần"},
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 65000, "price": 119000, "price_ctv": 105000, "badge": "Gói tháng"}
  ]'::jsonb
);

-- 10. XingTu VIP
select public.sync_product_and_plans(
  'XingTu', 'xingtu', 'premium-apps', 149000, 135000, 85000, 6,
  '[
    {"name": "VIP 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 85000, "price": 149000, "price_ctv": 135000, "badge": "XingTu VIP"}
  ]'::jsonb
);

-- 11. Kling AI
select public.sync_product_and_plans(
  'Kling AI', 'kling-ai', 'ai-tools', 15000, 12000, 4000, 10,
  '[
    {"name": "65 Credit", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 4000, "price": 15000, "price_ctv": 12000, "badge": "65 Cre"},
    {"name": "Random 600-1.100 Credit", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 210000, "price": 339000, "price_ctv": 309000, "badge": "600-1100 Cre"},
    {"name": "3.300 Credit (BH 7 ngày)", "duration": "30 ngày", "warranty": "7 ngày", "cost_price": 650000, "price": 899000, "price_ctv": 819000, "badge": "3300 Credit"}
  ]'::jsonb
);

-- 12. Perplexity AI Pro
select public.sync_product_and_plans(
  'Perplexity Pro', 'perplexity-pro', 'ai-tools', 279000, 249000, 180000, 5,
  '[
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 180000, "price": 279000, "price_ctv": 249000, "badge": "1 tháng"},
    {"name": "10-11 tháng", "duration": "330 ngày", "warranty": "Full thời gian", "cost_price": 1800000, "price": 2249000, "price_ctv": 2020000, "badge": "Gói năm"}
  ]'::jsonb
);

-- 13. Microsoft 365 Family
select public.sync_product_and_plans(
  'Microsoft 365 Family', 'microsoft-365-family', 'premium-apps', 229000, 209000, 150000, 5,
  '[
    {"name": "Slot 1 năm", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 150000, "price": 229000, "price_ctv": 209000, "badge": "1TB OneDrive"}
  ]'::jsonb
);

-- 14. API CODEX
select public.sync_product_and_plans(
  'API CODEX', 'api-codex', 'ai-tools', 79000, 69000, 40000, 7,
  '[
    {"name": "10M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 40000, "price": 79000, "price_ctv": 69000, "badge": "10M"},
    {"name": "50M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 70000, "price": 119000, "price_ctv": 105000, "badge": "50M"},
    {"name": "100M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 110000, "price": 189000, "price_ctv": 169000, "badge": "100M"}
  ]'::jsonb
);

-- 15. API Claude
select public.sync_product_and_plans(
  'API Claude', 'api-claude', 'ai-tools', 79000, 69000, 40000, 7,
  '[
    {"name": "10M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 40000, "price": 79000, "price_ctv": 69000, "badge": "10M"},
    {"name": "50M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 99000, "price": 149000, "price_ctv": 135000, "badge": "50M"},
    {"name": "100M Token", "duration": "1 ngày", "warranty": "Full thời gian", "cost_price": 130000, "price": 189000, "price_ctv": 169000, "badge": "100M"}
  ]'::jsonb
);

-- 16. ElevenLabs
select public.sync_product_and_plans(
  'ElevenLabs', 'elevenlabs', 'ai-tools', 279000, 249000, 180000, 5,
  '[
    {"name": "Redeem 300K Credit (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 180000, "price": 279000, "price_ctv": 249000, "badge": "300K Credit"},
    {"name": "Redeem 1M Credit (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 389000, "price": 529000, "price_ctv": 479000, "badge": "1M Credit"}
  ]'::jsonb
);

-- 17. Autodesk All Apps
select public.sync_product_and_plans(
  'Autodesk All Apps', 'autodesk-all-apps', 'premium-apps', 189000, 169000, 120000, 5,
  '[
    {"name": "3 năm (BH 1 năm)", "duration": "1095 ngày", "warranty": "1 năm", "cost_price": 120000, "price": 189000, "price_ctv": 169000, "badge": "3 Năm"}
  ]'::jsonb
);

-- 18. Memrise Pro
select public.sync_product_and_plans(
  'Memrise Pro', 'memrise-pro', 'premium-apps', 429000, 389000, 300000, 5,
  '[
    {"name": "Lifetime 20 năm (BH 1 tháng)", "duration": "7300 ngày", "warranty": "1 tháng", "cost_price": 300000, "price": 429000, "price_ctv": 389000, "badge": "Lifetime"}
  ]'::jsonb
);

-- 19. iCloud+ Apple Storage
select public.sync_product_and_plans(
  'iCloud+ Apple Storage', 'iclou-storage', 'premium-apps', 189000, 169000, 120000, 5,
  '[
    {"name": "Slot 2TB (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 120000, "price": 189000, "price_ctv": 169000, "badge": "2TB"},
    {"name": "Slot 400GB (1 năm)", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 650000, "price": 899000, "price_ctv": 819000, "badge": "400GB 1 Năm"}
  ]'::jsonb
);

-- 20. ChatGPT Plus & Team Business
select public.sync_product_and_plans(
  'ChatGPT Plus', 'chatgpt-plus', 'ai-tools', 649000, 589000, 450000, 5,
  '[
    {"name": "ChatGPT Team Business 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 450000, "price": 649000, "price_ctv": 589000, "badge": "Team Business"}
  ]'::jsonb
);

-- 21. Super Duolingo
select public.sync_product_and_plans(
  'Super Duolingo', 'super-duolingo', 'premium-apps', 339000, 309000, 250000, 5,
  '[
    {"name": "Nâng chính chủ 1 năm", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 250000, "price": 339000, "price_ctv": 309000, "badge": "Chính chủ"}
  ]'::jsonb
);

-- 22. NOTION
select public.sync_product_and_plans(
  'NOTION', 'notion', 'ai-tools', 649000, 589000, 450000, 5,
  '[
    {"name": "Notion Business 6 tháng", "duration": "180 ngày", "warranty": "Full thời gian", "cost_price": 450000, "price": 649000, "price_ctv": 589000, "badge": "Business 6T"}
  ]'::jsonb
);

-- 23. Cursor Pro
select public.sync_product_and_plans(
  'Cursor Pro', 'cursor-pro', 'ai-tools', 339000, 309000, 220000, 5,
  '[
    {"name": "API 2.600 Credit (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 220000, "price": 339000, "price_ctv": 309000, "badge": "2600 Cre"},
    {"name": "API 6.500 Credit (1 tháng)", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 309000, "price": 429000, "price_ctv": 389000, "badge": "6500 Cre"}
  ]'::jsonb
);

-- 24. Spotify Premium
select public.sync_product_and_plans(
  'Spotify Premium', 'spotify-premium', 'premium-apps', 79000, 69000, 40000, 7,
  '[
    {"name": "Nâng chính chủ 1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 40000, "price": 79000, "price_ctv": 69000, "badge": "Chính chủ"},
    {"name": "Nâng chính chủ 3 tháng", "duration": "90 ngày", "warranty": "Full thời gian", "cost_price": 100000, "price": 149000, "price_ctv": 135000, "badge": "Chính chủ"},
    {"name": "Nâng chính chủ 6 tháng", "duration": "180 ngày", "warranty": "Full thời gian", "cost_price": 200000, "price": 279000, "price_ctv": 249000, "badge": "Chính chủ"},
    {"name": "Nâng chính chủ 1 năm", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 300000, "price": 429000, "price_ctv": 389000, "badge": "Chính chủ"}
  ]'::jsonb
);

-- 25. Figma Pro
select public.sync_product_and_plans(
  'Figma Pro', 'figma-pro', 'premium-apps', 279000, 249000, 200000, 5,
  '[
    {"name": "1 năm", "duration": "365 ngày", "warranty": "Full thời gian", "cost_price": 200000, "price": 279000, "price_ctv": 249000, "badge": "1 Năm"}
  ]'::jsonb
);

-- 26. Proton Unlimited
select public.sync_product_and_plans(
  'Proton Unlimited', 'proton-unlimited', 'premium-apps', 79000, 69000, 49000, 7,
  '[
    {"name": "1 tháng", "duration": "30 ngày", "warranty": "Full thời gian", "cost_price": 49000, "price": 79000, "price_ctv": 69000, "badge": "1 Tháng"}
  ]'::jsonb
);
