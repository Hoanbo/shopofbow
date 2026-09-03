// api/brain-status.ts
// BOW CON V4.0 — Server-side Hybrid Brain & Ollama Boundary
// Keeps production browser CSP strict: Browser -> /api/brain-status -> @bow/agent -> Ollama

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { globalHybridRouter } from '@bow/agent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Mode switch request
    if (req.method === 'POST' && req.body?.action === 'set_mode' && req.body?.mode) {
      globalHybridRouter.setMode(req.body.mode);
      return res.status(200).json({
        success: true,
        status: globalHybridRouter.getStatus(),
      });
    }

    // 2. Ollama generation request through server boundary
    if (req.method === 'POST' && req.body?.action === 'generate' && req.body?.userText) {
      const isOnline = await globalHybridRouter.checkLocalOllamaHealth();
      if (!isOnline) {
        return res.status(503).json({
          error: 'Local Ollama brain is currently offline on the server runtime.',
        });
      }
      const response = await (globalHybridRouter as any).callLocalOllama(req.body.userText, {});
      return res.status(200).json(response);
    }

    // 3. Health & Status check
    const isLocalOnline = await globalHybridRouter.checkLocalOllamaHealth();
    const status = globalHybridRouter.getStatus();

    return res.status(200).json({
      success: true,
      status: {
        ...status,
        localOllamaOnline: isLocalOnline,
      },
    });
  } catch (err: any) {
    console.error('[api/brain-status] Error:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to communicate with Hybrid Brain boundary',
    });
  }
}
