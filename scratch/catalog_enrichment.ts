// scratch/catalog_enrichment.ts
// RC-1 Fix: Enrich search_aliases for streaming video products
// Products: YouTube Premium, Youku VIP, TV360 Standard
// Uses service role to bypass RLS for write access

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);


async function enrichCatalog() {
  console.log('=== RC-1 CATALOG ENRICHMENT START ===\n');

  // 1. Fetch current state
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, search_aliases, short_description')
    .in('slug', ['youtube-premium', 'youku-vip', 'tv360-standard']);

  console.log('Current state:');
  products?.forEach(p => {
    console.log(`\n[${p.name}] slug=${p.slug}`);
    console.log(`  short_description: ${p.short_description?.slice(0, 100)}`);
    console.log(`  search_aliases: ${JSON.stringify(p.search_aliases)}`);
  });

  // 2. Define enrichment data — only terms that accurately reflect each product
  const enrichments: Record<string, string[]> = {
    'youtube-premium': [
      'youtube',
      'youtube premium',
      'xem video',
      'video',
      'giải trí video',
      'streaming video',
      'xem phim youtube',
      'nhạc',
      'podcast',
      'youtube music',
    ],
    'youku-vip': [
      'youku',
      'youku vip',
      'xem phim',
      'phim Trung Quốc',
      'phim Hoa ngữ',
      'phim bộ Trung Quốc',
      'drama Trung Quốc',
      'streaming phim',
      'xem phim online',
    ],
    'tv360-standard': [
      'tv360',
      'tv 360',
      'xem phim',
      'phim bộ',
      'phim trực tuyến',
      'streaming',
      'truyền hình trực tuyến',
      'xem tv online',
      'xem phim online',
      'kênh truyền hình',
    ],
  };

  // 3. Update each product
  for (const product of products || []) {
    const newAliases = enrichments[product.slug];
    if (!newAliases) {
      console.log(`\nSKIP: ${product.slug} — no enrichment defined`);
      continue;
    }

    // Merge existing aliases with new ones, deduplicate
    const existing = Array.isArray(product.search_aliases) ? product.search_aliases : [];
    const merged = Array.from(new Set([...existing, ...newAliases]));

    console.log(`\nUpdating [${product.name}]:`);
    console.log(`  Old aliases (${existing.length}): ${JSON.stringify(existing)}`);
    console.log(`  New aliases (${merged.length}): ${JSON.stringify(merged)}`);

    const { error } = await supabase
      .from('products')
      .update({ search_aliases: merged })
      .eq('id', product.id);

    if (error) {
      console.error(`  ERROR updating ${product.name}:`, error.message);
    } else {
      console.log(`  SUCCESS: ${product.name} aliases updated`);
    }
  }

  // 4. Verify update
  console.log('\n\n=== VERIFICATION ===');
  const { data: verified } = await supabase
    .from('products')
    .select('id, name, slug, search_aliases')
    .in('slug', ['youtube-premium', 'youku-vip', 'tv360-standard']);

  verified?.forEach(p => {
    console.log(`\n[${p.name}]: ${JSON.stringify(p.search_aliases)}`);
  });

  console.log('\n=== RC-1 CATALOG ENRICHMENT COMPLETE ===');
}

enrichCatalog();
