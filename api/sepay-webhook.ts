// api/sepay-webhook.ts (Vercel Serverless Function)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler as netlifyHandler } from '../netlify/functions/sepay-webhook';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await netlifyHandler(
    {
      httpMethod: req.method || 'POST',
      headers: req.headers as Record<string, string>,
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    } as any,
    {} as any
  );

  res.status(result?.statusCode || 200);
  if (result?.headers) {
    Object.entries(result.headers).forEach(([k, v]) => {
      if (v) res.setHeader(k, String(v));
    });
  }
  res.send(result?.body ? JSON.parse(result.body) : {});
}
