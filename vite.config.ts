import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'netlify-functions-dev-proxy',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            if (
              (url.startsWith('/.netlify/functions/email-notify') ||
                url.startsWith('/api/email-notify') ||
                url.startsWith('/.netlify/functions/telegram-notify') ||
                url.startsWith('/api/telegram-notify')) &&
              req.method === 'POST'
            ) {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  process.env.SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
                  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
                  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || env.INTERNAL_API_KEY;
                  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
                  process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID;
                  process.env.SMTP_USER = process.env.SMTP_USER || env.SMTP_USER || 'hoankb4@gmail.com';
                  process.env.SMTP_PASS = process.env.SMTP_PASS || env.SMTP_PASS || env.GMAIL_APP_PASSWORD;

                  const isTg = url.includes('telegram-notify');
                  const funcPath = isTg
                    ? path.resolve(__dirname, './api/telegram-notify.ts')
                    : path.resolve(__dirname, './api/email-notify.ts');

                  const { transformSync } = await import('esbuild');
                  const fileCode = fs.readFileSync(funcPath, 'utf8');
                  const compiled = transformSync(fileCode, { loader: 'ts', format: 'cjs' });

                  // Execute CJS in isolated module wrapper
                  const mod: { exports: { netlifyHandler?: any; handler?: any; default?: any } } = { exports: {} };
                  const wrapper = Function('module', 'exports', 'require', 'process', compiled.code);
                  wrapper(mod, mod.exports, nodeRequire, process);

                  // Các file api/*.ts export `netlifyHandler` (chữ ký Netlify:
                  // { httpMethod, headers, body }) bên cạnh `default` (Vercel).
                  // Ưu tiên netlifyHandler vì proxy gọi theo chữ ký Netlify bên dưới.
                  const handler = mod.exports.netlifyHandler || mod.exports.handler;
                  if (typeof handler !== 'function') {
                    throw new Error('Handler function not exported');
                  }

                  const result = await handler(
                    {
                      httpMethod: 'POST',
                      headers: req.headers as Record<string, string>,
                      body: bodyStr,
                    },
                    {}
                  );

                  res.statusCode = result?.statusCode || 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(result?.body || '{}');
                } catch (err: any) {
                  console.error('[Dev Proxy Error]:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message || 'Internal proxy error' }));
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, './assets'),
      },
    },
  };
});
