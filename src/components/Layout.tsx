import { useEffect } from 'react';
import { Outlet, ScrollRestoration, Navigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileNav from './MobileNav';
import BowAgentWidget from './agent/BowAgentWidget';
import { captureReferralFromUrl } from '../utils/affiliate';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { session, loading, mfaPending } = useAuth();

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  // Nếu tài khoản đã bật 2FA nhưng phiên này chưa xác thực TOTP -> Chặn mọi trang và chuyển về /login
  if (!loading && session && mfaPending) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <BowAgentWidget />
      <ScrollRestoration />
    </div>
  );
}


