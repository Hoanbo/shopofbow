import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';

interface Props {
  item: CatalogItem;
}
export default function PremiumAppCard({ item }: Props) {
  return (
    <Link
      to={`/premium-apps/${item.slug}`}
      className="group flex flex-col items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-md sm:p-4"
    >
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50/80 p-2 shadow-xs transition duration-200 group-hover:scale-105 sm:h-16 sm:w-16">
          <img src={item.image} alt={item.name} loading="lazy" className="h-10 w-10 object-contain sm:h-11 sm:w-11" />
        </div>
        <h3 className="mt-2.5 line-clamp-1 text-xs font-bold text-slate-800 sm:text-sm">{item.name}</h3>
      </div>

      <span className="mt-3 flex items-center justify-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold text-white transition duration-200 group-hover:bg-sky-600 sm:text-xs">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
