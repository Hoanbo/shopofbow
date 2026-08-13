const { createClient } = require('@supabase/supabase-js');

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

async function testOrderInsertRealUser() {
  const { data: users, error: uErr } = await client.from('profiles').select('id, full_name, email').limit(1);
  if (uErr || !users.length) {
    console.error('User fetch error:', uErr);
    return;
  }
  const realUser = users[0];
  console.log('Using real user:', realUser);

  const testCode = 'TEST_' + Date.now();
  const { data, error } = await client.from('orders').insert({
    user_id: realUser.id,
    product_name: 'Test Product',
    plan_label: 'Test Plan',
    price: 10000,
    status: 'pending_payment',
    payment_code: testCode,
  }).select('id');

  console.log('Insert result with service role:', { data, error });

  if (data && data[0]) {
    // clean up test order
    await client.from('orders').delete().eq('id', data[0].id);
    console.log('Cleaned up test order:', data[0].id);
  }
}

testOrderInsertRealUser();
