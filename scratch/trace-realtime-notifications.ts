/**
 * Trace script for Realtime Notifications & Database RLS
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

async function traceNotifications() {
  console.log('================================================================');
  console.log('🔍 TRACING REALTIME NOTIFICATIONS PIPELINE');
  console.log('================================================================\n');

  // 1. Check recent notifications in DB
  const { data: recentNotifs, error: nErr } = await adminDb
    .from('notifications')
    .select('id, user_id, is_admin, type, title, message, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('1. Recent Notifications in DB:');
  if (nErr) console.error('Error fetching notifications:', nErr);
  else console.table(recentNotifs);

  // 2. Check user profile for hoankb4@gmail.com
  const { data: userProfile } = await adminDb
    .from('profiles')
    .select('id, email, role')
    .eq('email', 'hoankb4@gmail.com')
    .single();

  console.log('\n2. Target User (hoankb4@gmail.com):', userProfile);

  // 3. Test Realtime Channel subscription with user_id filter
  console.log('\n3. Testing Realtime Channel subscription for user-hub...');
  const userId = userProfile.id;
  const channel = adminDb.channel(`trace-user-hub-${userId}`);
  
  let receivedInsert = false;
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => {
      console.log('🔔 [REALTIME RECEIVED INSERT]:', payload);
      receivedInsert = true;
    }
  );

  const subState = await new Promise((resolve) => {
    channel.subscribe((status) => {
      console.log('   Subscription status:', status);
      if (status === 'SUBSCRIBED') resolve(status);
    });
  });

  // Wait 1 second after SUBSCRIBED
  await new Promise((r) => setTimeout(r, 1000));

  // 4. Insert test notification
  console.log('\n4. Inserting test notification into public.notifications...');
  const { data: insertedNotif, error: insErr } = await adminDb
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'test_realtime',
      title: '🧪 Realtime Test Notification',
      message: 'Checking if Realtime fires immediately',
      is_admin: false,
      is_read: false,
    })
    .select('*')
    .single();

  if (insErr) {
    console.error('❌ Insert failed:', insErr);
  } else {
    console.log('✅ Inserted notification ID:', insertedNotif.id);
  }

  // Wait 3 seconds for Realtime event
  await new Promise((r) => setTimeout(r, 3000));

  console.log('\n5. Result:');
  console.log(`   Realtime event received: ${receivedInsert ? '✅ YES!' : '❌ NO (Realtime did not fire)'}`);

  // Cleanup
  await adminDb.from('notifications').delete().eq('id', insertedNotif.id);
  await channel.unsubscribe();
}

traceNotifications().catch(console.error);
