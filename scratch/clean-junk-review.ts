import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanJunkReview() {
  console.log('Cleaning up junk test review for Grok Premium...');
  await adminDb.from('product_reviews').delete().eq('id', 'ee5b6b84-8489-49c5-b839-3fd71763593f');

  // Also sync Grok product stats
  const { data: grok } = await adminDb.from('products').select('id').eq('slug', 'grok-premium').single();
  if (grok) {
    await adminDb.from('products').update({
      rating: null,
      sold: 0,
      updated_at: new Date().toISOString()
    }).eq('id', grok.id);
    console.log('✓ Reset Grok Premium rating to NULL (Chưa có đánh giá)');
  }
}

cleanJunkReview().catch(console.error);
