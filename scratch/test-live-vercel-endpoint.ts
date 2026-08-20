/**
 * Test Live Production Vercel Endpoint: /api/email-notify
 */

const VERCEL_URL = 'https://shopofbow.vercel.app/api/email-notify';
const INTERNAL_API_KEY = '81d70e09-f061-4967-ab9c-9cdc1782e128';

async function testLiveVercelEndpoint() {
  console.log('=== TESTING LIVE VERCEL ENDPOINT: https://shopofbow.vercel.app/api/email-notify ===\n');

  // Test 1: GET (Healthcheck)
  try {
    console.log('1. Testing GET /api/email-notify...');
    const resGet = await fetch(VERCEL_URL, { method: 'GET' });
    console.log(`   Status: ${resGet.status} ${resGet.statusText}`);
    const getBody = await resGet.json().catch(() => null);
    console.log('   Body:', getBody);
  } catch (err: any) {
    console.error('   GET failed:', err.message);
  }

  // Test 2: POST without Auth (Should be 401)
  try {
    console.log('\n2. Testing POST /api/email-notify without Auth (Expected: 401)...');
    const resNoAuth = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    console.log(`   Status: ${resNoAuth.status} ${resNoAuth.statusText}`);
    const bodyNoAuth = await resNoAuth.json().catch(() => null);
    console.log('   Body:', bodyNoAuth);
  } catch (err: any) {
    console.error('   NoAuth test failed:', err.message);
  }

  // Test 3: POST with Apikey Auth for Expiry Reminder
  try {
    console.log('\n3. Testing POST /api/email-notify with INTERNAL_API_KEY...');
    const resWithAuth = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Apikey ${INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        order_id: 'da3ddbaf-5038-480b-9b53-b4a308ca42af', // Real order for hoankb4@gmail.com
        type: 'expiry_3_days',
        event: 'expiry_3_days',
        days_left: 3,
        expires_at_formatted: '23/08/2026',
      }),
    });
    console.log(`   Status: ${resWithAuth.status} ${resWithAuth.statusText}`);
    const bodyWithAuth = await resWithAuth.json().catch(() => null);
    console.log('   Body:', bodyWithAuth);
  } catch (err: any) {
    console.error('   WithAuth test failed:', err.message);
  }
}

testLiveVercelEndpoint().catch(console.error);
