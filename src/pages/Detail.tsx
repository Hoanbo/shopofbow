import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { fetchBySlug, fetchByCategory, fetchAllProducts, fetchFaqs } from '../data/api';
import { formatVND } from '../data/catalog';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import CheckoutModal from '../components/CheckoutModal';
import ProductReviewsSection from '../components/user/ProductReviewsSection';
import AppLogo from '../components/AppLogo';
import FeaturedBannerCard from '../components/FeaturedBannerCard';
import {
  StarIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  HeadsetIcon,
  ChevronRight,
} from '../components/icons';

import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../components/Toast';
import { generateReferralLink } from '../utils/affiliate';

interface Props {
  category: CatalogItem['category'] | 'all';
  base: string;
  crumb: string;
}

const perks = [
  { Icon: BoltIcon, label: 'Kích hoạt tức thì' },
  { Icon: ShieldIcon, label: 'Bảo hành trọn gói' },
  { Icon: HeadsetIcon, label: 'Hỗ trợ 24/7' },
];

export default function Detail({ category, base, crumb }: Props) {
  const { slug } = useParams();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { session, isCtv, profile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [copiedRef, setCopiedRef] = useState(false);
  const toast = useToast();

  const { data: rawItem, loading } = useAsync(
    () => (slug ? fetchBySlug(slug) : Promise.resolve(null)),
    [slug],
  );

  const [liveItem, setLiveItem] = useState<CatalogItem | null>(null);
  useEffect(() => {
    if (rawItem) setLiveItem(rawItem);
  }, [rawItem]);

  useEffect(() => {
    if (!rawItem?.id) return;
    const channel = supabase
      .channel(`realtime-product-header-${rawItem.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${rawItem.id}` },
        (payload: any) => {
          if (payload.new) {
            setLiveItem((prev) => prev ? {
              ...prev,
              rating: payload.new.rating != null ? Number(payload.new.rating) : undefined,
              sold: payload.new.sold ?? prev.sold,
              price: Number(payload.new.base_price ?? prev.price),
              priceCtv: payload.new.price_ctv != null ? Number(payload.new.price_ctv) : prev.priceCtv,
            } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rawItem?.id]);

  const currentItem = liveItem || rawItem;
  const { data: related = [] } = useAsync(async () => {
    if (!currentItem) return [];
    const catItems = await fetchByCategory(currentItem.category);
    const sameCat = catItems.filter((i) => i.id !== currentItem.id);
    if (sameCat.length >= 4) {
      return sameCat.slice(0, 4);
    }
    const all = await fetchAllProducts();
    const other = all.filter((i) => i.id !== currentItem.id && !sameCat.some((c) => c.id === i.id));
    return [...sameCat, ...other].slice(0, 4);
  }, [currentItem?.id, currentItem?.category]);

  const { data: faqs = [] } = useAsync(() => (currentItem ? fetchFaqs(currentItem.id) : Promise.resolve([])), [currentItem?.id]);
  const [plan, setPlan] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  // Thông tin đơn hàng sau khi thanh toán ví thành công
  const [walletOrder, setWalletOrder] = useState<{ code: string; amount: number; qty: number } | null>(null);

  useSeo({
    title: currentItem?.name,
    description: currentItem?.description || currentItem?.tagline,
    image: currentItem?.image,
    type: 'product',
  });

  if (loading) {
    return (
      <div className="container-bow py-16">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-blue-100/60" />
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[28px] bg-blue-100/60" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-full bg-blue-100/60" />
            <div className="h-20 animate-pulse rounded-2xl bg-blue-100/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-blue-100/60" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentItem || (category !== 'all' && currentItem.category !== category)) {
    return (
      <div className="container-bow py-20 text-center">
        <div className="mx-auto max-w-md rounded-[28px] border border-[#E7EEF8] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Không tìm thấy sản phẩm</h1>
          <p className="mt-2 text-sm text-slate-500">Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đã thay đổi đường dẫn.</p>
          <Link
            to={base}
            className="mt-6 inline-flex rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8]"
          >
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const item = currentItem;
  const relatedItems = related.slice(0, 4);
  const active = item.plans[plan] ?? item.plans[0];
  const fav = item ? (isFavorite(item.id) || isFavorite(item.slug)) : false;

  const activeRetailPrice = Number(active?.price ?? item.price ?? 0);
  const activeCtvPrice = active?.priceCtv != null && active.priceCtv > 0
    ? active.priceCtv
    : item.priceCtv != null && item.priceCtv > 0
    ? item.priceCtv
    : null;

  const isCtvDiscountApplied = Boolean(isCtv && activeCtvPrice != null && activeCtvPrice < activeRetailPrice);
  const displayPrice = isCtvDiscountApplied ? Number(activeCtvPrice) : activeRetailPrice;

  const handleCopyReferral = () => {
    const code = profile?.referral_code || (session?.user?.id ? `BOW${session.user.id.substring(0, 5).toUpperCase()}` : 'BOW');
    const link = generateReferralLink(code, `/products/${item.slug}`);
    navigator.clipboard.writeText(link);
    setCopiedRef(true);
    toast.success('Đã sao chép liên kết giới thiệu sản phẩm!');
    setTimeout(() => setCopiedRef(false), 2500);
  };

  return (
    <div className="container-bow py-4 sm:py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
        <Link to="/" className="hover:text-[#2563EB] transition font-medium">
          Trang chủ
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <Link to={base} className="hover:text-[#2563EB] transition font-medium">
          {crumb}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="truncate font-bold text-[#0F172A]">{item.name}</span>
      </nav>

      {/* Main Detail Grid */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Left Column: Product Image */}
        <div className="h-full">
          <div className="relative flex aspect-square lg:aspect-auto lg:h-full items-center justify-center overflow-hidden rounded-[28px] border border-[#E7EEF8] bg-gradient-to-tr from-sky-400/10 via-sky-100/30 to-blue-50/50 p-8 shadow-[0_8px_30px_rgba(0,140,255,0.06)]">
            <AppLogo
              slug={item.slug}
              name={item.name}
              image={item.image}
              className="h-56 w-56 sm:h-72 sm:w-72 lg:h-80 lg:w-80 filter drop-shadow-md"
            />
            {item.badge && (
              <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-[#2563EB] shadow-sm backdrop-blur-md">
                {item.badge}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Product Specs & Options */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#2563EB]">
                  {item.group}
                </span>
                <h1 className="mt-2.5 text-2xl font-black text-[#0F172A] sm:text-3xl lg:text-4xl tracking-tight">
                  {item.name}
                </h1>
              </div>

              {/* Favorite Toggle Button */}
              <button
                type="button"
                onClick={() => toggleFavorite(item)}
                title={fav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all shadow-xs border shrink-0 ${
                  fav
                    ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-500'
                }`}
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-300 ${fav ? 'fill-rose-500 stroke-rose-500 scale-110' : 'fill-none stroke-currentColor'}`}
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
                  />
                </svg>
                <span>{fav ? 'Đã yêu thích' : 'Yêu thích'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-sm font-medium text-slate-500 leading-relaxed">{item.tagline}</p>

            <div className="mt-4 flex items-center gap-3 text-sm">
              {item.rating != null && Number(item.rating) > 0 ? (
                <span className="flex items-center gap-1 font-extrabold text-[#0F172A] dark:text-white">
                  <StarIcon className="h-4 w-4 text-amber-400" /> {Number(item.rating).toFixed(1)}
                </span>
              ) : (
                <span className="font-semibold text-slate-400">Chưa có đánh giá</span>
              )}
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-500">
                Đã bán {item.sold >= 1000 ? (item.sold / 1000).toFixed(1) + 'k' : item.sold} gói
              </span>
            </div>

            {/* Price Tag */}
            {isCtvDiscountApplied ? (
              <div className="mt-5 rounded-[22px] bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 sm:p-5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 text-white font-black text-[10px] uppercase px-2.5 py-0.5 shadow-xs">
                    👑 Giá Sỉ CTV Đặc Quyền
                  </span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Tiết kiệm {formatVND(activeRetailPrice - (activeCtvPrice || 0))}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400">{formatVND(displayPrice)}</span>
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500 line-through">
                    {formatVND(activeRetailPrice)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-baseline gap-3 rounded-[22px] bg-[#EEF6FF] dark:bg-blue-950/20 border border-[#D8E9FF] dark:border-blue-900/40 p-4 sm:p-5">
                  <span className="text-3xl font-black text-[#2563EB] dark:text-[#35A8FF]">{formatVND(displayPrice)}</span>
                  {active.originalPrice && (
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500 line-through">
                      {formatVND(active.originalPrice)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Plan Selector */}
            {item.plans.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">Chọn gói nâng cấp:</h3>
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {item.plans.map((p, i) => {
                    const isSelected = plan === i;
                    const badgeText = p.badge && !p.label.toLowerCase().includes(p.badge.toLowerCase())
                      ? p.badge
                      : (p.highlight ? 'Khuyên dùng' : null);
                    const planPrice = (isCtv && p.priceCtv != null && p.priceCtv > 0) ? p.priceCtv : p.price;
                    const showDuration = p.duration && !p.label.toLowerCase().includes(p.duration.toLowerCase());

                    return (
                      <button
                        key={`${p.label}-${i}`}
                        onClick={() => setPlan(i)}
                        className={`relative rounded-[20px] border p-3.5 text-center transition-all duration-300 ${isSelected
                          ? isCtv
                            ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-md ring-2 ring-amber-500/20'
                            : 'border-[#2563EB] bg-[#EEF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-[#35A8FF] shadow-md ring-2 ring-blue-500/20'
                          : 'border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                          }`}
                      >
                        {badgeText && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs whitespace-nowrap">
                            {badgeText}
                          </span>
                        )}
                        <span className={`block text-sm font-extrabold ${isSelected ? (isCtv ? 'text-amber-700 dark:text-amber-300' : 'text-[#2563EB] dark:text-[#35A8FF]') : 'text-[#0F172A] dark:text-slate-200'}`}>
                          {p.label}
                        </span>
                        {showDuration && (
                          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                            {p.duration}
                          </span>
                        )}
                        <span className={`mt-1.5 block text-sm font-black ${isSelected ? (isCtv ? 'text-amber-600 dark:text-amber-400' : 'text-[#2563EB] dark:text-[#35A8FF]') : (isCtv ? 'text-amber-600 dark:text-amber-400' : 'text-[#2563EB] dark:text-blue-400')}`}>
                          {formatVND(planPrice)}
                        </span>

                        {/* Optional Meta Chips (Only rendered if data exists) */}
                        {(p.usageType || p.memberCount != null || p.profileType) && (
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {p.usageType && (
                              <span className="inline-block rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                {p.usageType}
                              </span>
                            )}
                            {p.memberCount != null && (
                              <span className="inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                {p.memberCount} người
                              </span>
                            )}
                            {p.profileType && (
                              <span className="inline-block rounded-md bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                {p.profileType}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Plan Information & Features Box */}
                {active && (
                  <div className="mt-4 rounded-[24px] border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/30 pb-3">
                      <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
                        <span>
                          Thông tin chi tiết gói: <span className="text-[#2563EB] dark:text-[#35A8FF]">{active.label}</span>
                        </span>
                      </h3>
                      {active.duration && (
                        <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          {active.duration}
                        </span>
                      )}
                    </div>

                    {/* Render Features of the CURRENTLY SELECTED PLAN */}
                    {((active.features && active.features.length > 0) || item.features.length > 0) && (
                      <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                        {((active.features && active.features.length > 0) ? active.features : item.features)
                          .filter((feat) => {
                            if (active.notes && feat.toLowerCase().startsWith('bảo hành')) return false;
                            return true;
                          })
                          .map((feat, idx) => (
                            <li key={`${feat}-${idx}`} className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB] dark:text-[#35A8FF]" />
                              <span>{feat}</span>
                            </li>
                          ))}
                      </ul>
                    )}

                    {/* Additional meta details if present */}
                    {(active.usageType || active.memberCount != null || active.profileType) && (
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30 text-xs">
                        {active.usageType && (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span className="font-medium text-slate-400">Hình thức:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{active.usageType}</span>
                          </div>
                        )}
                        {active.memberCount != null && (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span className="font-medium text-slate-400">Số thành viên:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{active.memberCount} người</span>
                          </div>
                        )}
                        {active.profileType && (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span className="font-medium text-slate-400">Loại profile:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{active.profileType}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {active.notes && (
                      <div className="mt-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-800/60 p-2.5 text-xs font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-2">
                        <span className="text-base shrink-0">🛡️</span>
                        <span>
                          <strong className="font-extrabold text-sky-900 dark:text-sky-200">Bảo hành:</strong>{' '}
                          {active.notes.replace(/^bảo hành:\s*/i, '')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Perks Grid */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {perks.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-[22px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-center shadow-xs transition hover:scale-[1.02]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#35A8FF]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Buy Button */}
          <button
            onClick={() => {
              if (!session) {
                nav('/login', { state: { from: loc.pathname } });
              } else {
                setShowCheckout(true);
              }
            }}
            className="w-full mt-6 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3.5 px-6 text-sm font-black text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-[1.01]"
          >
            🛒 Mua Ngay dịch vụ
          </button>

          {/* Affiliate Referral Share Prompt */}
          {item.affiliateEnabled && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30 p-3">
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-white truncate">
                  🎁 Giới thiệu bạn bè nhận ngay {item.affiliateType === 'percent' ? `${item.affiliateReward}%` : formatVND(item.affiliateReward || 0)} vào ví
                </span>
                <span className="block text-[10px] text-slate-400 font-medium">
                  Cộng thẳng vào Số dư ví BOW khi đơn hoàn tất
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReferral}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition cursor-pointer shrink-0 ${
                  copiedRef
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-50 dark:hover:bg-slate-700'
                }`}
              >
                {copiedRef ? '✓ Đã copy link!' : '🔗 Copy link giới thiệu'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full Description Section */}
      <div className="mt-8 rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
        <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white sm:text-2xl">Giới thiệu sản phẩm</h2>
        <div className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 font-medium whitespace-pre-line">
          {item.longDescription}
        </div>
      </div>

      {/* Product FAQs */}
      {faqs.length > 0 && (
        <div className="mt-6 rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white sm:text-2xl">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group rounded-[20px] border border-[#E7EEF8] dark:border-slate-800 p-4 transition-all duration-300 hover:border-blue-300"
              >
                <summary className="flex cursor-pointer items-center justify-between font-bold text-[#0F172A] dark:text-white text-sm sm:text-base">
                  {f.question}
                  <span className="ml-3 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#35A8FF] font-bold text-lg transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium whitespace-pre-line">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Product Reviews Section */}
      <div className="mt-8">
        <ProductReviewsSection productId={item.id} productName={item.name} />
      </div>

      {/* Related Products Grid */}
      {relatedItems.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white sm:text-2xl">Sản phẩm liên quan</h2>
            <Link to={base} className="text-xs sm:text-sm font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline">
              Xem tất cả &gt;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
            {relatedItems.map((r) => (
              <FeaturedBannerCard key={r.id} item={r} base={base} />
            ))}
          </div>
        </div>
      )}
      {/* Checkout Modal Popup */}
      {item && active && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          item={item}
          plan={active}
          onWalletSuccess={(order) => {
            console.log('6. onWalletSuccess received in Detail.tsx:', order);
            setShowCheckout(false);
            setWalletOrder(order);
          }}
        />
      )}

      {/* Wallet Payment Success Modal — Đơn giản & đồng bộ 100% với SePay (Ảnh 2) */}
      {walletOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setWalletOrder(null)} />
          {/* Modal Container */}
          <div className="relative w-full max-w-lg transform rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 text-center shadow-2xl transition-all sm:p-8 animate-fade-up text-slate-900 dark:text-white">
            <div className="space-y-5 py-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                <CheckIcon className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#0F172A] dark:text-white">Đặt hàng thành công!</h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mt-1">Mã đơn hàng: {walletOrder.code}</p>
                <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Cảm ơn bạn đã tin tưởng BOW. Đơn hàng đã được chuyển sang trạng thái <strong>Chờ bàn giao</strong>. Admin sẽ thiết lập tài khoản và gửi thông tin qua email/mục đơn hàng của bạn trong vòng 5 - 15 phút.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setWalletOrder(null)}
                className="w-full rounded-full bg-[#0F172A] dark:bg-blue-600 py-3 text-sm font-bold text-white hover:bg-black dark:hover:bg-blue-700 transition"
              >
                Đóng và tiếp tục mua sắm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
