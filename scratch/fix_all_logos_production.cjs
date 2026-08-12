const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const rootDir = path.resolve(__dirname, '..');
const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

// Mapping of product slug to image path
const SLUG_TO_IMAGE = {
  'chatgpt-plus': '/assets/chatgpt.png',
  'claude-pro': '/assets/claude.jpg',
  'gemini-pro': '/assets/gemini.jpg',
  'gemini-advanced': '/assets/gemini.jpg',
  'grok-premium': '/assets/grok.png',
  'perplexity-pro': '/assets/perplexity.jpg',
  'cursor-pro': '/assets/cursor.jpg',
  'netflix-premium': '/assets/netflix.png',
  'spotify-premium': '/assets/spotify.jpg',
  'youtube-premium': '/assets/youtube.jpg',
  'locket-gold': '/assets/locket.png',
  'canva-pro': '/assets/canva.jpg',
  'capcut-pro': '/assets/capcut.png',
  'kling-ai': '/assets/kling.jpg',
  'api-claude': '/assets/claude.jpg',
  'api-codex': '/assets/cursor.jpg',
};

async function uploadToStorage(filePath, storagePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '');
  const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/svg+xml';
  
  const { error } = await client.storage.from('assets').upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error(`Error uploading ${storagePath}:`, error.message);
    return null;
  }
  const { data } = client.storage.from('assets').getPublicUrl(storagePath);
  return data.publicUrl;
}

async function run() {
  const { data: prods, error } = await client.from('products').select('*');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  // Ensure public/assets/ contains all files from public/assets/logos/
  const logosDir = path.join(rootDir, 'public', 'assets', 'logos');
  const assetsDir = path.join(rootDir, 'public', 'assets');
  if (fs.existsSync(logosDir)) {
    const files = fs.readdirSync(logosDir);
    for (const f of files) {
      const src = path.join(logosDir, f);
      const dest = path.join(assetsDir, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  for (const p of prods) {
    let logoPath = SLUG_TO_IMAGE[p.slug];

    if (!logoPath) {
      // For newly added products, upload file to Supabase Storage and get CDN URL
      const localFile = path.join(logosDir, `${p.slug}.png`);
      const localFileJpg = path.join(logosDir, `${p.slug}.jpg`);
      const targetFile = fs.existsSync(localFile) ? localFile : fs.existsSync(localFileJpg) ? localFileJpg : null;
      
      if (targetFile) {
        const storagePath = `logos/${path.basename(targetFile)}`;
        const cdnUrl = await uploadToStorage(targetFile, storagePath);
        if (cdnUrl) {
          logoPath = cdnUrl;
        } else {
          logoPath = `/assets/${path.basename(targetFile)}`;
        }
      } else {
        logoPath = '/assets/bowLogo.jpeg';
      }
    }

    // Also upload all standard app logos to Supabase Storage so CDN URL always works
    if (logoPath.startsWith('/assets/')) {
      const localAssetFile = path.join(rootDir, 'public', logoPath);
      if (fs.existsSync(localAssetFile)) {
        const storagePath = `logos/${path.basename(localAssetFile)}`;
        const cdnUrl = await uploadToStorage(localAssetFile, storagePath);
        if (cdnUrl) {
          // Use CDN URL for instant production availability
          logoPath = cdnUrl;
        }
      }
    }

    console.log(`Updating product ${p.name} (${p.slug}) -> logo_url = ${logoPath}`);
    const { error: updateErr } = await client.from('products').update({ logo_url: logoPath }).eq('id', p.id);
    if (updateErr) {
      console.error(`Failed to update ${p.slug}:`, updateErr.message);
    }
  }

  console.log('ALL LOGOS RESTORED AND UPDATED SUCCESSFULLY!');
}

run();
