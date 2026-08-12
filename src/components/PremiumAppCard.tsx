import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import AppLogo from './AppLogo';

interface Props {
  item: CatalogItem;
}

export default function PremiumAppCard({ item }: Props) {
  return (
    <Link
      to={`/products/${item.slug}`}
      className="group flex flex-col items-center justify-between h-full rounded-2xl sm:rounded-[28px] border border-[#E7EEF8] dark:border-slate-800/80 bg-white dark:bg-slate-900 p-2.5 xs:p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-[0_12px_30px_rgba(0,140,255,0.12)] text-center"
    >
      <div className="flex flex-col items-center w-full min-w-0">
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-14 w-14 xs:h-16 xs:w-16 sm:h-[80px] sm:w-[80px] transition-transform duration-300 group-hover:scale-105"
        />
        <h3 className="mt-2 w-full truncate text-[11px] xs:text-xs font-extrabold text-[#0F172A] dark:text-white sm:mt-4 sm:text-base leading-tight">
          {item.name}
        </h3>
      </div>

      <span className="mt-2.5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-1.5 px-2 text-[10px] xs:text-xs font-bold text-white shadow-xs transition-all duration-300 group-hover:from-[#0080E0] group-hover:to-[#1D4ED8] sm:mt-5 sm:py-2.5 sm:px-4 sm:text-sm">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
