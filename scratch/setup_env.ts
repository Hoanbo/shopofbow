if (typeof (import.meta as any).env === 'undefined') {
  (import.meta as any).env = {
    VITE_SUPABASE_URL: 'https://mock.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    DEV: true,
  };
}
