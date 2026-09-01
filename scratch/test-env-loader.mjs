// scratch/test-env-loader.mjs
import * as fs from 'fs';
import * as path from 'path';

// Load .env into process.env with proper CRLF handling
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Build global env object
globalThis.__VITE_ENV__ = {
  DEV: true,
  PROD: false,
  MODE: 'test',
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
};

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result.format === 'module' && typeof result.source === 'string') {
    if (result.source.includes('import.meta.env')) {
      return {
        ...result,
        source: result.source.replaceAll(
          'import.meta.env',
          'globalThis.__VITE_ENV__'
        ),
      };
    }
  }
  return result;
}
