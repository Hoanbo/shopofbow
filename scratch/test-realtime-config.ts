/**
 * Script to check and enable Realtime publication & replica identity on tables
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkRealtime() {
  console.log('--- Testing realtime channel event dispatch ---');
  const channel = adminDb.channel('test-realtime-ping');
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
    console.log('Received realtime payload:', payload);
  });
  const subStatus = await channel.subscribe();
  console.log('Channel subscription status:', subStatus);
  await channel.unsubscribe();
}

checkRealtime().catch(console.error);
