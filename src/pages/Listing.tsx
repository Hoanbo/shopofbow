import { useMemo, useState } from 'react';
import type { CatalogItem } from '../data/types';
import { fetchByCategory, fetchAllProducts } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import AIToolCard from '../components/AIToolCard';
import PremiumAppCard from '../components/PremiumAppCard';
import FeaturedBannerCard from '../components/FeaturedBannerCard';
import Skeleton from '../components/Skeleton';
import { useSeo } from '../hooks/useSeo';

interface Props {
  category: CatalogItem['category'] | 'all';
  base: string;
  title: string;
  subtitle: string;
  layout?: 'grid' | 'list';
}

export default function Listing({ category, title, subtitle }: Props) {
  useSeo({ title, description: subtitle });
  const { data: all = [], loading } = useAsync(
    () => (category === 'all' ? fetchAllProducts() : fetchByCategory(category)),
    [category],
  );
  const [tab, setTab] = useState<CatalogItem['category'] | 'all'>('all');

  const items = useMemo(() => {
    let list = all;
    if (category === 'all' && tab !== 'all') {
      list = list.filter((i) => i.category === tab);
    }
    return list;
  }, [all, category, tab]);

  return (
    <div className="container-bow py-3 sm:py-6 space-y-4 sm:space-y-5">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
        <h1 className="text-2xl font-black sm:text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-base font-medium text-sky-100/90 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Category Tabs (Master Listing only) */}
      {category === 'all' && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: '📁 Tất cả' },
            { id: 'ai-tool', label: '⚡ AI Tools' },
            { id: 'premium-app', label: '⭐ Premium Apps' },
            { id: 'product', label: '🎁 Khác' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all duration-300 ${tab === t.id
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Item Counter */}
      <p className="text-xs sm:text-sm font-medium text-slate-500">
        {loading ? 'Đang tải...' : `${items.length} sản phẩm`}
      </p>

      {/* Products Grid */}
      {loading ? (
        <div
          className={
            tab === 'product' || (category === 'product' && tab === 'all')
              ? 'grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 lg:gap-6'
          }
        >
          <Skeleton
            count={tab === 'product' || (category === 'product' && tab === 'all') ? 3 : 6}
            variant={tab === 'product' || (category === 'product' && tab === 'all') ? 'product' : 'tool'}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-[28px] border border-[#E7EEF8] bg-white py-16 text-center shadow-xs">
          <p className="text-sm font-medium text-slate-500">Không tìm thấy sản phẩm nào phù hợp.</p>
        </div>
      ) : tab === 'product' || (category === 'product' && tab === 'all') ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5 lg:gap-6">
          {items.map((item) => (
            <FeaturedBannerCard key={item.id} item={item} base="/products" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 lg:gap-6">
          {items.map((item) => {
            if (item.category === 'premium-app') {
              return <PremiumAppCard key={item.id} item={item} />;
            }
            return <AIToolCard key={item.id} item={item} />;
          })}
        </div>
      )}
    </div>
  );
}
