const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { transformSync } = require('esbuild');

const envText = fs.readFileSync('.env', 'utf8');
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

console.log('Testing Netlify email-notify function locally...');
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);

const funcPath = path.resolve(__dirname, '../netlify/functions/email-notify.ts');
const fileCode = fs.readFileSync(funcPath, 'utf8');
const compiled = transformSync(fileCode, { loader: 'ts', format: 'cjs' });

const mod = { exports: {} };
const wrapper = Function('module', 'exports', 'require', 'process', compiled.code);
wrapper(mod, mod.exports, require, process);

const handler = mod.exports.handler;

// First get a real order ID from Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders } = await supabase.from('orders').select('id, payment_code').limit(1);
  if (!orders || orders.length === 0) {
    console.log('No orders found to test.');
    return;
  }
  const orderId = orders[0].id;
  console.log('Testing with orderId:', orderId, '(#', orders[0].payment_code, ')');

  const result = await handler({
    httpMethod: 'POST',
    headers: { Authorization: `Apikey ${process.env.INTERNAL_API_KEY}` },
    body: JSON.stringify({ order_id: orderId, type: 'completed' }),
  }, {});

  console.log('Result status:', result.statusCode);
  console.log('Result body:', result.body);
}

run().catch(console.error);
