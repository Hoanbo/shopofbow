// src/lib/authErrors.ts
// ============================================================
// Mapping lỗi Supabase Auth -> thông báo tiếng Việt tự nhiên.
//
// Mục tiêu:
//   • KHÔNG hiển thị nguyên văn message tiếng Anh / lỗi kỹ thuật cho user.
//   • Tập trung một chỗ, dễ mở rộng (thêm 1 dòng vào bảng RULES).
//   • Fallback an toàn: message lạ -> "Đã xảy ra lỗi. Vui lòng thử lại sau."
//   • Không lộ thông tin nhạy cảm (chi tiết lỗi chỉ log ở DEV).
// ============================================================

/** Thông báo mặc định khi không nhận diện được lỗi (yêu cầu #9). */
export const DEFAULT_AUTH_ERROR = 'Đã xảy ra lỗi. Vui lòng thử lại sau.';

export type AuthContext = 'signin' | 'signup' | 'otp' | 'google' | 'forgot' | 'update_password';

const CONTEXT_FALLBACK: Record<AuthContext, string> = {
  signin: 'Đăng nhập thất bại. Vui lòng thử lại sau.',
  signup: 'Đăng ký thất bại. Vui lòng thử lại sau.',
  otp: 'Xác minh OTP thất bại. Vui lòng thử lại sau.',
  google: 'Không thể đăng nhập bằng Google. Vui lòng thử lại sau.',
  forgot: 'Không thể gửi yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.',
  update_password: 'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.',
};

type MatchRule = {
  /** Regex khớp (case-insensitive) với message gốc của Supabase. */
  test: RegExp;
  /** Thông báo tiếng Việt hiển thị cho người dùng. */
  message: string;
};

// Thứ tự có ý nghĩa: rule cụ thể đặt trước rule tổng quát.
const RULES: MatchRule[] = [
  // Sai email hoặc mật khẩu
  {
    test: /invalid login credentials|invalid credentials|incorrect.*password/i,
    message: 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
  },
  // Email chưa xác minh
  {
    test: /email not confirmed|email.*not.*verified|confirm your email/i,
    message: 'Email chưa được xác minh. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.',
  },
  // Email đã tồn tại
  {
    test: /user already registered|already registered|already been registered|user.*exists/i,
    message: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.',
  },
  // Rate limit — "For security purposes, you can only request this after N seconds" / 429
  {
    test: /for security purposes|only request this after|rate limit|too many requests|request this after \d+ seconds|over_email_send_rate_limit|over_request_rate_limit|email rate limit/i,
    message: 'Bạn thao tác quá nhanh. Vui lòng chờ khoảng 60 giây trước khi thử lại.',
  },
  // OTP sai / hết hạn
  {
    test: /otp|token has expired|invalid.*token|expired.*token|token is invalid/i,
    message: 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.',
  },
  // Mật khẩu quá yếu / quá ngắn / thiếu độ phức tạp
  {
    test: /password should contain at least one character of each/i,
    message: 'Mật khẩu phải chứa ít nhất: 1 chữ thường (a-z), 1 chữ hoa (A-Z), 1 chữ số (0-9) và 1 ký tự đặc biệt (!@#...).',
  },
  {
    test: /password should be at least|password.*at least \d+|weak password|password is too short/i,
    message: 'Mật khẩu quá yếu. Vui lòng dùng mật khẩu tối thiểu 6 ký tự.',
  },
  // Email không hợp lệ
  {
    test: /invalid email|unable to validate email|email address.*invalid|invalid format.*email/i,
    message: 'Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.',
  },
  // Lỗi mạng / kết nối
  {
    test: /failed to fetch|network ?error|network request failed|load failed|fetch failed|timeout/i,
    message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  },
  // Đăng ký đang tắt
  {
    test: /signups? (are )?disabled|signup is disabled/i,
    message: 'Chức năng đăng ký hiện đang tạm khóa. Vui lòng thử lại sau.',
  },
];

/**
 * Trích message gốc từ nhiều dạng lỗi khác nhau (Error, AuthError, string,
 * hoặc object có .message / .error_description).
 */
function extractRawMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const status = anyErr.status ? `status_${anyErr.status} ` : '';
    const code = anyErr.code ? `code_${anyErr.code} ` : '';
    const msg = String(anyErr.message ?? anyErr.error_description ?? anyErr.error ?? '');
    return `${status}${code}${msg}`.trim();
  }
  return '';
}

/**
 * Chuyển bất kỳ lỗi auth nào thành thông báo tiếng Việt an toàn để hiển thị.
 *
 * @param err      Lỗi bắt được từ Supabase (hoặc bất kỳ đâu trong luồng auth).
 * @param context  Ngữ cảnh ('signin' | 'signup' | 'otp' | 'google' | 'forgot' | 'update_password')
 */
export function mapAuthError(err: unknown, context?: AuthContext | string): string {
  const raw = extractRawMessage(err);

  // Giữ thông tin debug cho developer — CHỈ ở môi trường dev
  if (import.meta.env.DEV) {
    console.error('[auth] raw error:', err);
  }

  // 1. Bắt lỗi HTTP 429 hoặc Supabase Rate Limit trực tiếp
  const anyErr = (typeof err === 'object' && err !== null ? err : {}) as Record<string, unknown>;
  if (
    anyErr.status === 429 ||
    anyErr.code === 'over_email_send_rate_limit' ||
    anyErr.code === 'over_request_rate_limit' ||
    anyErr.code === 'rate_limit_exceeded'
  ) {
    const secondsMatch = raw.match(/after (\d+) seconds/i) || raw.match(/every (\d+) seconds/i);
    if (secondsMatch && secondsMatch[1]) {
      return `Bạn thao tác quá nhanh. Vui lòng chờ ${secondsMatch[1]} giây trước khi thử lại.`;
    }
    return 'Bạn thao tác quá nhanh. Vui lòng chờ khoảng 60 giây trước khi thử lại.';
  }

  // Xác định fallback: theo ngữ cảnh, hoặc chuỗi tùy ý, hoặc mặc định.
  const fallback =
    context && context in CONTEXT_FALLBACK
      ? CONTEXT_FALLBACK[context as AuthContext]
      : (context as string) || DEFAULT_AUTH_ERROR;

  if (!raw) return fallback;

  // Kiểm tra thời gian chờ cụ thể trong message
  const secMatch = raw.match(/(?:after|every|in)\s+(\d+)\s+seconds/i);
  if (secMatch && secMatch[1]) {
    return `Bạn thao tác quá nhanh. Vui lòng chờ ${secMatch[1]} giây trước khi thử lại.`;
  }

  for (const rule of RULES) {
    if (rule.test.test(raw)) return rule.message;
  }

  // Message lạ / tiếng Anh không nhận diện -> KHÔNG hiển thị raw
  return fallback;
}
