import { useMemo, useState } from 'react';
import type { CatalogItem } from '../data/types';
import { fetchByCategory } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import AIToolCard from '../components/AIToolCard';
import PremiumAppCard from '../components/PremiumAppCard';
import FeaturedBannerCard from '../components/FeaturedBannerCard';
import Skeleton from '../components/Skeleton';
import { SearchIcon } from '../components/icons';
import { useSeo } from '../hooks/useSeo';

type Sort = 'popular' | 'price-asc' | 'price-desc' | 'rating';

interface Props {
  category: CatalogItem['category'];
  base: string;
  title: string;
  subtitle: string;
  layout?: 'grid' | 'list';
}

const sortLabels: Record<Sort, string> = {
  popular: 'Phổ biến',
  'price-asc': 'Giá thấp → cao',
  'price-desc': 'Giá cao → thấp',
  rating: 'Đánh giá cao',
};

export default function Listing({ category, title, subtitle }: Props) {
  useSeo({ title, description: subtitle });
  const { data: all = [], loading } = useAsync(() => fetchByCategory(category), [category]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('popular');

  const items = useMemo(() => {
    let list = all;
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(t) || i.tagline.toLowerCase().includes(t),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      default:
        sorted.sort((a, b) => b.sold - a.sold);
    }
    return sorted;
  }, [all, q, sort]);

  return (
    <div className="container-bow py-4 sm:py-6 space-y-5">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
        <h1 className="text-2xl font-black sm:text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-base font-medium text-sky-100/90 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Search & Sort Controls Bar */}
      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 bg-white/90 px-4 py-3.5 backdrop-blur-md border-y border-[#E7EEF8] sm:top-20 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="flex h-11 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 shadow-xs transition-all focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100 sm:max-w-xs w-full">
          <SearchIcon className="h-4.5 w-4.5 shrink-0 text-[#2563EB]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Tìm trong ${title}...`}
            className="w-full bg-transparent text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none text-[#0F172A]"
          />
        </div>

        {/* Sort Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {(Object.keys(sortLabels) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-300 ${
                sort === s
                  ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sortLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Item Counter */}
      <p className="text-xs sm:text-sm font-medium text-slate-500">
        {loading ? 'Đang tải...' : `${items.length} sản phẩm`}
        {!loading && q && ` cho từ khóa "${q}"`}
      </p>

      {/* Products Grid */}
      {loading ? (
        <div
          className={
            category === 'product'
              ? 'grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5'
              : 'grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 sm:gap-5'
          }
        >
          <Skeleton count={category === 'product' ? 3 : 6} variant={category === 'product' ? 'product' : 'tool'} />
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-[28px] border border-[#E7EEF8] bg-white py-16 text-center shadow-xs">
          <p className="text-sm font-medium text-slate-500">Không tìm thấy sản phẩm nào phù hợp.</p>
        </div>
      ) : category === 'product' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5 lg:gap-6">
          {items.map((item) => (
            <FeaturedBannerCard key={item.id} item={item} base="/products" />
          ))}
        </div>
      ) : category === 'premium-app' ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 sm:gap-5 lg:gap-6">
          {items.map((item) => (
            <PremiumAppCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 sm:gap-5 lg:gap-6">
          {items.map((item) => (
            <AIToolCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
