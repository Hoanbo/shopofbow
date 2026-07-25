import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { MenuIcon, CloseIcon, SparkIcon, AppIcon, BagIcon, HomeIcon, PhoneIcon } from './icons';

const nav = [
  { to: '/', label: 'Trang chủ', Icon: HomeIcon, end: true },
  { to: '/ai-tools', label: 'AI Tools', Icon: SparkIcon },
  { to: '/premium-apps', label: 'Premium Apps', Icon: AppIcon },
  { to: '/products', label: 'Sản phẩm', Icon: BagIcon },
  { to: '/contact', label: 'Liên hệ', Icon: PhoneIcon },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition ${
        scrolled ? 'bg-white/90 shadow-soft backdrop-blur-md' : 'bg-white/70 backdrop-blur-sm'
      }`}
    >
      <div className="container-bow flex h-16 items-center gap-3 sm:h-20 sm:gap-5">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/assets/bowLogo.jpeg"
            alt="BOW"
            className="h-10 w-10 rounded-xl object-cover shadow-soft ring-2 ring-white sm:h-12 sm:w-12"
          />
          <span className="hidden leading-none sm:block">
            <span className="block text-lg font-extrabold tracking-tight text-ink">BOW</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
              Let's Connect
            </span>
          </span>
        </Link>

        {/* Desktop search */}
        <div className="hidden flex-1 md:block">
          <SearchBar className="mx-auto max-w-xl" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `rounded-pill px-3.5 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50/60 hover:text-brand-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <Link to="/contact" className="btn-primary ml-auto hidden md:ml-0 lg:inline-flex">
          Mua ngay
        </Link>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-brand-100 bg-white text-ink-soft lg:hidden"
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile search row */}
      <div className="container-bow pb-3 md:hidden">
        <SearchBar variant="compact" />
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="lg:hidden">
          <div className="container-bow animate-fade-up border-t border-brand-100 py-3">
            <nav className="grid gap-1">
              {nav.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
