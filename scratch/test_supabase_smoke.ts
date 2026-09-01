// scratch/test_supabase_smoke.ts
// Smoke test for Supabase initialization in test environment

import { supabase, isSupabaseConfigured } from '../src/lib/supabase';

console.log('=== SUPABASE SMOKE TEST ===');
console.log(`isSupabaseConfigured: ${isSupabaseConfigured}`);
console.log(`supabase client exists: ${Boolean(supabase)}`);
console.log(`from('products') callable: ${typeof supabase.from === 'function'}`);

if (!isSupabaseConfigured || !supabase || typeof supabase.from !== 'function') {
  console.error('FAIL: Supabase client not properly initialized');
  process.exit(1);
}

// Test real connection query without exposing secrets
const { data, error } = await supabase.from('products').select('id, name').limit(1);

if (error) {
  console.error('FAIL: Supabase query error:', error.message);
  process.exit(1);
}

console.log(`PASS: Supabase query successful, returned ${data?.length} product(s)`);
console.log('=== SMOKE TEST PASSED ===');
