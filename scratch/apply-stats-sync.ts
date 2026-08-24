import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncAllProductRealStats() {
  console.log('================================================================');
  console.log('🔄 SYNCING REAL REVIEWS, REAL ORDERS & AUTO MIN PLAN PRICE');
  console.log('================================================================\n');

  const { data: products } = await adminDb.from('products').select('id, name, slug, base_price, price_ctv, rating, sold');
  const { data: orders } = await adminDb.from('orders').select('id, product_id, status');
  const { data: reviews } = await adminDb.from('product_reviews').select('id, product_id, rating, status');
  const { data: plans } = await adminDb.from('product_plans').select('id, product_id, price, price_ctv, is_active');

  for (const p of products || []) {
    const prodOrders = orders?.filter(o => o.product_id === p.id && o.status === 'completed') || [];
    const prodReviews = reviews?.filter(r => r.product_id === p.id && r.status === 'approved') || [];
    const prodPlans = plans?.filter(pl => pl.product_id === p.id && pl.is_active && Number(pl.price) > 0) || [];

    const realSold = prodOrders.length;
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

    console.log(`✓ Updated [${p.name}]: Real Sold=${realSold} | Real Rating=${realRating}⭐ | Min Retail=${minPlanPrice}đ | Min CTV=${minPlanCtv}đ`);
  }

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${products?.length} PRODUCTS FULLY SYNCHRONIZED!`);
  console.log(`================================================================`);
}

syncAllProductRealStats().catch(console.error);
