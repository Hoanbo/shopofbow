const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const rootDir = path.resolve(__dirname, '..');
const logosDir = path.join(rootDir, 'public', 'assets', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const req = protocol.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
  });
}

async function processProduct(p) {
  console.log(`Processing: ${p.name} (${p.slug}) -> current logo_url: ${p.logo_url}`);
  let logoUrl = p.logo_url || '';
  if (!logoUrl) return;

  let ext = 'png';
  if (logoUrl.includes('.jpg') || logoUrl.includes('.jpeg')) ext = 'jpg';
  if (logoUrl.includes('.svg')) ext = 'svg';

  const filename = `${p.slug}.${ext}`;
  const targetPath = path.join(logosDir, filename);
  const localUrlPath = `/assets/logos/${filename}`;

  try {
    if (logoUrl.startsWith('data:image')) {
      const base64Data = logoUrl.split(',')[1];
      fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
      console.log(` -> Saved base64 to: ${filename}`);
    } else if (logoUrl.startsWith('/assets/')) {
      const srcPath = path.join(rootDir, 'public', logoUrl);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, targetPath);
        console.log(` -> Copied ${logoUrl} to: ${filename}`);
      } else {
        console.warn(` -> Source ${srcPath} not found`);
      }
    } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const buffer = await fetchUrl(logoUrl);
      fs.writeFileSync(targetPath, buffer);
      console.log(` -> Downloaded ${logoUrl} to: ${filename}`);
    }

    // Update Supabase DB product logo_url to point to local path
    const { error } = await client.from('products').update({ logo_url: localUrlPath }).eq('id', p.id);
    if (error) {
      console.error(` -> DB update error for ${p.slug}:`, error);
    } else {
      console.log(` -> DB updated: logo_url = ${localUrlPath}`);
    }
  } catch (err) {
    console.error(` -> Failed processing ${p.slug}:`, err.message);
  }
}

async function run() {
  const { data: prods, error } = await client.from('products').select('*');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  for (const p of prods) {
    await processProduct(p);
  }

  // Also copy all existing assets from public/assets into public/assets/logos
  const assetsDir = path.join(rootDir, 'public', 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const f of files) {
      const srcFile = path.join(assetsDir, f);
      if (fs.statSync(srcFile).isFile()) {
        const destFile = path.join(logosDir, f);
        fs.copyFileSync(srcFile, destFile);
        console.log(`Copied public/assets/${f} to public/assets/logos/${f}`);
      }
    }
  }
  console.log('DONE!');
}

run();
