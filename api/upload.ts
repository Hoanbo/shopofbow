import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileType, base64Data, folder = 'logos' } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const buffer = Buffer.from(base64Data, 'base64');
    const ext = (fileName || 'image.png').split('.').pop() || 'png';
    const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: fileType || 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[api/upload] Storage upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
    return res.status(200).json({ publicUrl: data.publicUrl });
  } catch (err: any) {
    console.error('[api/upload] Error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
