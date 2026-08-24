import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectAllPlans() {
  const { data: prods } = await adminDb.from('products').select('id, name, slug, rating, sold').order('name');
  const { data: plans } = await adminDb.from('product_plans').select('id, product_id, name, duration, price, badge, notes, is_active').order('sort_order');

  for (const p of prods || []) {
    const pPlans = plans?.filter(pl => pl.product_id === p.id) || [];
    console.log(`\n📦 [${p.name}] (${p.slug}) | DB rating: ${p.rating} | DB sold: ${p.sold}`);
    pPlans.forEach(pl => {
      console.log(`   - Plan: "${pl.name}" | Duration: "${pl.duration}" | Price: ${pl.price}đ | Badge: "${pl.badge}" | Notes: "${pl.notes}" | Active: ${pl.is_active}`);
    });
  }
}

inspectAllPlans().catch(console.error);
