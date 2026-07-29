import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckIcon } from '../components/icons';

type Mode = 'signin' | 'signup' | 'otp';

export default function Auth() {
  const { session, signIn, signUp, verifyOtp, signInWithGoogle, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };

  // If user is already logged in, redirect them to home (or the page they came from)
  useEffect(() => {
    if (!loading && session) {
      nav(loc.state?.from ?? '/', { replace: true });
    }
  }, [session, loading, nav, loc.state?.from]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      const adminEmails = ['hoankb4@gmail.com', 'admin@shopofbow.com'];
      if (adminEmails.includes(email.trim().toLowerCase())) {
        nav('/admin', { replace: true });
      } else {
        nav('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password);
      setSuccess('Mã OTP xác thực đã được gửi về email của bạn.');
      setMode('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(email, otpToken);
      setSuccess('Xác thực tài khoản thành công! Bạn đang được đăng nhập.');
      setTimeout(() => {
        nav(loc.state?.from ?? '/', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mã OTP không đúng hoặc đã hết hạn.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối đăng nhập Google.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
      {/* Auth Card */}
      <div className="w-full max-w-md transform rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xl sm:p-8 animate-fade-up">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB] font-black text-xl">
            B
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#0F172A]">
            {mode === 'signin' && 'Chào mừng trở lại'}
            {mode === 'signup' && 'Tạo tài khoản mới'}
            {mode === 'otp' && 'Xác minh Email'}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            {mode === 'signin' && 'Đăng nhập để quản lý số dư và lịch sử mua hàng.'}
            {mode === 'signup' && 'Đăng ký để bắt đầu trải nghiệm mua hàng tự động.'}
            {mode === 'otp' && `Chúng tôi đã gửi mã xác thực OTP đến ${email}`}
          </p>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3.5 text-center text-xs font-semibold text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-center text-xs font-semibold text-emerald-700">
            <CheckIcon className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
            {success}
          </div>
        )}

        {/* Mode Forms */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-[1.01] disabled:opacity-60"
            >
              {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nhập lại mật khẩu
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Xác nhận mật khẩu của bạn"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-[1.01] disabled:opacity-60"
            >
              {busy ? 'Đang tạo tài khoản...' : 'Đăng ký'}
            </button>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nhập mã OTP 6 số
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="h-12 w-full text-center text-lg tracking-[0.4em] font-extrabold rounded-xl border border-slate-200 bg-white px-3.5 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {busy ? 'Đang xác minh...' : 'Xác minh kích hoạt'}
            </button>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    await signUp(email, password);
                    setSuccess('Đã gửi lại mã OTP mới.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Gửi lại OTP thất bại.');
                  }
                }}
                className="hover:text-[#2563EB] transition"
              >
                Gửi lại mã OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setSuccess(null);
                  setError(null);
                }}
                className="hover:text-slate-800 transition"
              >
                Thay đổi Email
              </button>
            </div>
          </form>
        )}

        {/* Divider for Social Login */}
        {mode !== 'otp' && (
          <>
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-white px-3.5 text-slate-400">Hoặc tiếp tục với</span>
              </div>
            </div>

            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              Đăng nhập bằng Google
            </button>
          </>
        )}

        {/* Footer Toggle Mode Links */}
        {mode !== 'otp' && (
          <div className="mt-6 text-center text-xs font-bold text-slate-500">
            {mode === 'signin' ? (
              <>
                Bạn chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-[#2563EB] hover:underline"
                >
                  Đăng ký miễn phí
                </button>
              </>
            ) : (
              <>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-[#2563EB] hover:underline"
                >
                  Đăng nhập tại đây
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
