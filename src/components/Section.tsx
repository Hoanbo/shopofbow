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

export default function Section({ title, subtitle, to, icon, children, className = '' }: Props) {
  return (
    <section className={`container-bow py-7 sm:py-9 lg:py-10 ${className}`}>
      <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="grid h-10 w-10 place-items-center rounded-xl2 bg-brand-gradient text-white shadow-card sm:h-11 sm:w-11">
              {icon}
            </span>
          )}
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        {to && (
          <Link
            to={to}
            className="group flex shrink-0 items-center gap-0.5 rounded-pill px-1 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            Xem tất cả
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
