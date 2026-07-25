-- ============================================================
-- BOW — Let's Connect · Seed data
-- Mirrors the original static catalog so the UI is unchanged.
-- Idempotent: safe to re-run.
-- ============================================================

-- Categories ---------------------------------------------------
insert into categories (name, slug, type, sort_order) values
  ('AI Tools',          'ai-tools',      'ai-tool',     1),
  ('Premium Apps',      'premium-apps',  'premium-app', 2),
  ('Featured Products', 'products',      'product',     3)
on conflict (slug) do nothing;

-- ============================================================
-- Helper: seed a product with plans + features in one block
-- ============================================================
do $$
declare
  cat_ai   uuid;
  cat_app  uuid;
  cat_prod uuid;
  pid      uuid;
begin
  select id into cat_ai   from categories where slug = 'ai-tools';
  select id into cat_app  from categories where slug = 'premium-apps';
  select id into cat_prod from categories where slug = 'products';

  -- ---------- helper as inline procedure via temp function ----------
  -- (declared per-product below through explicit inserts)

  -- ===================== AI TOOLS =====================

  -- ChatGPT Plus
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_ai, 'ChatGPT Plus', 'chatgpt-plus',
    'Tài khoản ChatGPT Plus chính chủ, dùng GPT-4o không giới hạn.',
    'Nâng cấp ChatGPT Plus với quyền truy cập GPT-4o, tốc độ phản hồi nhanh, tạo ảnh DALL·E, phân tích file và duyệt web. Bảo hành trọn gói thời gian sử dụng.',
    '/assets/chatgpt.png', 'ai-tool', '#10a37f', 'Bán chạy', 149000, 500000, 4.9, 3200, true, 1)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 149000, 500000, false, 1),
      (pid, '3 tháng', '90 ngày', 399000, 1500000, true, 2),
      (pid, '1 năm', '365 ngày', 1290000, 6000000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'GPT-4o không giới hạn', 1),
      (pid, 'Tạo ảnh DALL·E 3', 2),
      (pid, 'Duyệt web & phân tích file', 3),
      (pid, 'Bảo hành 1-1', 4);
  end if;

  -- Claude Pro
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_ai, 'Claude Pro', 'claude-pro',
    'Claude Pro với cửa sổ ngữ cảnh lớn, lý tưởng cho code & viết dài.',
    'Claude Pro của Anthropic mạnh về lập trình, phân tích tài liệu dài và viết nội dung tự nhiên. Ưu tiên truy cập giờ cao điểm và giới hạn sử dụng cao gấp 5 lần.',
    '/assets/claude.jpg', 'ai-tool', '#d97757', 'Cho lập trình', 159000, 520000, 4.9, 1800, true, 2)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 159000, 520000, false, 1),
      (pid, '3 tháng', '90 ngày', 429000, 1560000, true, 2),
      (pid, '1 năm', '365 ngày', 1390000, 6240000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Claude 3.5 Sonnet', 1),
      (pid, 'Ngữ cảnh 200K token', 2),
      (pid, 'Ưu tiên giờ cao điểm', 3),
      (pid, 'Projects & Artifacts', 4);
  end if;

  -- Gemini Advanced
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_ai, 'Gemini Advanced', 'gemini-advanced',
    'Gemini Advanced kèm 2TB lưu trữ Google One.',
    'Google Gemini Advanced với mô hình 1.5 Pro, tích hợp Gmail, Docs, và 2TB dung lượng Google One. Xử lý ngữ cảnh cực dài và đa phương thức.',
    '/assets/gemini.jpg', 'ai-tool', '#4285f4', 139000, 480000, 4.8, 1500, 3)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 139000, 480000, false, 1),
      (pid, '3 tháng', '90 ngày', 379000, 1440000, true, 2),
      (pid, '1 năm', '365 ngày', 1190000, 5760000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Gemini 1.5 Pro', 1),
      (pid, '2TB Google One', 2),
      (pid, 'Tích hợp Workspace', 3),
      (pid, 'Deep Research', 4);
  end if;

  -- Grok Premium
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_ai, 'Grok Premium', 'grok-premium',
    'Grok Premium truy cập realtime dữ liệu trên X.',
    'Grok từ xAI với khả năng truy cập thông tin realtime, phong cách trả lời hài hước và tạo ảnh Aurora. Tích hợp trực tiếp trong nền tảng X.',
    '/assets/grok.png', 'ai-tool', '#111827', 129000, 450000, 4.7, 940, 4)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 129000, 450000, false, 1),
      (pid, '3 tháng', '90 ngày', 349000, 1350000, true, 2),
      (pid, '1 năm', '365 ngày', 1090000, 5400000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Grok-2 mới nhất', 1),
      (pid, 'Dữ liệu realtime X', 2),
      (pid, 'Tạo ảnh Aurora', 3),
      (pid, 'Không giới hạn', 4);
  end if;

  -- Perplexity Pro
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_ai, 'Perplexity Pro', 'perplexity-pro',
    'Perplexity Pro với nhiều mô hình AI và tìm kiếm chuyên sâu.',
    'Perplexity Pro cho phép chọn GPT-4o, Claude 3.5, tìm kiếm Pro không giới hạn kèm trích dẫn nguồn rõ ràng. Lý tưởng cho nghiên cứu và học tập.',
    '/assets/perplexity.jpg', 'ai-tool', '#20808d', 119000, 420000, 4.8, 1120, 5)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 119000, 420000, false, 1),
      (pid, '3 tháng', '90 ngày', 319000, 1260000, true, 2),
      (pid, '1 năm', '365 ngày', 990000, 5040000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Chọn GPT-4o / Claude', 1),
      (pid, 'Pro Search không giới hạn', 2),
      (pid, 'Trích dẫn nguồn', 3),
      (pid, 'Tải file phân tích', 4);
  end if;

  -- Cursor Pro
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_ai, 'Cursor Pro', 'cursor-pro',
    'Cursor Pro — trình soạn code tích hợp AI mạnh nhất.',
    'Cursor Pro tích hợp Claude 3.5 Sonnet và GPT-4o, tự động hoàn thành code, chat trong codebase và agent chỉnh sửa đa file. Tăng tốc độ code gấp nhiều lần.',
    '/assets/cursor.jpg', 'ai-tool', '#0ea5e9', 169000, 550000, 4.9, 760, 6)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 169000, 550000, false, 1),
      (pid, '3 tháng', '90 ngày', 459000, 1650000, true, 2),
      (pid, '1 năm', '365 ngày', 1490000, 6600000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Claude 3.5 + GPT-4o', 1),
      (pid, 'Autocomplete thông minh', 2),
      (pid, 'Agent đa file', 3),
      (pid, 'Chat trong codebase', 4);
  end if;

  -- ===================== PREMIUM APPS =====================

  -- Netflix Premium
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_app, 'Netflix Premium', 'netflix-premium',
    'Netflix Premium 4K, profile riêng, xem không quảng cáo.',
    'Tài khoản Netflix Premium chất lượng 4K Ultra HD, profile riêng bảo mật, xem phim và series bản quyền không giới hạn trên TV, điện thoại, máy tính.',
    '/assets/netflix.png', 'premium-app', '#e50914', 'HOT', 89000, 260000, 4.9, 5400, true, 1)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 89000, 260000, false, 1),
      (pid, '3 tháng', '90 ngày', 239000, 780000, true, 2),
      (pid, '1 năm', '365 ngày', 790000, 3120000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Chất lượng 4K UHD', 1),
      (pid, 'Profile riêng', 2),
      (pid, 'Không quảng cáo', 3),
      (pid, 'Bảo hành đầy đủ', 4);
  end if;

  -- Spotify Premium
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_app, 'Spotify Premium', 'spotify-premium',
    'Spotify Premium — nhạc chất lượng cao, tải offline.',
    'Spotify Premium nghe nhạc không quảng cáo, chất lượng cao, tải offline và tua bài không giới hạn. Kích hoạt chính chủ trên tài khoản của bạn.',
    '/assets/spotify.jpg', 'premium-app', '#1db954', 'HOT', 59000, 200000, 4.9, 6100, true, 2)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 59000, 200000, false, 1),
      (pid, '3 tháng', '90 ngày', 159000, 600000, true, 2),
      (pid, '1 năm', '365 ngày', 490000, 2400000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Không quảng cáo', 1),
      (pid, 'Chất lượng 320kbps', 2),
      (pid, 'Nghe offline', 3),
      (pid, 'Tua bài không giới hạn', 4);
  end if;

  -- YouTube Premium
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_app, 'YouTube Premium', 'youtube-premium',
    'YouTube Premium — xem không quảng cáo, phát nền.',
    'YouTube Premium xem video không quảng cáo, phát nền khi tắt màn hình, tải offline và kèm YouTube Music Premium miễn phí.',
    '/assets/youtube.jpg', 'premium-app', '#ff0000', 69000, 220000, 4.8, 4200, 3)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 69000, 220000, false, 1),
      (pid, '3 tháng', '90 ngày', 189000, 660000, true, 2),
      (pid, '1 năm', '365 ngày', 590000, 2640000, false, 3);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Không quảng cáo', 1),
      (pid, 'Phát nền', 2),
      (pid, 'Tải offline', 3),
      (pid, 'YouTube Music kèm theo', 4);
  end if;

  -- Locket Gold
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_app, 'Locket Gold', 'locket-gold',
    'Locket Gold mở khóa full tính năng widget ảnh.',
    'Locket Gold mở khóa toàn bộ tính năng: gửi ảnh không giới hạn, hiệu ứng, khung widget đẹp và lịch sử ảnh đầy đủ cho bạn bè và người thân.',
    '/assets/locket.png', 'premium-app', '#f5b301', 79000, 250000, 4.7, 980, 4)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 79000, 250000, false, 1),
      (pid, '1 năm', '365 ngày', 590000, 3000000, true, 2);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Gửi ảnh không giới hạn', 1),
      (pid, 'Hiệu ứng độc quyền', 2),
      (pid, 'Nhiều khung widget', 3),
      (pid, 'Lịch sử ảnh', 4);
  end if;

  -- ===================== PRODUCTS =====================

  -- Canva Pro
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_prod, 'Canva Pro', 'canva-pro',
    'Canva Pro — kho template, brand kit, xóa nền 1 chạm.',
    'Canva Pro mở khóa hàng triệu template, ảnh & font cao cấp, công cụ xóa nền Magic, Brand Kit và Magic Studio AI. Dùng cho cá nhân và team.',
    '/assets/canva.jpg', 'product', '#7c3aed', 'Bán chạy', 99000, 320000, 4.9, 3800, true, 1)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 99000, 320000, false, 1),
      (pid, '1 năm', '365 ngày', 690000, 3840000, true, 2);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Triệu+ template Pro', 1),
      (pid, 'Xóa nền Magic', 2),
      (pid, 'Brand Kit', 3),
      (pid, 'Magic Studio AI', 4);
  end if;

  -- CapCut Pro
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, badge, base_price, original_price, rating, sold, is_featured, sort_order)
  values (cat_prod, 'CapCut Pro', 'capcut-pro',
    'CapCut Pro — hiệu ứng, template và tính năng AI đầy đủ.',
    'CapCut Pro mở khóa toàn bộ hiệu ứng, template, kho nhạc bản quyền, xóa nền và các tính năng AI video. Xuất video 4K không watermark.',
    '/assets/capcut.png', 'product', '#000000', 'Bán chạy', 89000, 300000, 4.8, 2600, true, 2)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 89000, 300000, false, 1),
      (pid, '1 năm', '365 ngày', 650000, 3600000, true, 2);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Toàn bộ hiệu ứng Pro', 1),
      (pid, 'Xuất 4K không watermark', 2),
      (pid, 'Kho nhạc bản quyền', 3),
      (pid, 'AI video tools', 4);
  end if;

  -- Kling AI
  insert into products (category_id, name, slug, short_description, description, logo_url, type, accent, base_price, original_price, rating, sold, sort_order)
  values (cat_prod, 'Kling AI', 'kling-ai',
    'Kling AI — sinh video chất lượng cao từ prompt.',
    'Kling AI tạo video độ phân giải cao từ văn bản hoặc hình ảnh, mô phỏng chuyển động chân thực. Gói Pro cho thời lượng dài và render ưu tiên.',
    '/assets/kling.jpg', 'product', '#6366f1', 149000, 520000, 4.7, 540, 3)
  on conflict (slug) do nothing returning id into pid;
  if pid is not null then
    insert into product_plans (product_id, name, duration, price, original_price, is_highlight, sort_order) values
      (pid, '1 tháng', '30 ngày', 149000, 520000, false, 1),
      (pid, '3 tháng', '90 ngày', 399000, 1560000, true, 2);
    insert into product_features (product_id, feature, sort_order) values
      (pid, 'Text-to-video HD', 1),
      (pid, 'Image-to-video', 2),
      (pid, 'Render ưu tiên', 3),
      (pid, 'Video thời lượng dài', 4);
  end if;

end$$;

-- ============================================================
-- Global FAQs (product_id null = shown on Contact page)
-- ============================================================
insert into faqs (product_id, question, answer, sort_order) values
  (null, 'Sau khi thanh toán bao lâu thì nhận được tài khoản?',
   'Đa số đơn hàng được kích hoạt trong vòng 5–15 phút. Với các gói đặc biệt, thời gian tối đa là 24 giờ.', 1),
  (null, 'Sản phẩm có được bảo hành không?',
   'Tất cả sản phẩm đều được bảo hành trọn gói trong suốt thời gian sử dụng. Nếu có lỗi, BOW hỗ trợ đổi mới miễn phí.', 2),
  (null, 'Thanh toán bằng hình thức nào?',
   'Bạn có thể thanh toán qua chuyển khoản ngân hàng, Momo, ZaloPay. Liên hệ để nhận thông tin chi tiết.', 3)
on conflict do nothing;

-- ============================================================
-- Contact settings (single row)
-- ============================================================
insert into contact_settings (facebook_url, zalo_url, support_phone, support_email)
select 'https://m.me/bowletsconnect', 'https://zalo.me/0900000000', '0900 000 000', 'support@bowletsconnect.vn'
where not exists (select 1 from contact_settings);
