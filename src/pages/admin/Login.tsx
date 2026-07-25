import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Banner } from '../../components/admin/ui';

export default function Login() {
  const { session, signIn, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    return <Navigate to={loc.state?.from ?? '/admin'} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      nav(loc.state?.from ?? '/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-sky-soft px-4">
      <div className="w-full max-w-sm rounded-card border border-brand-100 bg-white p-6 shadow-hero sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/assets/bowLogo.jpeg" alt="BOW" className="h-11 w-11 rounded-xl object-cover ring-2 ring-white shadow-soft" />
          <div className="leading-none">
            <span className="block text-lg font-extrabold text-ink">BOW Admin</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">Let's Connect</span>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold text-ink">Đăng nhập quản trị</h1>
        <p className="mt-1 text-sm text-ink-muted">Dành cho quản trị viên BOW.</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Banner kind="error">{error}</Banner>}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-brand-100 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Mật khẩu</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-brand-100 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
