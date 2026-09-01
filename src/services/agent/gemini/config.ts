// src/services/agent/gemini/config.ts
// Single source of truth configuration for BOW Agent V3 (Gemini Integration)

export interface GeminiConfig {
  modelName: string;
  timeoutMs: number;
  maxHistoryTurns: number;
  temperature: number;
  serverProxyUrl: string;
}

export const GEMINI_CONFIG: GeminiConfig = {
  // Model có thể dễ dàng thay đổi tại một nơi duy nhất:
  // 'gemini-3.6-flash' (nhanh, thông minh, hỗ trợ function calling xuất sắc)
  modelName: 'gemini-3.6-flash',
  timeoutMs: 8000, // 8s timeout guard (fails fast to deterministic V2 on free-tier lag)
  maxHistoryTurns: 8, // Lưu trữ tối đa 8 lượt hội thoại gần nhất
  temperature: 0.3, // Nhiệt độ thấp để giảm thiểu ảo giác (hallucination)
  serverProxyUrl: '/api/agent-gemini',
};

/**
 * Lấy Gemini API Key an toàn
 * Thứ tự ưu tiên:
 * 1. Biến môi trường Vite client-side (cho môi trường dev / test: VITE_GEMINI_API_KEY)
 * 2. Biến môi trường Node / Server-side (nếu chạy SSR hoặc script: GEMINI_API_KEY)
 */
export function getGeminiApiKey(): string | null {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const clientKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (clientKey && typeof clientKey === 'string' && clientKey.trim().length > 0) {
        return clientKey.trim();
      }
    }
  } catch {
    // Ignore in non-Vite environments
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      const serverKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (serverKey && typeof serverKey === 'string' && serverKey.trim().length > 0) {
        return serverKey.trim();
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Kiểm tra xem Gemini Engine có khả dụng không
 */
export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return !!key && key.length > 5;
}

/**
 * Redact và sanitize structured logging cho console
 * Tuyệt đối không để lộ API Key, Secret, Token, Password, Email, SĐT trong console
 */
export function sanitizeLogOutput(obj: any, depth = 0): any {
  if (!obj || typeof obj !== 'object' || depth > 4) return obj;

  const sensitivePatterns = [
    'key',
    'secret',
    'token',
    'password',
    'auth',
    'credential',
    'jwt',
    'cost_price',
  ];

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogOutput(item, depth + 1));
  }

  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    if (sensitivePatterns.some((pattern) => lowerKey.includes(pattern))) {
      result[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object') {
      result[k] = sanitizeLogOutput(v, depth + 1);
    } else if (typeof v === 'string' && v.length > 200) {
      result[k] = v.slice(0, 200) + '... [TRUNCATED]';
    } else {
      result[k] = v;
    }
  }
  return result;
}
