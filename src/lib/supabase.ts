import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';
const anonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

if (!url || !anonKey) {
  // Fail fast instead of contacting a fake endpoint when local/test env is missing.
  throw new Error(
    '[BOW] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Configure the environment before starting the application.',
  );
}

export const supabase = createClient<Database>(
  url,
  anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = Boolean(url && anonKey);
