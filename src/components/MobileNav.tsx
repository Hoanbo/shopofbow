import { NavLink } from 'react-router-dom';
import { HomeIcon, SparkIcon, AppIcon, BagIcon, PhoneIcon } from './icons';

const items = [
  { to: '/', label: 'Trang chủ', Icon: HomeIcon, end: true },
  { to: '/ai-tools', label: 'AI Tools', Icon: SparkIcon },
  { to: '/premium-apps', label: 'Apps', Icon: AppIcon },
  { to: '/products', label: 'Sản phẩm', Icon: BagIcon },
  { to: '/contact', label: 'Liên hệ', Icon: PhoneIcon },
];

/** Fixed bottom tab bar — mobile only. */
export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-100 bg-white/95 shadow-nav backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                isActive ? 'text-brand-600' : 'text-ink-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                    isActive ? 'bg-brand-gradient text-white shadow-card' : 'text-current'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
