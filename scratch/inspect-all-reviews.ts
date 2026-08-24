import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectAllReviews() {
  const { data: reviews } = await adminDb.from('product_reviews').select('*');
  const { data: products } = await adminDb.from('products').select('id, name, slug');
  console.log(`Total reviews in DB: ${reviews?.length}`);
  for (const r of reviews || []) {
    const prod = products?.find(p => p.id === r.product_id);
    console.log(`- Review ID: ${r.id} | Product: ${prod?.name} (${prod?.slug}) | Rating: ${r.rating} | Status: ${r.status} | Content: "${r.content}"`);
  }
}

inspectAllReviews().catch(console.error);
