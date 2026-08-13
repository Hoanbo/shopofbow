const { createClient } = require('@supabase/supabase-js');

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

async function testIsAdmin() {
  console.log('Testing is_admin RPC...');
  const { data, error } = await client.rpc('is_admin');
  console.log('is_admin result:', { data, error });
}

testIsAdmin();
