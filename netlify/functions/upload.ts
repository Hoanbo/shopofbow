import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { fileName, fileType, base64Data, folder = 'logos' } = body;
    if (!base64Data) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing base64Data' }) };
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
      console.error('[netlify/upload] Storage upload error:', uploadError);
      return { statusCode: 500, body: JSON.stringify({ error: uploadError.message }) };
    }

    const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl: data.publicUrl }),
    };
  } catch (err: any) {
    console.error('[netlify/upload] Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Upload failed' }) };
  }
};
