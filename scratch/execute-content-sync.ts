import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ProductContentSpec {
  slug: string;
  name: string;
  short_description: string;
  description: string;
  common_features: string[];
  plans: {
    name_match: string;
    duration_match?: string;
    badge?: string;
    warranty: string;
    is_highlight?: boolean;
    plan_features: string[];
  }[];
}

import { readFileSync } from 'fs';

async function executeContentSync() {
  console.log('================================================================');
  console.log('🚀 EXECUTING: PRODUCT CONTENT & FEATURES SYNC');
  console.log('   (IMMUTABLE RULE: NO PRICE MODIFICATION)');
  console.log('================================================================\n');

  // Load specs from sync-product-content-and-features
  const syncFile = readFileSync('c:/Web/shopofbow/scratch/sync-product-content-and-features.ts', 'utf-8');
  // Evaluate contentSpecs
  const match = syncFile.match(/const contentSpecs: ProductContentSpec\[\] = (\[[\s\S]*?\]);\n\nasync function/);
  if (!match) throw new Error('Could not parse contentSpecs');
  
  const contentSpecs: ProductContentSpec[] = eval(match[1]);

  const { data: currentProducts } = await adminDb.from('products').select('id, name, slug, base_price, cost_price, price_ctv');
  const { data: currentPlans } = await adminDb.from('product_plans').select('id, product_id, name, duration, price, cost_price, price_ctv, notes, badge, is_highlight, features');

  let updatedProducts = 0;
  let updatedCommonFeatures = 0;
  let updatedPlans = 0;

  for (const spec of contentSpecs) {
    const prod = currentProducts?.find(p => p.slug === spec.slug);
    if (!prod) {
      console.warn(`⚠️ Product not found: ${spec.slug}`);
      continue;
    }

    // 1. Update Product metadata (short_description, description) - NO PRICE FIELDS
    const { error: prodErr } = await adminDb
      .from('products')
      .update({
        short_description: spec.short_description,
        description: spec.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', prod.id);

    if (prodErr) {
      console.error(`Error updating product ${prod.name}:`, prodErr);
    } else {
      updatedProducts++;
    }

    // 2. Sync Common Features (product_features)
    // Delete existing features for this product and re-insert normalized list
    await adminDb.from('product_features').delete().eq('product_id', prod.id);

    if (spec.common_features.length > 0) {
      const featRows = spec.common_features.map((f, idx) => ({
        product_id: prod.id,
        feature: f,
        sort_order: idx + 1
      }));
      const { error: featErr } = await adminDb.from('product_features').insert(featRows);
      if (featErr) {
        console.error(`Error inserting common features for ${prod.name}:`, featErr);
      } else {
        updatedCommonFeatures += spec.common_features.length;
      }
    }

    // 3. Sync Plan-specific features, badge, notes/warranty, is_highlight - NO PRICE FIELDS
    for (const planSpec of spec.plans) {
      // Find matching plan
      const plan = currentPlans?.find(pl => 
        pl.product_id === prod.id && (
          pl.name.trim().toLowerCase() === planSpec.name_match.trim().toLowerCase() ||
          (planSpec.duration_match && pl.duration?.trim().toLowerCase() === planSpec.duration_match.trim().toLowerCase())
        )
      );

      if (plan) {
        const { error: planErr } = await adminDb
          .from('product_plans')
          .update({
            badge: planSpec.badge || null,
            notes: planSpec.warranty ? `Bảo hành: ${planSpec.warranty}` : null,
            is_highlight: !!planSpec.is_highlight,
            features: planSpec.plan_features
          })
          .eq('id', plan.id);

        if (planErr) {
          console.error(`Error updating plan ${plan.name} (${prod.name}):`, planErr);
        } else {
          updatedPlans++;
        }
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`✅ CONTENT SYNC COMPLETED SUCCESSFULLY!`);
  console.log(`- Products updated: ${updatedProducts}`);
  console.log(`- Common features inserted: ${updatedCommonFeatures}`);
  console.log(`- Plans metadata & features updated: ${updatedPlans}`);
  console.log(`- Price fields modified: 0 (GUARANTEED PRICE IMMUTABLE)`);
  console.log(`================================================================`);
}

executeContentSync().catch(console.error);
