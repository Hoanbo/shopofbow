export function sanitizeMetadata(metadata?: Record<string, any>, depth = 0): Record<string, any> | undefined {
  if (!metadata || typeof metadata !== 'object' || depth > 5) return metadata;

  const sensitiveKeys = [
    'password',
    'access_token',
    'refresh_token',
    'jwt',
    'apikey',
    'api_key',
    'secret',
    'otp',
    'payment',
    'bank',
    'card',
    'credential',
    'authorization',
    'supplier',
    'cost_price',
    'margin',
    'affiliate',
  ];

  const sanitized: Record<string, any> = Array.isArray(metadata) ? [] : {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    // Kiểm tra xem key có chứa từ khóa nhạy cảm không
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        sanitized[key] = value.map(v => (typeof v === 'object' ? sanitizeMetadata(v, depth + 1) : v));
      } else {
        sanitized[key] = sanitizeMetadata(value, depth + 1);
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
