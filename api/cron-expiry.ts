// api/cron-expiry.ts — Vercel Serverless Cron Handler
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Chỉ cho phép GET hoặc POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Kiểm tra xác thực (Vercel Cron Secret hoặc Internal API Key)
  const authHeader = req.headers.authorization || '';
  const isVercelCronHeader = req.headers['x-vercel-cron'] === '1';
  
  let isAuthorized = false;

  if (isVercelCronHeader) {
    isAuthorized = true;
  } else if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) {
    isAuthorized = true;
  } else if (INTERNAL_API_KEY && (authHeader === `Apikey ${INTERNAL_API_KEY}` || authHeader === `Bearer ${INTERNAL_API_KEY}`)) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    console.warn('[cron-expiry] Unauthorized invocation attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[cron-expiry] Missing Supabase credentials');
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('[cron-expiry] Starting automated expiry scan & retry cycle...');

    // 1. Chạy quét mốc hạn chính (7d / 3d / 1d / expired)
    const { data: scanResult, error: scanErr } = await supabase.rpc('check_and_notify_expiring_orders');
    if (scanErr) {
      console.error('[cron-expiry] Error in check_and_notify_expiring_orders:', scanErr);
    }

    // 2. Chạy chu kỳ retry email & phục hồi stale sending
    const { data: retryResult, error: retryErr } = await supabase.rpc('run_expiry_retry_cycle');
    if (retryErr) {
      console.error('[cron-expiry] Error in run_expiry_retry_cycle:', retryErr);
    }

    const durationMs = Date.now() - startTime;

    console.log('[cron-expiry] Expiry cycle completed in', durationMs, 'ms', {
      scanResult,
      retryResult,
    });

    return res.status(200).json({
      success: true,
      durationMs,
      timestamp: new Date().toISOString(),
      scanResult: scanResult || null,
      retryResult: retryResult || null,
      errors: {
        scan: scanErr?.message || null,
        retry: retryErr?.message || null,
      },
    });
  } catch (err: any) {
    console.error('[cron-expiry] Fatal error in cron handler:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error',
    });
  }
}
