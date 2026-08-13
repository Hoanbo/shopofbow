import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

const ALLOWED_FOLDERS = ['logos', 'products', 'categories', 'avatars', 'banners'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Xác thực bắt buộc: Phải là Admin (hoặc Internal API Key)
  const authHeaderRaw = req.headers['authorization'] || req.headers['Authorization'] || '';
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
  let isAuthorized = false;

  if (INTERNAL_API_KEY && authHeader === `Apikey ${INTERNAL_API_KEY}`) {
    isAuthorized = true;
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (user && !error) {
      if (user.email?.toLowerCase() === 'hoankb4@gmail.com') {
        isAuthorized = true;
      } else {
        const { data: isAdmin } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (isAdmin) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized: Quyền truy cập bị từ chối' });
  }

  try {
    const { fileName, fileType, base64Data, folder = 'products' } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({ error: 'Thiếu dữ liệu tệp tin (base64Data)' });
    }

    // 2. Kiểm tra folder hợp lệ
    const targetFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'products';

    // 3. Kiểm tra định dạng tệp tin
    const mimeType = (fileType || 'image/png').toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Loại tệp tin không được hỗ trợ. Chỉ cho phép định dạng hình ảnh.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // 4. Kiểm tra kích thước tệp tin (tối đa 5MB)
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Kích thước tệp tin vượt quá giới hạn cho phép (tối đa 5MB)' });
    }

    const ext = (fileName || 'image.png').split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${targetFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: mimeType,
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
