import { useState, type FormEvent } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth, ADMIN_EMAILS } from '../../context/AuthContext';
import { Banner } from '../../components/admin/ui';

export default function Login() {
  const { session, signIn, loading, isAdmin } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // NGUỒN ĐIỀU HƯỚNG DUY NHẤT — chạy trong render, dựa trên state auth đã ổn định.
  // isAdmin là giá trị derived đồng bộ từ session (xem AuthContext) nên khi
  // session != null thì isAdmin đã chính xác trong CÙNG render → không có race.
  // Không nav() thủ công trong submit để tránh 2 nguồn điều hướng tranh nhau.
  if (!loading && session) {
    return <Navigate to={isAdmin ? (loc.state?.from ?? '/admin') : '/'} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Chặn sớm ở client cho UX (hiện lỗi rõ ràng). Bảo vệ thật nằm ở
      // ProtectedRoute + RLS, không phụ thuộc kiểm tra phía client này.
      if (!ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
        setError('Tài khoản của bạn không có quyền truy cập trang quản trị Admin.');
        setBusy(false);
        return;
      }
      await signIn(email.trim(), password);
      // Không nav() ở đây — sau khi session cập nhật, guard <Navigate> ở trên
      // sẽ tự điều hướng tới /admin. Một nguồn điều hướng duy nhất.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Kiểm tra email & mật khẩu Supabase của bạn.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-[#f5f8fd] px-4">
      <div className="w-full max-w-sm rounded-[24px] border border-[#E7EEF8] bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/assets/new-logo.png" alt="BOW" className="h-10 w-auto object-contain" />
          <div className="leading-none">
            <span className="block text-lg font-extrabold text-[#0F172A]">BOW Admin</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]">Let's Connect</span>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold text-[#0F172A]">Đăng nhập Supabase Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Nhập tài khoản Admin tạo từ Supabase.</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Banner kind="error">{error}</Banner>}
          <label className="block text-left">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email Admin</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@shopofbow.com"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Mật khẩu Supabase</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu tài khoản Supabase"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition hover:from-[#0080E0] hover:to-[#1D4ED8] disabled:opacity-60"
          >
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
