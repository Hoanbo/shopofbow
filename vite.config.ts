import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'functions-dev-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const isEmail = req.url === '/api/email-notify' || req.url === '/.netlify/functions/email-notify';
            const isTg = req.url === '/api/telegram-notify' || req.url === '/.netlify/functions/telegram-notify';

            if ((isEmail || isTg) && req.method === 'POST') {
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

                  const func = isTg ? await import('./netlify/functions/telegram-notify') : await import('./netlify/functions/email-notify');
                  const result = await func.handler(
                    {
                      httpMethod: 'POST',
                      headers: req.headers as Record<string, string>,
                      body: bodyStr,
                    } as any,
                    {} as any
                  );

                  res.statusCode = result?.statusCode || 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(result?.body || '{}');
                } catch (err: any) {
                  console.error('[Dev Proxy Error]:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
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
