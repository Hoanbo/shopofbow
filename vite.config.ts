import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'process.env': {},
      'process': { env: {} },
    },
    plugins: [
      react(),
      {
        name: 'netlify-functions-dev-proxy',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            const match = url.match(/^\/(\.netlify\/functions|api)\/([a-zA-Z0-9_-]+)/);

            if (match) {
              const funcName = match[2];
              const funcPath = path.resolve(__dirname, `./api/${funcName}.ts`);

              if (!fs.existsSync(funcPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Function ${funcName} not found` }));
                return;
              }

              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });

              req.on('end', async () => {
                try {
                  process.env.SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
                  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
                  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || env.INTERNAL_API_KEY;
                  process.env.SEPAY_API_KEY = process.env.SEPAY_API_KEY || env.SEPAY_API_KEY;
                  process.env.CRON_SECRET = process.env.CRON_SECRET || env.CRON_SECRET;
                  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
                  process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID;
                  process.env.SMTP_USER = process.env.SMTP_USER || env.SMTP_USER || 'hoankb4@gmail.com';
                  process.env.SMTP_PASS = process.env.SMTP_PASS || env.SMTP_PASS || env.GMAIL_APP_PASSWORD;

                  const { transformSync } = await import('esbuild');
                  const fileCode = fs.readFileSync(funcPath, 'utf8');
                  const compiled = transformSync(fileCode, { loader: 'ts', format: 'cjs' });

                  const mod: { exports: { netlifyHandler?: any; handler?: any; default?: any } } = { exports: {} };
                  const wrapper = Function('module', 'exports', 'require', 'process', compiled.code);
                  wrapper(mod, mod.exports, nodeRequire, process);

                  const handler = mod.exports.netlifyHandler || mod.exports.handler || mod.exports.default;
                  if (typeof handler !== 'function') {
                    throw new Error(`Handler function not exported in ${funcName}.ts`);
                  }

                  // Chạy handler tương thích cả Vercel (req, res) và Netlify (event, context)
                  if (mod.exports.netlifyHandler || mod.exports.handler) {
                    const result = await handler(
                      {
                        httpMethod: req.method,
                        headers: req.headers as Record<string, string>,
                        body: bodyStr,
                        path: url,
                      },
                      {}
                    );

                    res.statusCode = result?.statusCode || 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(typeof result?.body === 'string' ? result.body : JSON.stringify(result?.body || {}));
                  } else {
                    // Vercel Request/Response format
                    const vercelReq: any = {
                      method: req.method,
                      headers: req.headers,
                      body: bodyStr ? (bodyStr.startsWith('{') ? JSON.parse(bodyStr) : bodyStr) : {},
                      query: {},
                    };
                    const vercelRes: any = {
                      status(code: number) {
                        res.statusCode = code;
                        return this;
                      },
                      json(data: any) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      },
                      send(data: any) {
                        res.end(data);
                      },
                    };
                    await handler(vercelReq, vercelRes);
                  }
                } catch (err: any) {
                  console.error(`[Dev Proxy Error - ${funcName}]:`, err);
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
