import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function backfillOrderProductIds() {
  console.log('--- Backfilling Order Product IDs & Re-syncing Sold Counts ---');

  const { data: products } = await adminDb.from('products').select('id, name, slug, base_price, price_ctv');
  const { data: plans } = await adminDb.from('product_plans').select('id, product_id, name, duration, price, price_ctv, is_active');
  const { data: orders } = await adminDb.from('orders').select('*');
  const { data: reviews } = await adminDb.from('product_reviews').select('*');

  // 1. Backfill product_id on orders table
  for (const o of orders || []) {
    if (!o.product_id && o.product_name) {
      // Find matching product
      const matchedProd = products?.find(p => 
        p.name.toLowerCase() === o.product_name.toLowerCase() ||
        o.product_name.toLowerCase().startsWith(p.name.toLowerCase())
      );
      if (matchedProd) {
        await adminDb.from('orders').update({
          product_id: matchedProd.id
        }).eq('id', o.id);
        console.log(`✓ Linked order ${o.id} ("${o.product_name}") -> Product: ${matchedProd.name} (${matchedProd.id})`);
      }
    }
  }

  // 2. Re-calculate real sold count and rating for all products
  const { data: updatedOrders } = await adminDb.from('orders').select('*');

  for (const p of products || []) {
    const prodOrders = updatedOrders?.filter(o => 
      (o.product_id === p.id || (o.product_name && o.product_name.toLowerCase().startsWith(p.name.toLowerCase()))) && 
      o.status === 'completed'
    ) || [];

    const prodReviews = reviews?.filter(r => r.product_id === p.id && r.status === 'approved') || [];
    const prodPlans = plans?.filter(pl => pl.product_id === p.id && pl.is_active && Number(pl.price) > 0) || [];

    const realSold = prodOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const realRating = prodReviews.length > 0 
      ? Number((prodReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / prodReviews.length).toFixed(1))
      : null;
    const minPlanPrice = prodPlans.length > 0
      ? Math.min(...prodPlans.map(pl => Number(pl.price) || 0))
      : Number(p.base_price);
    const minPlanCtv = prodPlans.length > 0
      ? Math.min(...prodPlans.map(pl => Number(pl.price_ctv) || Number(pl.price) || 0))
      : Number(p.price_ctv);

    await adminDb.from('products').update({
      sold: realSold,
      rating: realRating,
      base_price: minPlanPrice > 0 ? minPlanPrice : p.base_price,
      price_ctv: minPlanCtv > 0 ? minPlanCtv : p.price_ctv,
      updated_at: new Date().toISOString()
    }).eq('id', p.id);

    console.log(`📦 [${p.name}]: Real Sold=${realSold} | Real Rating=${realRating ?? 'None'} | Min Price=${minPlanPrice}đ`);
  }

  console.log('\n✅ All order linkages and product stats synchronized successfully!');
}

backfillOrderProductIds().catch(console.error);
