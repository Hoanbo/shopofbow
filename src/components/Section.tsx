import { Link } from 'react-router-dom';
import { ChevronRight } from './icons';

interface Props {
  title: string;
  subtitle?: string;
  to?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Section({ title, to, icon, children, className = '' }: Props) {
  return (
    <section className={`container-bow py-4 sm:py-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <div className="flex items-center gap-2.5">
          {icon && <span className="flex items-center text-[#2563EB]">{icon}</span>}
          <h2 className="text-[20px] sm:text-[28px] font-bold tracking-tight text-[#0F172A]">{title}</h2>
        </div>
        {to && (
          <Link
            to={to}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#2563EB] transition-all duration-300 hover:text-[#1D4ED8]"
          >
            <span>Xem tất cả</span>
            <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
