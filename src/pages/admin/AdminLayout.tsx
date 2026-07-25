import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SparkIcon, AppIcon, BagIcon, PhoneIcon, HomeIcon, MenuIcon, CloseIcon } from '../../components/icons';

const links = [
  { to: '/admin', label: 'Tổng quan', Icon: HomeIcon, end: true },
  { to: '/admin/products', label: 'Sản phẩm', Icon: BagIcon },
  { to: '/admin/categories', label: 'Danh mục', Icon: AppIcon },
  { to: '/admin/faqs', label: 'FAQ chung', Icon: SparkIcon },
  { to: '/admin/contact', label: 'Liên hệ', Icon: PhoneIcon },
];

export default function AdminLayout() {
  const { signOut, session } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doSignOut = async () => {
    await signOut();
    nav('/admin/login', { replace: true });
  };

  const navList = (
    <nav className="flex flex-col gap-1">
      {links.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive ? 'bg-brand-gradient text-white shadow-card' : 'text-ink-soft hover:bg-brand-50'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-sky-soft">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-brand-100 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/assets/bowLogo.jpeg" alt="BOW" className="h-9 w-9 rounded-lg object-cover ring-2 ring-white shadow-soft" />
            <span className="text-base font-extrabold text-ink">BOW Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a href="/" target="_blank" rel="noreferrer" className="hidden text-sm font-semibold text-brand-600 hover:text-brand-700 sm:block">
              Xem website
            </a>
            <span className="hidden max-w-[160px] truncate text-sm text-ink-muted md:block">{session?.user.email}</span>
            <button onClick={doSignOut} className="btn-ghost !px-3.5 !py-2 !text-xs">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* Sidebar desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl border border-brand-100 bg-white p-3 shadow-soft">{navList}</div>
        </aside>

        {/* Sidebar mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-ink/30" />
            <div className="absolute left-0 top-16 bottom-0 w-64 max-w-[80%] bg-white p-4 shadow-hero" onClick={(e) => e.stopPropagation()}>
              {navList}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
