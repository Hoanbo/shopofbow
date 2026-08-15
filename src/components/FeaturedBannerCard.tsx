import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { ArrowRight } from './icons';
import AppLogo from './AppLogo';

interface Props {
  item: CatalogItem;
  base?: string;
}

export default function FeaturedBannerCard({ item, base = '/products' }: Props) {
  return (
    <Link
      to={`${base}/${item.slug}`}
      className="group relative flex h-[110px] sm:h-[125px] w-full items-center justify-between overflow-hidden rounded-[22px] sm:rounded-[26px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] p-3.5 sm:p-4.5 xl:p-5 text-white shadow-[0_8px_28px_rgba(0,140,255,0.25)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:shadow-[0_14px_36px_rgba(0,140,255,0.36)]"
    >
      <div className="flex items-center gap-3 sm:gap-3.5 pr-2 min-w-0 flex-1">
        {/* Vector App Logo container */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-[48px] w-[48px] shrink-0 sm:h-[56px] sm:w-[56px] rounded-xl object-contain"
        />

        {/* Text content */}
        <div className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-1 text-sm sm:text-base font-extrabold text-white">{item.name}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] sm:text-xs font-normal text-sky-100/90 leading-tight">
            {item.tagline || item.description || 'Dịch vụ bản quyền cao cấp'}
          </p>
        </div>
      </div>

      {/* Right Circle Arrow Button */}
      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0088FF] shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50">
        <ArrowRight className="h-4 w-4 sm:h-4.5 sm:w-4.5 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
