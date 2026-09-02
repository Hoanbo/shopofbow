// api/agent-gemini.ts
// Serverless Backend Proxy for Gemini API (Protects GEMINI_API_KEY from browser inspection)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BOW_AGENT_SYSTEM_PROMPT, geminiToolDeclarations } from '@bow/agent';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const { userText, history = [], functionResponses } = req.body || {};

    if (!userText && !functionResponses) {
      return res.status(400).json({ error: 'Missing userText or functionResponses in request body.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: BOW_AGENT_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
      },
      tools: [{ functionDeclarations: geminiToolDeclarations }],
    });

    const chat = model.startChat({
      history: (history || []).slice(-16),
    });

    let result;
    if (functionResponses && Array.isArray(functionResponses) && functionResponses.length > 0) {
      result = await chat.sendMessage(functionResponses);
    } else {
      result = await chat.sendMessage(userText);
    }

    const response = result.response;
    const functionCalls = response.functionCalls();
    const text = response.text ? response.text() : '';

    return res.status(200).json({
      success: true,
      text,
      functionCalls: functionCalls || [],
    });
  } catch (err: any) {
    console.error('[api/agent-gemini] Error:', err.message || err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gemini processing error',
    });
  }
}
