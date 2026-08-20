/**
 * READ-ONLY AUDIT FOR DUPLICATE NOTIFICATIONS AND EXPIRY RECORDS
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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runReadOnlyAudit() {
  console.log('================================================================');
  console.log('🔍 READ-ONLY AUDIT: Duplicate Records in Notifications & Expiry');
  console.log('================================================================\n');

  // 1. Audit order_expiry_notifications duplicates
  console.log('--- 1. AUDIT DUPLICATES IN public.order_expiry_notifications ---');
  const { data: expiryRows } = await client.from('order_expiry_notifications').select('*');
  
  const expiryGroups: Record<string, any[]> = {};
  for (const row of expiryRows || []) {
    const key = `${row.order_id}::${row.notification_type}`;
    if (!expiryGroups[key]) expiryGroups[key] = [];
    expiryGroups[key].push(row);
  }

  let dupExpiry = 0;
  for (const [key, rows] of Object.entries(expiryGroups)) {
    if (rows.length > 1) {
      dupExpiry++;
      console.log(`⚠️ DUPLICATE in order_expiry_notifications (${rows.length} rows): ${key}`);
      rows.forEach(r => console.log(`   - ID: ${r.id}, sent_at: ${r.sent_at}, status: ${r.status}, email_status: ${r.email_status}`));
    }
  }
  if (dupExpiry === 0) {
    console.log(`✓ 0 duplicate groups found across ${expiryRows?.length || 0} total records in order_expiry_notifications.`);
  }

  // 2. Audit public.notifications duplicates
  console.log('\n--- 2. AUDIT DUPLICATES IN public.notifications ---');
  const { data: notifRows } = await client
    .from('notifications')
    .select('id, type, title, message, order_id, user_id, is_admin, created_at')
    .order('created_at', { ascending: true });

  const notifGroups: Record<string, any[]> = {};
  for (const row of notifRows || []) {
    if (row.order_id) {
      const key = `${row.order_id}::${row.type}::${row.user_id}`;
      if (!notifGroups[key]) notifGroups[key] = [];
      notifGroups[key].push(row);
    }
  }

  let dupNotifs = 0;
  for (const [key, rows] of Object.entries(notifGroups)) {
    if (rows.length > 1) {
      dupNotifs++;
      console.log(`⚠️ DUPLICATE in notifications (${rows.length} rows): ${key}`);
      console.log(`   Earliest ID: ${rows[0].id} (created_at: ${rows[0].created_at})`);
      console.log(`   Latest ID:   ${rows[rows.length - 1].id} (created_at: ${rows[rows.length - 1].created_at})`);
      for (const r of rows) {
        console.log(`     * ID: ${r.id} | title: "${r.title}" | is_admin: ${r.is_admin}`);
      }
    }
  }
  if (dupNotifs === 0) {
    console.log(`✓ 0 duplicate groups found across ${notifRows?.length || 0} total records in notifications.`);
  }
}

runReadOnlyAudit().catch(console.error);
