/**
 * Direct Test: Dispatch Email via api/email-notify.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '81d70e09-f061-4967-ab9c-9cdc1782e128';

async function testEmailDispatch() {
  console.log('=== TEST DIRECT CALL TO api/email-notify.ts ===');
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '****** (length ' + process.env.SMTP_PASS.length + ')' : 'MISSING');
  console.log('INTERNAL_API_KEY:', INTERNAL_API_KEY);

  // Find a real completed order
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: orders } = await client
    .from('orders')
    .select('id, payment_code, product_name, user_id, status')
    .not('user_id', 'is', null)
    .limit(1);

  if (!orders || orders.length === 0) {
    console.error('No orders with user_id found');
    return;
  }

  const testOrder = orders[0];
  console.log(`Using order #${testOrder.payment_code} (ID: ${testOrder.id}) for test...\n`);

  // Dynamically import handler from api/email-notify.ts
  const emailNotifyModule = await import('../api/email-notify.js').catch(async () => {
    return await import('../api/email-notify.ts');
  });

  const handler = emailNotifyModule.default;

  // Mock VercelRequest and VercelResponse
  let statusCode = 0;
  let responseBody: any = null;

  const mockReq: any = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: {
      order_id: testOrder.id,
      type: 'expiry_3_days',
      event: 'expiry_3_days',
      days_left: 3,
      expires_at_formatted: '23/08/2026',
    },
  };

  const mockRes: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseBody = data;
      return this;
    },
  };

  console.log('Dispatching mock request to handler with event: expiry_3_days...');
  await handler(mockReq, mockRes);

  console.log(`\nHandler Response Status: ${statusCode}`);
  console.log('Handler Response Body:', JSON.stringify(responseBody, null, 2));

  if (statusCode === 200 && responseBody?.status === 'sent') {
    console.log(`\n🎉 SUCCESS! Real SMTP email was sent via Gmail! MessageId: ${responseBody.messageId}`);
  } else {
    console.log('\n❌ FAILED to send email:', responseBody);
  }
}

testEmailDispatch().catch(console.error);
