import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileNav from './MobileNav';
import { ContactFab } from './ContactButtons';
import { captureReferralFromUrl } from '../utils/affiliate';

export default function Layout() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <ContactFab />
      <ScrollRestoration />
    </div>
  );
}


