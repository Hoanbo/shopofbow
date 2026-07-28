import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import AppLogo from './AppLogo';

interface Props {
  item: CatalogItem;
}

export default function PremiumAppCard({ item }: Props) {
  return (
    <Link
      to={`/premium-apps/${item.slug}`}
      className="group flex flex-col items-center justify-between rounded-[22px] border border-[#E7EEF8] bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-blue-200 hover:shadow-[0_12px_28px_rgba(37,99,235,0.12)] text-center"
    >
      <div className="flex flex-col items-center w-full min-w-0">
        {/* App Logo ~68x68 */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-[60px] w-[60px] sm:h-[68px] sm:w-[68px] transition-transform duration-300 group-hover:scale-105"
        />
        <h3 className="mt-3 w-full truncate text-xs font-semibold text-[#0F172A] sm:mt-4 sm:text-sm">{item.name}</h3>
      </div>

      {/* Gradient Blue Button rounded-full */}
      <span className="mt-3.5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-1.5 px-3 text-[11px] font-bold text-white shadow-xs transition-all duration-300 group-hover:from-[#0080E0] group-hover:to-[#1D4ED8] group-hover:shadow-md sm:mt-4 sm:py-2 sm:text-xs">
        Xem chi tiết &gt;
      </span>
    </Link>
  );
}
