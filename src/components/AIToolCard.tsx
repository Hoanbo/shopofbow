import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import AppLogo from './AppLogo';

interface Props {
  item: CatalogItem;
}

export default function AIToolCard({ item }: Props) {
  return (
    <Link
      to={`/ai-tools/${item.slug}`}
      className="group flex flex-col items-center justify-between rounded-3xl border border-[#EBF2FA] bg-white p-4 shadow-[0_6px_24px_rgba(0,140,255,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-300 hover:shadow-[0_12px_36px_rgba(0,140,255,0.18)] sm:p-6 text-center"
    >
      <div className="flex flex-col items-center w-full">
        {/* App Vector Icon */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-16 w-16 sm:h-20 sm:w-20 transition-transform duration-300 group-hover:scale-110"
        />
        <h3 className="mt-3.5 line-clamp-1 text-sm font-extrabold text-slate-800 sm:mt-4.5 sm:text-base">{item.name}</h3>
      </div>

      {/* Prominent Pill Button */}
      <span className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#0088FF] py-2 px-3 text-xs font-bold text-white shadow-md transition-all duration-300 group-hover:bg-[#0070E0] group-hover:shadow-lg sm:mt-5 sm:py-2.5 sm:text-sm">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
