import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckIcon } from '../components/icons';
import { mapAuthError } from '../lib/authErrors';
import newLogo from '../assets/new-logover2.png';

type Mode = 'signin' | 'signup' | 'otp' | 'forgot' | 'forgot_otp' | 'update_password';

export default function Auth() {
  const { session, signIn, signUp, verifyOtp, signInWithGoogle, loading, isAdmin } = useAuth();
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

  // Nguồn redirect DUY NHẤT: chỉ chạy khi auth đã load xong VÀ đã có session.
  // Tuyệt đối KHÔNG redirect khi đang ở các bước khôi phục mật khẩu (forgot / forgot_otp / update_password).
  useEffect(() => {
    if (loading || !session) return;
    if (mode === 'forgot' || mode === 'forgot_otp' || mode === 'update_password') return;

    const dest = loc.state?.from ?? (isAdmin ? '/admin' : '/');
    nav(dest, { replace: true });
  }, [session, loading, isAdmin, nav, loc.state?.from, mode]);

  // Handler: Đăng nhập
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(mapAuthError(err, 'signin'));
    } finally {
      setBusy(false);
    }
  };

  // Handler: Đăng ký
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password);
      setSuccess('Mã OTP xác thực 6 số đã được gửi về email của bạn.');
      setMode('otp');
    } catch (err) {
      setError(mapAuthError(err, 'signup'));
    } finally {
      setBusy(false);
    }
  };

  // Handler: Xác minh OTP Đăng ký
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await verifyOtp(email, otpToken);
      setSuccess('Xác thực tài khoản thành công! Bạn đang được đăng nhập.');
    } catch (err) {
      setError(mapAuthError(err, 'otp'));
    } finally {
      setBusy(false);
    }
  };

  // BƯỚC 1: Gửi yêu cầu OTP Khôi phục mật khẩu về Email
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }
    setBusy(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetErr) throw resetErr;

      setOtpToken('');
      setSuccess('Mã OTP khôi phục 6 số đã được gửi về email của bạn.');
      setMode('forgot_otp');
    } catch (err: any) {
      setError(mapAuthError(err, 'forgot'));
    } finally {
      setBusy(false);
    }
  };

  // BƯỚC 2: Xác minh mã OTP Khôi phục mật khẩu
  const handleVerifyForgotOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!otpToken.trim()) {
      setError('Vui lòng nhập mã OTP 6 số.');
      return;
    }
    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpToken.trim(),
        type: 'recovery',
      });
      if (verifyErr) throw verifyErr;

      setPassword('');
      setConfirmPassword('');
      setSuccess('Mã OTP hợp lệ! Vui lòng nhập mật khẩu mới của bạn.');
      setMode('update_password');
    } catch (err: any) {
      setError(mapAuthError(err, 'otp'));
    } finally {
      setBusy(false);
    }
  };

  // BƯỚC 3: Nhập và Lưu Mật Khẩu Mới
  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!password) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // LỚP BẢO MẬT NÂNG CAO: Tự động đăng xuất sau khi đổi mật khẩu
      await supabase.auth.signOut();

      setSuccess('Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới của bạn.');
      setPassword('');
      setConfirmPassword('');
      setOtpToken('');

      setTimeout(() => {
        setMode('signin');
        setSuccess('Đã cập nhật mật khẩu mới! Vui lòng nhập email và mật khẩu mới để đăng nhập.');
      }, 1500);
    } catch (err: any) {
      setError(mapAuthError(err, 'update_password'));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err, 'google'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F5F9FF] dark:bg-[#0F172A]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-[#F5F9FF] dark:bg-[#0F172A] p-4 sm:p-6 transition-colors duration-300">
      {/* Top Left Navigation Back to Home Button */}
      <Link
        to="/"
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
      >
        <span className="text-blue-600 dark:text-blue-400 text-sm">←</span>
        <span>Quay lại trang chủ</span>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md transform rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-2xl sm:p-8 animate-fade-up my-auto">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-1">
            <img
              src={newLogo}
              alt="BOW Logo"
              className="h-10 sm:h-12 w-auto object-contain filter contrast-[1.12] drop-shadow-md"
            />
            <div className="flex flex-col text-left leading-none">
              <span className="text-2xl font-black tracking-tight text-[#00A3FF]">BOW</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-[#FFB703]">
                Let's Connect
              </span>
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
            {mode === 'signin' && 'Chào mừng trở lại'}
            {mode === 'signup' && 'Tạo tài khoản mới'}
            {mode === 'otp' && 'Xác minh Email'}
            {mode === 'forgot' && 'Quên mật khẩu'}
            {mode === 'forgot_otp' && 'Nhập mã OTP khôi phục'}
            {mode === 'update_password' && 'Đặt lại mật khẩu mới'}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {mode === 'signin' && 'Đăng nhập để quản lý số dư và lịch sử mua hàng.'}
            {mode === 'signup' && 'Đăng ký để bắt đầu trải nghiệm mua hàng tự động.'}
            {mode === 'otp' && `Chúng tôi đã gửi mã xác thực 6 số đến ${email}`}
            {mode === 'forgot' && 'Nhập email của bạn để nhận mã OTP khôi phục mật khẩu.'}
            {mode === 'forgot_otp' && `Nhập mã OTP 6 số đã được gửi đến ${email}`}
            {mode === 'update_password' && 'Vui lòng nhập mật khẩu mới cho tài khoản của bạn.'}
          </p>

          {/* Thanh Tiến Trình 3 Bước cho Quên Mật Khẩu */}
          {(mode === 'forgot' || mode === 'forgot_otp' || mode === 'update_password') && (
            <div className="mt-4 flex items-center justify-center gap-2 px-6">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${mode === 'forgot' ? 'bg-[#2563EB]' : 'bg-emerald-500'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-all ${mode === 'forgot_otp' ? 'bg-[#2563EB]' : mode === 'update_password' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-all ${mode === 'update_password' ? 'bg-[#2563EB]' : 'bg-slate-200 dark:bg-slate-700'}`} />
            </div>
          )}
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3.5 text-center text-xs font-bold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 leading-relaxed">
            <CheckIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="flex-1">{success}</div>
          </div>
        )}

        {/* FORM 1: ĐĂNG NHẬP */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
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

        {/* FORM 2: ĐĂNG KÝ */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Nhập lại mật khẩu
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Xác nhận mật khẩu của bạn"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
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

        {/* FORM 3: XÁC MINH OTP ĐĂNG KÝ */}
        {mode === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-center">
                Nhập mã OTP 6 số xác thực
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="h-14 w-full text-center text-2xl tracking-[0.5em] font-black rounded-2xl border-2 border-blue-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={busy || otpToken.length < 6}
              className="w-full rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60"
            >
              {busy ? 'Đang xác minh...' : 'Xác minh kích hoạt'}
            </button>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    await signUp(email, password);
                    setSuccess('Đã gửi lại mã OTP mới.');
                  } catch (err) {
                    setError(mapAuthError(err, 'signup'));
                  }
                }}
                className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition"
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
                className="hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                Thay đổi Email
              </button>
            </div>
          </form>
        )}

        {/* FORM 4: BƯỚC 1 - NHẬP EMAIL QUÊN MẬT KHẨU */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Địa chỉ Email đã đăng ký
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-[1.01] disabled:opacity-60"
            >
              {busy ? 'Đang gửi mã OTP...' : 'Tiếp tục ➔ Gửi mã OTP'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        {/* FORM 5: BƯỚC 2 - NHẬP OTP KHÔI PHỤC MẬT KHẨU */}
        {mode === 'forgot_otp' && (
          <form onSubmit={handleVerifyForgotOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-center">
                Nhập mã OTP 6 số từ Email
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="h-14 w-full text-center text-2xl tracking-[0.5em] font-black rounded-2xl border-2 border-blue-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={busy || otpToken.length < 6}
              className="w-full rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60"
            >
              {busy ? 'Đang xác minh OTP...' : 'Xác minh mã OTP'}
            </button>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    await supabase.auth.resetPasswordForEmail(email.trim());
                    setSuccess('Đã gửi lại mã OTP khôi phục mới.');
                  } catch (err: any) {
                    setError(err?.message || 'Lỗi gửi lại mã OTP.');
                  }
                }}
                className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition"
              >
                Gửi lại mã OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setSuccess(null);
                }}
                className="hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                Nhập lại Email
              </button>
            </div>
          </form>
        )}

        {/* FORM 6: BƯỚC 3 - NHẬP MẬT KHẨU MỚI */}
        {mode === 'update_password' && (
          <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Mật khẩu mới
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Nhập lại mật khẩu mới
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Xác nhận mật khẩu mới của bạn"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-[1.01] disabled:opacity-60"
            >
              {busy ? 'Đang lưu mật khẩu...' : 'Lưu mật khẩu mới'}
            </button>
          </form>
        )}

        {/* Divider for Social Login */}
        {mode !== 'otp' && mode !== 'forgot' && mode !== 'forgot_otp' && mode !== 'update_password' && (
          <>
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-white dark:bg-[#131C32] px-3.5 text-slate-400">Hoặc tiếp tục với</span>
              </div>
            </div>

            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-xs transition hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.99]"
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
        {mode !== 'otp' && mode !== 'forgot' && mode !== 'forgot_otp' && mode !== 'update_password' && (
          <div className="mt-6 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
            {mode === 'signin' ? (
              <>
                Bạn chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-[#2563EB] dark:text-[#35A8FF] hover:underline"
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
                  className="text-[#2563EB] dark:text-[#35A8FF] hover:underline"
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
