import { NavLink } from 'react-router-dom';
import { HomeIcon, SparkIcon, StarIcon, HeadsetIcon } from './icons';

const items = [
  { to: '/', label: 'Trang chủ', Icon: HomeIcon, end: true },
  { to: '/ai-tools', label: 'Danh mục', Icon: SparkIcon },
  { to: '/premium-apps', label: 'Yêu thích', Icon: StarIcon },
  { to: '/contact', label: 'Hỗ trợ', Icon: HeadsetIcon },
];

export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] border-t border-[#E7EEF8] bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-4 px-2">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors duration-200 ${
                isActive ? 'font-bold text-[#2563EB]' : 'font-medium text-[#64748B] hover:text-[#0F172A]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                <span className="tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
