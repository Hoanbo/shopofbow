import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectVaultSecrets() {
  console.log('=== CHECKING VAULT SECRETS VIA RPC / QUERY ===');
  
  // Try querying decrypted_secrets
  const { data, error } = await client.from('decrypted_secrets' as any).select('*');
  if (error) {
    console.log('Direct REST select on decrypted_secrets failed:', error.message);
  } else {
    console.log('Vault decrypted secrets:', data);
  }

  // Let's test calling check_and_notify_expiring_orders directly and capturing output
  console.log('\n=== TESTING check_and_notify_expiring_orders() RPC ===');
  const { data: cronData, error: cronErr } = await (client as any).rpc('check_and_notify_expiring_orders');
  console.log('Cron execution result:', JSON.stringify(cronData, null, 2));
  if (cronErr) {
    console.error('Cron execution error:', cronErr);
  }
}

inspectVaultSecrets().catch(console.error);
