/**
 * Test Recipient Resolution on Customer Order (vocucpromax@gmail.com)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const VERCEL_URL = 'https://shopofbow.vercel.app/api/email-notify';

async function testCustomerOrderDispatch() {
  console.log('=== TEST DISPATCH TO ACTUAL CUSTOMER: vocucpromax@gmail.com ===\n');

  // Customer order: 28866089-37be-43f8-9f1d-71a921a7342d (#BOW156287146)
  const customerOrderId = '28866089-37be-43f8-9f1d-71a921a7342d';

  const res = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: customerOrderId,
      type: 'expiry_3_days',
      event: 'expiry_3_days',
      days_left: 3,
      expires_at_formatted: '23/08/2026',
    }),
  });

  const data = await res.json().catch(() => null);
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log('Response:', data);

  if (res.status === 200 && data?.status === 'sent') {
    console.log(`\n🎉 SUCCESS: Expiry reminder sent to ACTUAL CUSTOMER! MessageId: ${data.messageId}`);
  } else {
    console.log('\n❌ FAILED:', data);
  }
}

testCustomerOrderDispatch().catch(console.error);
