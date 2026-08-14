import { useEffect, useRef, useState } from 'react';
import HeroBanner from '../components/HeroBanner';
import Section from '../components/Section';
import AIToolCard from '../components/AIToolCard';
import PremiumAppCard from '../components/PremiumAppCard';
import FeaturedBannerCard from '../components/FeaturedBannerCard';
import TrustBadges from '../components/TrustBadges';
import Skeleton from '../components/Skeleton';
import { fetchByCategory, fetchFeatured } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';
import { SparkIcon, AppIcon, StarIcon } from '../components/icons';

export default function Home() {
  useSeo({});
  const { data: aiTools = [], loading: loadingAi } = useAsync(() => fetchByCategory('ai-tool'), []);
  const { data: apps = [], loading: loadingApps } = useAsync(() => fetchByCategory('premium-app'), []);
  const { data: products = [], loading: loadingProducts } = useAsync(() => fetchFeatured(), []);

  // Limit Desktop AI Tools and Premium Apps
  const displayAiTools = aiTools.slice(0, 8);
  const desktopAiTools = aiTools.slice(0, 6);
  const displayApps = apps.slice(0, 6);
  const featuredProducts = products.slice(0, 3);

  // Mobile Carousel scroll tracking & auto-play for AI Tools
  const [aiScrollIndex, setAiScrollIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const aiCarouselRef = useRef<HTMLDivElement>(null);

  const handleAiScroll = () => {
    if (!aiCarouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = aiCarouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) return;
    const ratio = scrollLeft / maxScroll;
    if (ratio < 0.35) setAiScrollIndex(0);
    else if (ratio < 0.7) setAiScrollIndex(1);
    else setAiScrollIndex(2);
  };

  const scrollToAiDot = (dotIdx: number) => {
    if (!aiCarouselRef.current) return;
    const { scrollWidth, clientWidth } = aiCarouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) return;
    const target = maxScroll * (dotIdx / 2);
    aiCarouselRef.current.scrollTo({ left: target, behavior: 'smooth' });
  };

  // Auto-scroll effect (tự động lướt qua lại)
  useEffect(() => {
    if (loadingAi || displayAiTools.length === 0 || isPaused) return;
    const timer = setInterval(() => {
      setAiScrollIndex((prev) => {
        const next = (prev + 1) % 3;
        scrollToAiDot(next);
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [loadingAi, displayAiTools.length, isPaused]);

  return (
    <div className="space-y-4 pb-10 sm:space-y-6 sm:pb-12">
      {/* Hero Banner */}
      <HeroBanner />

      {/* ⭐ AI Tools */}
      <Section
        icon={<SparkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#2563EB]" />}
        title="AI Tools"
        to="/ai-tools"
      >
        {/* Desktop / Tablet Grid: 6 Items in 1 Row on Desktop */}
        <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4 lg:gap-5">
          {loadingAi ? (
            <Skeleton count={6} variant="tool" />
          ) : (
            desktopAiTools.map((item) => <AIToolCard key={item.id} item={item} />)
          )}
        </div>

        {/* Mobile View: 3 Products Visible in Carousel with Auto-Scroll & Dots */}
        <div className="sm:hidden space-y-3">
          {loadingAi ? (
            <div className="grid grid-cols-3 gap-2">
              <Skeleton count={3} variant="tool" />
            </div>
          ) : (
            <>
              <div
                ref={aiCarouselRef}
                onScroll={handleAiScroll}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className="flex overflow-x-auto gap-2.5 snap-x snap-mandatory px-0.5 pb-2 no-scrollbar scroll-smooth"
              >
                {displayAiTools.map((item) => (
                  <div key={item.id} className="w-[calc(33.333%-7px)] min-w-[105px] xs:min-w-[118px] shrink-0 snap-start">
                    <AIToolCard item={item} />
                  </div>
                ))}
              </div>
              {/* Pagination Dots Indicator */}
              <div className="flex justify-center items-center gap-1.5 pt-0.5">
                {[0, 1, 2].map((dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => {
                      setIsPaused(true);
                      setAiScrollIndex(dotIdx);
                      scrollToAiDot(dotIdx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      aiScrollIndex === dotIdx
                        ? 'w-5 bg-[#2563EB]'
                        : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                    aria-label={`Carousel slide ${dotIdx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </Section>

      {/* 👑 Premium Apps */}
      <Section
        icon={<AppIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#2563EB]" />}
        title="Premium Apps"
        to="/premium-apps"
      >
        {/* Mobile: 3 Columns. Desktop: 6 Columns */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4 lg:gap-5">
          {loadingApps ? (
            <Skeleton count={6} variant="app" />
          ) : (
            displayApps.map((item) => <PremiumAppCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* ✨ Sản phẩm nổi bật */}
      <Section
        icon={<StarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#2563EB]" />}
        title="Sản phẩm nổi bật"
        to="/products"
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 sm:gap-4 lg:gap-5">
          {loadingProducts ? (
            <Skeleton count={3} variant="product" />
          ) : (
            featuredProducts.map((item) => <FeaturedBannerCard key={item.id} item={item} base="/products" />)
          )}
        </div>
      </Section>

      {/* Benefit Badges */}
      <div className="container-bow pt-1">
        <TrustBadges />
      </div>
    </div>
  );
}
