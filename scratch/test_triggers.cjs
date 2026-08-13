const { createClient } = require('@supabase/supabase-js');

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

async function testFunctions() {
  console.log('1. Testing log_audit_event...');
  const { data: d1, error: e1 } = await client.rpc('log_audit_event', {
    p_action: 'test_action',
    p_entity_type: 'test',
    p_description: 'test description',
  });
  console.log('log_audit_event result:', { d1, e1 });

  console.log('2. Testing order_status_history insert...');
  const { data: d2, error: e2 } = await client.from('order_status_history').insert({
    order_id: '00000000-0000-0000-0000-000000000000',
    status: 'pending_payment',
    changed_by: 'system',
    actor_name: 'Hệ thống'
  }).select('id');
  console.log('order_status_history result:', { d2, e2 });

  console.log('3. Testing notifications insert...');
  const { data: d3, error: e3 } = await client.from('notifications').insert({
    type: 'test',
    title: 'Test',
    message: 'Test message',
    is_admin: true,
    is_read: false
  }).select('id');
  console.log('notifications result:', { d3, e3 });
  if (d3 && d3[0]) {
    await client.from('notifications').delete().eq('id', d3[0].id);
  }
}

testFunctions();
