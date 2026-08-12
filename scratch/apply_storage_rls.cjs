const { createClient } = require('@supabase/supabase-js');

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

async function run() {
  console.log('Testing storage upload with service role client...');
  const buffer = Buffer.from('test logo content');
  const path = `logos/test-${Date.now()}.png`;
  const { data, error } = await client.storage.from('assets').upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) {
    console.error('Service role upload error:', error);
  } else {
    console.log('Service role upload SUCCESS:', data);
    const pub = client.storage.from('assets').getPublicUrl(path);
    console.log('Public URL:', pub.data.publicUrl);
  }
}

run();
