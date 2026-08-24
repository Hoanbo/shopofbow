/**
 * Verify that Client INSERT is 100% BLOCKED after Migration 0050,
 * and clean up the 3 test hack records.
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
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDE3MzAsImV4cCI6MjEwMDU3NzczMH0.0K_jDk16zL_sE3b3VlCq423jE2C7-hR9UqNf9_N6uEw';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBlockedAndClean() {
  console.log('--- 1. TEST INSERT BỊ CHẶN BỞI RLS / SERVER-ONLY ---');
  // Attempt to insert from client
  const { data, error } = await anonDb
    .from('notifications')
    .insert({
      title: 'HACK TEST: Should be blocked',
      message: 'Testing server-only hardening',
      is_admin: true,
    });

  if (error) {
    console.log('✅ CHẶN THÀNH CÔNG: Client/Anon/User không thể INSERT vào notifications!');
    console.log(`   Mã lỗi: ${error.code} | Thông báo: ${error.message}`);
  } else {
    console.log('❌ Cảnh báo: Vẫn insert được!');
  }

  console.log('\n--- 2. DỌN DẸP 3 BẢN GHI TEST AUDIT CŨ ---');
  const { data: deleted, error: delErr } = await adminDb
    .from('notifications')
    .delete()
    .ilike('title', '%HACK%')
    .select('id, title');

  console.log(`Đã xóa ${deleted?.length || 0} bản ghi test audit cũ.`);
}

testBlockedAndClean().catch(console.error);
