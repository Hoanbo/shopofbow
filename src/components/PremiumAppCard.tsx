import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';

interface Props {
  item: CatalogItem;
}
export default function PremiumAppCard({ item }: Props) {
  return (
    <Link
      to={`/premium-apps/${item.slug}`}
      className="group flex flex-col items-center justify-between rounded-2xl border border-[#EBF2FA] bg-white p-3 shadow-[0_4px_16px_rgba(0,140,255,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_8px_24px_rgba(0,140,255,0.12)] sm:p-4 text-center"
    >
      <div className="flex flex-col items-center w-full">
        {/* App Icon */}
        <div className="flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14 transition-transform duration-200 group-hover:scale-105">
          <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain filter drop-shadow-xs" />
        </div>
        <h3 className="mt-2 line-clamp-1 text-xs font-bold text-slate-800 sm:mt-2.5 sm:text-sm">{item.name}</h3>
      </div>

      {/* Pill Button */}
      <span className="mt-2.5 inline-flex w-full items-center justify-center rounded-full border border-sky-500 py-1 text-[10px] font-bold text-sky-600 transition-all duration-200 group-hover:bg-sky-500 group-hover:text-white sm:mt-3 sm:border-transparent sm:bg-sky-500 sm:py-1.5 sm:text-[11px] sm:text-white">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
