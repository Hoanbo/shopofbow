import { createServer } from 'vite';

const modulePath = process.argv[2];
if (!modulePath) {
  throw new Error('Usage: npx tsx scratch/run-vite-ssr-test.mts /path/to/module.ts');
}

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  const loaded = await server.ssrLoadModule(modulePath.startsWith('/') ? modulePath : '/' + modulePath);
  if (modulePath.endsWith('supabase.ts')) {
    if (!loaded.isSupabaseConfigured) throw new Error('Supabase environment is not configured.');
    console.log('PASS: Supabase initialized through Vite SSR environment');
  }
} finally {
  await server.close();
}
