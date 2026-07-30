import { Outlet, ScrollRestoration } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileNav from './MobileNav';
import { ContactFab } from './ContactButtons';
import { ToastProvider } from './Toast';

export default function Layout() {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
        <Footer />
        <MobileNav />
        <ContactFab />
        <ScrollRestoration />
      </div>
    </ToastProvider>
  );
}

