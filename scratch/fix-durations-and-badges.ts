import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeDuration(d: string | null): string {
  if (!d) return '';
  const clean = d.trim().toLowerCase();
  if (clean === '7 ngày' || clean === '7ngay' || clean === '7d') return '1 tuần';
  if (clean === '30 ngày' || clean === '30ngay' || clean === '30d' || clean === '1 thang' || clean === '1thang') return '1 tháng';
  if (clean === '60 ngày' || clean === '60ngay' || clean === '60d' || clean === '2 thang' || clean === '2thang') return '2 tháng';
  if (clean === '90 ngày' || clean === '90ngay' || clean === '90d' || clean === '3 thang' || clean === '3thang') return '3 tháng';
  if (clean === '180 ngày' || clean === '180ngay' || clean === '180d' || clean === '6 thang' || clean === '6thang') return '6 tháng';
  if (clean === '330 ngày' || clean === '330d') return '10-11 tháng';
  if (clean === '365 ngày' || clean === '365ngay' || clean === '365d' || clean === '1 nam' || clean === '1nam') return '1 năm';
  if (clean === '1095 ngày' || clean === '3 nam') return '3 năm';
  if (clean === '7300 ngày' || clean === '20 nam') return '20 năm';
  return d;
}

async function fixDurationsAndBadges() {
  console.log('--- Normalizing Durations & Removing Redundant Badges ---');

  const { data: plans } = await adminDb.from('product_plans').select('id, name, duration, badge, notes, is_highlight');

  for (const pl of plans || []) {
    const newDuration = normalizeDuration(pl.duration);
    let newBadge = pl.badge;

    // Remove badges that simply duplicate the plan name or token count or duration
    if (newBadge) {
      const bLower = newBadge.toLowerCase().trim();
      const nLower = pl.name.toLowerCase().trim();

      // Check if badge is just redundant with name (e.g. "1M Credit", "300K Credit", "Business 6T", "50M", "100M", "100M Token", "2600 Cre")
      if (
        nLower.includes(bLower) ||
        bLower === 'business 6t' ||
        bLower.includes('credit') ||
        bLower.includes('token') ||
        bLower === '1 tháng' ||
        bLower === '3 tháng' ||
        bLower === '6 tháng' ||
        bLower === 'gói 1 năm' ||
        bLower === '1 năm' ||
        bLower === '3 năm' ||
        bLower === 'gói 3 năm'
      ) {
        // If the plan is highlighted, give it a meaningful promo badge, otherwise clear it
        if (pl.is_highlight) {
          newBadge = 'Khuyên dùng';
        } else {
          newBadge = null;
        }
      }
    }

    await adminDb.from('product_plans').update({
      duration: newDuration,
      badge: newBadge
    }).eq('id', pl.id);

    console.log(`✓ Plan: "${pl.name}" | Duration: "${pl.duration}" -> "${newDuration}" | Badge: "${pl.badge}" -> "${newBadge}"`);
  }

  console.log('\n✅ Successfully normalized all plans!');
}

fixDurationsAndBadges().catch(console.error);
