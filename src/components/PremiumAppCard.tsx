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
      className="group flex flex-col items-center justify-between rounded-[28px] border border-[#E7EEF8] bg-white p-5 sm:p-6 shadow-[0_6px_24px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-2 hover:scale-[1.03] hover:border-blue-300 hover:shadow-[0_16px_36px_rgba(0,140,255,0.15)] text-center"
    >
      <div className="flex flex-col items-center w-full min-w-0">
        {/* App Logo ~80x80 */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-[70px] w-[70px] sm:h-[80px] sm:w-[80px] transition-transform duration-300 group-hover:scale-105"
        />
        <h3 className="mt-3.5 w-full truncate text-sm font-extrabold text-[#0F172A] sm:mt-4 sm:text-base">{item.name}</h3>
      </div>

      {/* Prominent Gradient Blue Pill Button */}
      <span className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-2 px-4 text-xs font-bold text-white shadow-md transition-all duration-300 group-hover:from-[#0080E0] group-hover:to-[#1D4ED8] group-hover:shadow-lg sm:mt-5 sm:py-2.5 sm:text-sm">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
