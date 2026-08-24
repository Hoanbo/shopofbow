import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupBadgesAndNotes() {
  console.log('--- Cleaning Up Badges and Notes to remove duplicate wording ---');

  const { data: plans } = await adminDb.from('product_plans').select('id, name, badge, notes, product_id');
  const { data: products } = await adminDb.from('products').select('id, name, slug');

  for (const pl of plans || []) {
    const prod = products?.find(p => p.id === pl.product_id);
    let newBadge = pl.badge;
    let newNotes = pl.notes;

    // 1. Normalize notes so it stores "Full thời gian", "24 giờ", "1 tháng", etc. without "Bảo hành: " prefix
    if (newNotes && newNotes.toLowerCase().startsWith('bảo hành: ')) {
      newNotes = newNotes.replace(/^bảo hành:\s*/i, '').trim();
    }

    // 2. Adjust badges that duplicate warranty
    if (newBadge) {
      if (/^full bh/i.test(newBadge) || /^bh /i.test(newBadge)) {
        if (prod?.slug === 'google-ai-pro-5tb') {
          newBadge = pl.name.includes('Full') ? 'Khuyên dùng' : 'Tiết kiệm';
        } else if (prod?.slug === 'gemini-pro') {
          newBadge = pl.name.includes('1 tháng') ? 'Dùng thử' : pl.name.includes('3 tháng') ? 'Phổ biến' : 'Tiết kiệm';
        }
      }
    }

    await adminDb.from('product_plans').update({
      badge: newBadge,
      notes: newNotes
    }).eq('id', pl.id);

    console.log(`✓ [${prod?.name || 'Unknown'}] Plan: "${pl.name}" | Badge: "${newBadge}" | Notes: "${newNotes}"`);
  }

  console.log('✅ Cleanup completed!');
}

cleanupBadgesAndNotes().catch(console.error);
