import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectContent() {
  console.log('--- Inspecting Products & Content ---');

  const { data: products } = await adminDb
    .from('products')
    .select('id, name, slug, short_description, description, base_price, cost_price, price_ctv')
    .order('name');

  const { data: allFeatures } = await adminDb
    .from('product_features')
    .select('*');

  const { data: allPlans } = await adminDb
    .from('product_plans')
    .select('id, product_id, name, duration, price, cost_price, price_ctv, notes, badge, is_highlight, features');

  console.log(`Total Products: ${products?.length}, Total Common Features: ${allFeatures?.length}, Total Plans: ${allPlans?.length}`);

  for (const p of products || []) {
    const pFeats = allFeatures?.filter(f => f.product_id === p.id).map(f => f.feature) || [];
    const pPlans = allPlans?.filter(pl => pl.product_id === p.id) || [];
    console.log(`\n📦 [${p.name}] (${p.slug})`);
    console.log(`   Short Desc: ${p.short_description || 'None'}`);
    console.log(`   Common Features (${pFeats.length}):`, pFeats);
    console.log(`   Plans (${pPlans.length}):`);
    pPlans.forEach(pl => {
      console.log(`     - [${pl.name}] (${pl.duration}) | Price: ${pl.price}đ | Cost: ${pl.cost_price}đ | Badge: ${pl.badge || 'None'} | Notes: ${pl.notes || 'None'} | Features:`, pl.features);
    });
  }
}

inspectContent().catch(console.error);
