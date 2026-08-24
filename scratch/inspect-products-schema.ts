import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
  console.log('================================================================');
  console.log('🔍 INSPECTING PRODUCTS & PRODUCT PLANS SCHEMA');
  console.log('================================================================\n');

  // 1. Check categories
  const { data: categories } = await adminDb.from('categories').select('*');
  console.log('1. Categories:', categories);

  // 2. Check sample product
  const { data: sampleProduct } = await adminDb.from('products').select('*').limit(1);
  console.log('2. Sample Product columns:', sampleProduct && sampleProduct[0] ? Object.keys(sampleProduct[0]) : 'None');

  // 3. Check sample product_plans
  const { data: samplePlan } = await adminDb.from('product_plans').select('*').limit(1);
  console.log('3. Sample Plan columns:', samplePlan && samplePlan[0] ? Object.keys(samplePlan[0]) : 'None');

  // 4. Check all existing products
  const { data: allProducts } = await adminDb.from('products').select('id, name, slug, category_id, is_active, created_at').order('created_at', { ascending: true });
  console.log('\n4. Existing Products Count:', allProducts?.length);
  console.table(allProducts);

  // 5. Check all existing plans
  const { data: allPlans } = await adminDb.from('product_plans').select('id, product_id, label, name, price, price_ctv, duration, duration_unit, warranty, badge, is_active');
  console.log('\n5. Existing Plans Count:', allPlans?.length);
  console.table(allPlans);
}

inspectSchema().catch(console.error);
