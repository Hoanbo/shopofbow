import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CatalogItem {
  productName: string;
  productSlug: string;
  categorySlug: string;
  planName: string;
  duration: string;
  warranty: string;
  costPrice: number;
  retailPrice: number;
  ctvPrice: number;
  affiliateRate: number;
  badge?: string;
  usageType?: string;
}

const catalogDataset: CatalogItem[] = [
  // CapCut Pro
  { productName: 'CapCut Pro', productSlug: 'capcut-pro', categorySlug: 'products', planName: '1 tuần', duration: '7 ngày', warranty: 'Full thời gian', costPrice: 3000, retailPrice: 15000, ctvPrice: 12000, affiliateRate: 10, badge: 'Gói tuần' },
  { productName: 'CapCut Pro', productSlug: 'capcut-pro', categorySlug: 'products', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 40000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: 'Phổ biến' },
  { productName: 'CapCut Pro', productSlug: 'capcut-pro', categorySlug: 'products', planName: '6 tháng', duration: '180 ngày', warranty: 'Full thời gian', costPrice: 320000, retailPrice: 429000, ctvPrice: 389000, affiliateRate: 5, badge: 'Tiết kiệm' },

  // Netflix Premium
  { productName: 'Netflix Premium', productSlug: 'netflix-premium', categorySlug: 'premium-apps', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 20000, retailPrice: 45000, ctvPrice: 39000, affiliateRate: 8, badge: 'Bán chạy' },
  { productName: 'Netflix Extra Member', productSlug: 'netflix-premium', categorySlug: 'premium-apps', planName: 'Extra Member 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 70000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'Chính chủ' },

  // Canva
  { productName: 'Canva Pro', productSlug: 'canva-pro', categorySlug: 'products', planName: 'Slot 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 10000, retailPrice: 25000, ctvPrice: 22000, affiliateRate: 8, badge: 'Slot riêng' },
  { productName: 'Canva Pro', productSlug: 'canva-pro', categorySlug: 'products', planName: 'Slot Edu 1 năm', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 29000, retailPrice: 59000, ctvPrice: 52000, affiliateRate: 8, badge: 'Edu 1 năm' },
  { productName: 'Canva Pro', productSlug: 'canva-pro', categorySlug: 'products', planName: 'Admin Business 100 Slot (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 49000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: 'Admin 100 Slot' },
  { productName: 'Canva Pro', productSlug: 'canva-pro', categorySlug: 'products', planName: 'Admin Business 100 Slot (3 tháng)', duration: '90 ngày', warranty: 'Full thời gian', costPrice: 55000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'Admin 100 Slot' },

  // Adobe Full App
  { productName: 'Adobe Full Apps', productSlug: 'adobe-full-apps', categorySlug: 'premium-apps', planName: '2 tháng (BH 24H)', duration: '60 ngày', warranty: '24 Giờ', costPrice: 65000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'Adobe Creative' },

  // YouTube Premium
  { productName: 'YouTube Premium', productSlug: 'youtube-premium', categorySlug: 'premium-apps', planName: 'Slot 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 35000, retailPrice: 59000, ctvPrice: 52000, affiliateRate: 8, badge: 'Gói 1 tháng' },
  { productName: 'YouTube Premium', productSlug: 'youtube-premium', categorySlug: 'premium-apps', planName: 'Slot 3 tháng', duration: '90 ngày', warranty: 'Full thời gian', costPrice: 119000, retailPrice: 189000, ctvPrice: 169000, affiliateRate: 5, badge: 'Gói 3 tháng' },
  { productName: 'YouTube Premium', productSlug: 'youtube-premium', categorySlug: 'premium-apps', planName: 'Slot 6 tháng', duration: '180 ngày', warranty: 'Full thời gian', costPrice: 219000, retailPrice: 339000, ctvPrice: 309000, affiliateRate: 5, badge: 'Gói 6 tháng' },
  { productName: 'YouTube Premium', productSlug: 'youtube-premium', categorySlug: 'premium-apps', planName: 'Slot 12 tháng', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 450000, retailPrice: 649000, ctvPrice: 589000, affiliateRate: 5, badge: 'Gói 1 năm' },

  // Google AI Pro 5TB
  { productName: 'Google One AI Pro 5TB', productSlug: 'google-ai-pro-5tb', categorySlug: 'ai-tools', planName: 'Nâng chính chủ 1 năm (BH 1 tháng)', duration: '365 ngày', warranty: '1 tháng', costPrice: 75000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: '5TB Chính chủ' },
  { productName: 'Google One AI Pro 5TB', productSlug: 'google-ai-pro-5tb', categorySlug: 'ai-tools', planName: 'Nâng chính chủ 1 năm (BH Full 1 năm)', duration: '365 ngày', warranty: 'Full 1 năm', costPrice: 399000, retailPrice: 529000, ctvPrice: 479000, affiliateRate: 5, badge: 'Full BH 1 năm' },

  // Gemini AI Pro
  { productName: 'Gemini Pro', productSlug: 'gemini-pro', categorySlug: 'ai-tools', planName: 'Slot 1 năm (BH 1 tháng)', duration: '365 ngày', warranty: '1 tháng', costPrice: 49000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: 'BH 1 tháng' },
  { productName: 'Gemini Pro', productSlug: 'gemini-pro', categorySlug: 'ai-tools', planName: 'Slot 1 năm (BH 3 tháng)', duration: '365 ngày', warranty: '3 tháng', costPrice: 69000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'BH 3 tháng' },
  { productName: 'Gemini Pro', productSlug: 'gemini-pro', categorySlug: 'ai-tools', planName: 'Slot 1 năm (BH 6 tháng)', duration: '365 ngày', warranty: '6 tháng', costPrice: 99000, retailPrice: 149000, ctvPrice: 135000, affiliateRate: 6, badge: 'BH 6 tháng' },
  { productName: 'Gemini Pro', productSlug: 'gemini-pro', categorySlug: 'ai-tools', planName: 'Slot Gemini Pro + GG 5TB (1 năm)', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 50000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: 'Combo 5TB' },

  // Wink VIP+
  { productName: 'Wink VIP+', productSlug: 'wink-vip', categorySlug: 'premium-apps', planName: '1 tuần', duration: '7 ngày', warranty: 'Full thời gian', costPrice: 20000, retailPrice: 45000, ctvPrice: 39000, affiliateRate: 8, badge: 'Gói tuần' },
  { productName: 'Wink VIP+', productSlug: 'wink-vip', categorySlug: 'premium-apps', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 75000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'Gói tháng' },

  // MeiTu VIP+
  { productName: 'Meitu SVIP', productSlug: 'meitu-svip', categorySlug: 'products', planName: '1 tuần', duration: '7 ngày', warranty: 'Full thời gian', costPrice: 25000, retailPrice: 45000, ctvPrice: 39000, affiliateRate: 8, badge: 'Gói tuần' },
  { productName: 'Meitu SVIP', productSlug: 'meitu-svip', categorySlug: 'products', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 65000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: 'Gói tháng' },

  // XingTu VIP
  { productName: 'XingTu', productSlug: 'xingtu', categorySlug: 'premium-apps', planName: 'VIP 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 85000, retailPrice: 149000, ctvPrice: 135000, affiliateRate: 6, badge: 'XingTu VIP' },

  // Kling AI
  { productName: 'Kling AI', productSlug: 'kling-ai', categorySlug: 'ai-tools', planName: '3.300 Credit (BH 7 ngày)', duration: '30 ngày', warranty: '7 ngày', costPrice: 650000, retailPrice: 899000, ctvPrice: 819000, affiliateRate: 5, badge: '3300 Credit' },
  { productName: 'Kling AI', productSlug: 'kling-ai', categorySlug: 'ai-tools', planName: 'Random 600-1.100 Credit', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 210000, retailPrice: 339000, ctvPrice: 309000, affiliateRate: 5, badge: '600-1100 Cre' },
  { productName: 'Kling AI', productSlug: 'kling-ai', categorySlug: 'ai-tools', planName: '65 Credit', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 4000, retailPrice: 15000, ctvPrice: 12000, affiliateRate: 10, badge: '65 Cre test' },

  // Perplexity AI Pro
  { productName: 'Perplexity Pro', productSlug: 'perplexity-pro', categorySlug: 'ai-tools', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 180000, retailPrice: 279000, ctvPrice: 249000, affiliateRate: 5, badge: '1 tháng' },
  { productName: 'Perplexity Pro', productSlug: 'perplexity-pro', categorySlug: 'ai-tools', planName: '10-11 tháng', duration: '330 ngày', warranty: 'Full thời gian', costPrice: 1800000, retailPrice: 2249000, ctvPrice: 2020000, affiliateRate: 5, badge: 'Gói năm' },

  // Microsoft 365
  { productName: 'Microsoft 365 Family', productSlug: 'microsoft-365-family', categorySlug: 'premium-apps', planName: 'Slot 1 năm', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 150000, retailPrice: 229000, ctvPrice: 209000, affiliateRate: 5, badge: '1TB OneDrive' },

  // API CODEX
  { productName: 'API CODEX', productSlug: 'api-codex', categorySlug: 'ai-tools', planName: '10M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 40000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: '10M' },
  { productName: 'API CODEX', productSlug: 'api-codex', categorySlug: 'ai-tools', planName: '50M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 70000, retailPrice: 119000, ctvPrice: 105000, affiliateRate: 6, badge: '50M' },
  { productName: 'API CODEX', productSlug: 'api-codex', categorySlug: 'ai-tools', planName: '100M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 110000, retailPrice: 189000, ctvPrice: 169000, affiliateRate: 5, badge: '100M' },

  // API Claude
  { productName: 'API Claude', productSlug: 'api-claude', categorySlug: 'ai-tools', planName: '10M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 40000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: '10M' },
  { productName: 'API Claude', productSlug: 'api-claude', categorySlug: 'ai-tools', planName: '50M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 99000, retailPrice: 149000, ctvPrice: 135000, affiliateRate: 6, badge: '50M' },
  { productName: 'API Claude', productSlug: 'api-claude', categorySlug: 'ai-tools', planName: '100M Token', duration: '1 ngày', warranty: 'Full thời gian', costPrice: 130000, retailPrice: 189000, ctvPrice: 169000, affiliateRate: 5, badge: '100M' },

  // ElevenLabs
  { productName: 'ElevenLabs', productSlug: 'elevenlabs', categorySlug: 'ai-tools', planName: 'Redeem 1M Credit (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 389000, retailPrice: 529000, ctvPrice: 479000, affiliateRate: 5, badge: '1M Credit' },
  { productName: 'ElevenLabs', productSlug: 'elevenlabs', categorySlug: 'ai-tools', planName: 'Redeem 300K Credit (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 180000, retailPrice: 279000, ctvPrice: 249000, affiliateRate: 5, badge: '300K Credit' },

  // Autodesk
  { productName: 'Autodesk All Apps', productSlug: 'autodesk-all-apps', categorySlug: 'premium-apps', planName: '3 năm (BH 1 năm)', duration: '1095 ngày', warranty: '1 năm', costPrice: 120000, retailPrice: 189000, ctvPrice: 169000, affiliateRate: 5, badge: '3 Năm' },

  // Memrise
  { productName: 'Memrise Pro', productSlug: 'memrise-pro', categorySlug: 'premium-apps', planName: 'Lifetime 20 năm (BH 1 tháng)', duration: '7300 ngày', warranty: '1 tháng', costPrice: 300000, retailPrice: 429000, ctvPrice: 389000, affiliateRate: 5, badge: 'Lifetime' },

  // iCloud
  { productName: 'iCloud+ Apple Storage', productSlug: 'iclou-storage', categorySlug: 'premium-apps', planName: 'Slot 2TB (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 120000, retailPrice: 189000, ctvPrice: 169000, affiliateRate: 5, badge: '2TB' },
  { productName: 'iCloud+ Apple Storage', productSlug: 'iclou-storage', categorySlug: 'premium-apps', planName: 'Slot 400GB (1 năm)', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 650000, retailPrice: 899000, ctvPrice: 819000, affiliateRate: 5, badge: '400GB 1 Năm' },

  // ChatGPT Team Business
  { productName: 'ChatGPT Plus', productSlug: 'chatgpt-plus', categorySlug: 'ai-tools', planName: 'ChatGPT Team Business 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 450000, retailPrice: 649000, ctvPrice: 589000, affiliateRate: 5, badge: 'Team Business' },

  // Duolingo
  { productName: 'Super Duolingo', productSlug: 'super-duolingo', categorySlug: 'premium-apps', planName: 'Nâng chính chủ 1 năm', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 250000, retailPrice: 339000, ctvPrice: 309000, affiliateRate: 5, badge: 'Chính chủ' },

  // Notion
  { productName: 'NOTION', productSlug: 'notion', categorySlug: 'ai-tools', planName: 'Notion Business 6 tháng', duration: '180 ngày', warranty: 'Full thời gian', costPrice: 450000, retailPrice: 649000, ctvPrice: 589000, affiliateRate: 5, badge: 'Business 6T' },

  // Cursor Pro
  { productName: 'Cursor Pro', productSlug: 'cursor-pro', categorySlug: 'ai-tools', planName: 'API 2.600 Credit (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 220000, retailPrice: 339000, ctvPrice: 309000, affiliateRate: 5, badge: '2600 Cre' },
  { productName: 'Cursor Pro', productSlug: 'cursor-pro', categorySlug: 'ai-tools', planName: 'API 6.500 Credit (1 tháng)', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 309000, retailPrice: 429000, ctvPrice: 389000, affiliateRate: 5, badge: '6500 Cre' },

  // Spotify Premium
  { productName: 'Spotify Premium', productSlug: 'spotify-premium', categorySlug: 'premium-apps', planName: 'Nâng chính chủ 1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 40000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: 'Chính chủ' },
  { productName: 'Spotify Premium', productSlug: 'spotify-premium', categorySlug: 'premium-apps', planName: 'Nâng chính chủ 3 tháng', duration: '90 ngày', warranty: 'Full thời gian', costPrice: 100000, retailPrice: 149000, ctvPrice: 135000, affiliateRate: 6, badge: 'Chính chủ' },
  { productName: 'Spotify Premium', productSlug: 'spotify-premium', categorySlug: 'premium-apps', planName: 'Nâng chính chủ 6 tháng', duration: '180 ngày', warranty: 'Full thời gian', costPrice: 200000, retailPrice: 279000, ctvPrice: 249000, affiliateRate: 5, badge: 'Chính chủ' },
  { productName: 'Spotify Premium', productSlug: 'spotify-premium', categorySlug: 'premium-apps', planName: 'Nâng chính chủ 1 năm', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 300000, retailPrice: 429000, ctvPrice: 389000, affiliateRate: 5, badge: 'Chính chủ' },

  // Figma Pro
  { productName: 'Figma Pro', productSlug: 'figma-pro', categorySlug: 'premium-apps', planName: '1 năm', duration: '365 ngày', warranty: 'Full thời gian', costPrice: 200000, retailPrice: 279000, ctvPrice: 249000, affiliateRate: 5, badge: '1 Năm' },

  // Proton Unlimited
  { productName: 'Proton Unlimited', productSlug: 'proton-unlimited', categorySlug: 'premium-apps', planName: '1 tháng', duration: '30 ngày', warranty: 'Full thời gian', costPrice: 49000, retailPrice: 79000, ctvPrice: 69000, affiliateRate: 7, badge: '1 Tháng' },
];

async function applyCatalog() {
  console.log('--- STARTING CATALOG UPDATE ---');

  // 1. Fetch all existing categories
  const { data: categories } = await adminDb.from('categories').select('id, slug');
  const catMap = new Map<string, string>();
  categories?.forEach(c => catMap.set(c.slug, c.id));
  const fallbackCatId = categories?.[0]?.id;

  // 2. Fetch all existing products
  const { data: existingProducts } = await adminDb.from('products').select('id, name, slug');
  const prodSlugMap = new Map<string, any>();
  existingProducts?.forEach(p => prodSlugMap.set(p.slug, p));

  // Process unique products
  const uniqueProducts = new Map<string, CatalogItem>();
  catalogDataset.forEach(item => {
    if (!uniqueProducts.has(item.productSlug)) {
      uniqueProducts.set(item.productSlug, item);
    }
  });

  console.log(`Processing ${uniqueProducts.size} unique products...`);

  for (const [slug, item] of uniqueProducts.entries()) {
    let product = prodSlugMap.get(slug);
    const catId = catMap.get(item.categorySlug) || fallbackCatId;

    if (!product) {
      console.log(`Creating new product: ${item.productName} (${slug})`);
      const { data: newProd, error: pErr } = await adminDb.from('products').insert({
        name: item.productName,
        slug: slug,
        category_id: catId,
        short_description: `Tài khoản ${item.productName} chính hãng giá tốt, bảo hành uy tín tại BOW.`,
        description: `Dịch vụ tài khoản và gói nâng cấp ${item.productName} chính hãng. Kích hoạt nhanh chóng, hỗ trợ 24/7.`,
        is_active: true,
        is_featured: false,
        affiliate_enabled: true,
        affiliate_type: 'percent',
        affiliate_reward: item.affiliateRate,
        base_price: item.retailPrice,
        price_ctv: item.ctvPrice,
        cost_price: item.costPrice,
      }).select('id, name, slug').single();

      if (pErr) {
        console.error(`Error creating product ${slug}:`, pErr);
        continue;
      }
      product = newProd;
      prodSlugMap.set(slug, product);
    } else {
      // Update base price & affiliate on existing product
      await adminDb.from('products').update({
        affiliate_enabled: true,
        affiliate_type: 'percent',
        affiliate_reward: item.affiliateRate,
        base_price: item.retailPrice,
        price_ctv: item.ctvPrice,
        cost_price: item.costPrice,
      }).eq('id', product.id);
    }
  }

  // 3. Process each plan
  console.log(`Processing ${catalogDataset.length} plans...`);
  let updatedCount = 0;
  let insertedCount = 0;

  for (const item of catalogDataset) {
    const product = prodSlugMap.get(item.productSlug);
    if (!product) continue;

    // Check if plan exists under this product
    const { data: existingPlans } = await adminDb
      .from('product_plans')
      .select('id, name, duration')
      .eq('product_id', product.id);

    const match = existingPlans?.find(p => 
      p.name.trim().toLowerCase() === item.planName.trim().toLowerCase() ||
      p.duration.trim().toLowerCase() === item.duration.trim().toLowerCase()
    );

    if (match) {
      // Update existing plan
      const { error: upErr } = await adminDb.from('product_plans').update({
        name: item.planName,
        duration: item.duration,
        price: item.retailPrice,
        price_ctv: item.ctvPrice,
        cost_price: item.costPrice,
        badge: item.badge || null,
        notes: item.warranty ? `Bảo hành: ${item.warranty}` : null,
        is_active: true,
      }).eq('id', match.id);

      if (upErr) console.error(`Error updating plan ${item.planName}:`, upErr);
      else updatedCount++;
    } else {
      // Insert new plan
      const { error: inErr } = await adminDb.from('product_plans').insert({
        product_id: product.id,
        name: item.planName,
        duration: item.duration,
        price: item.retailPrice,
        price_ctv: item.ctvPrice,
        cost_price: item.costPrice,
        badge: item.badge || null,
        notes: item.warranty ? `Bảo hành: ${item.warranty}` : null,
        is_active: true,
        sort_order: (existingPlans?.length || 0) + 1,
      });

      if (inErr) console.error(`Error inserting plan ${item.planName}:`, inErr);
      else insertedCount++;
    }
  }

  console.log(`✅ Finished Catalog Update: Updated ${updatedCount} plans, Inserted ${insertedCount} plans.`);
}

applyCatalog().catch(console.error);
