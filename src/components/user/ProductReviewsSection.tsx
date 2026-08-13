import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { StarIcon } from '../icons';

export interface ReviewItem {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

export default function ProductReviewsSection({
  productId,
}: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data: rawReviews, error } = await (supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      if (!rawReviews || rawReviews.length === 0) {
        setReviews([]);
        return;
      }

      const userIds: string[] = Array.from(new Set(rawReviews.map((r: any) => String(r.user_id)).filter(Boolean)));
      const { data: profilesData } = userIds.length > 0
        ? await (supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds) as any)
        : { data: [] };

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const enriched: ReviewItem[] = rawReviews.map((r: any) => ({
        ...r,
        profiles: profilesMap.get(r.user_id),
      }));

      setReviews(enriched);
    } catch (err) {
      console.error('Fetch reviews error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchReviews();
    }
  }, [productId]);

  // Dynamic Statistics
  const totalCount = reviews.length;
  const avgRating = totalCount > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(1)
    : '5.0';

  const countsByStar = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      countsByStar[r.rating as keyof typeof countsByStar]++;
    }
  });

  // Filter & Sort
  const filtered = reviews.filter((r) => {
    if (starFilter === 'all') return true;
    return r.rating === starFilter;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'highest') return b.rating - a.rating;
    if (sortBy === 'lowest') return a.rating - b.rating;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 sm:p-7 shadow-xs space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>⭐</span>
          <span>Đánh giá sản phẩm ({totalCount})</span>
        </h3>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Chỉ người dùng đã mua sản phẩm mới được đánh giá
        </span>
      </div>

      {/* Summary Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#18243E]">
        {/* Rating Score */}
        <div className="flex flex-col items-center justify-center text-center space-y-1 md:border-r border-slate-200/60 dark:border-slate-800">
          <span className="text-4xl font-black text-slate-900 dark:text-white">{avgRating}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.round(Number(avgRating))
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-slate-200 text-slate-300 dark:fill-slate-700 dark:text-slate-600'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
            Dựa trên {totalCount} đánh giá đã xác minh
          </span>
        </div>

        {/* Breakdown Bars */}
        <div className="md:col-span-2 space-y-1.5 justify-center flex flex-col">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = countsByStar[star as keyof typeof countsByStar];
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs font-bold">
                <span className="w-8 shrink-0 flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
                  <span>{star}</span>
                  <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-slate-400 font-mono text-[11px]">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Sorting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Star Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStarFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
              starFilter === 'all'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStarFilter(s)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 flex items-center gap-1 cursor-pointer ${
                starFilter === s
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>{s}</span>
              <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>({countsByStar[s as keyof typeof countsByStar]})</span>
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 focus:outline-none shrink-0"
        >
          <option value="newest">Mới nhất</option>
          <option value="highest">Đánh giá cao nhất</option>
          <option value="lowest">Đánh giá thấp nhất</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-4 pt-2">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400 font-bold animate-pulse">
            Đang tải đánh giá...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            Chưa có đánh giá nào {starFilter !== 'all' ? `cho ${starFilter} sao` : ''}.
          </div>
        ) : (
          filtered.map((r) => {
            const userName = r.profiles?.full_name || r.profiles?.email || 'Khách hàng ẩn danh';
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-[#18243E] space-y-2.5 transition hover:border-slate-200 dark:hover:border-slate-700"
              >
                {/* User Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center font-bold text-xs shrink-0">
                      👤
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block leading-tight">
                        {userName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatRelativeTime(r.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Verified Badge */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/40 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                    <span>✓</span>
                    <span>Đã mua sản phẩm</span>
                  </span>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= r.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-300 dark:fill-slate-700 dark:text-slate-600'
                      }`}
                    />
                  ))}
                </div>

                {/* Content */}
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {r.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
