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

  return (
    <div className="space-y-6 pb-24 sm:space-y-10 sm:pb-16">
      {/* Hero Banner */}
      <HeroBanner />

      {/* ⭐ AI Tools */}
      <Section
        icon={<SparkIcon className="h-6 w-6 text-[#2563EB]" />}
        title="AI Tools"
        to="/ai-tools"
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 lg:grid-cols-6 sm:gap-5 lg:gap-6">
          {loadingAi ? (
            <Skeleton count={6} variant="tool" />
          ) : (
            aiTools.map((item) => <AIToolCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* 👑 Premium Apps */}
      <Section
        icon={<AppIcon className="h-6 w-6 text-[#2563EB]" />}
        title="Premium Apps"
        to="/premium-apps"
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 lg:grid-cols-6 sm:gap-5 lg:gap-6">
          {loadingApps ? (
            <Skeleton count={6} variant="app" />
          ) : (
            apps.map((item) => <PremiumAppCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* ✨ Sản phẩm nổi bật */}
      <Section
        icon={<StarIcon className="h-6 w-6 text-[#2563EB]" />}
        title="Sản phẩm nổi bật"
        to="/products"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loadingProducts ? (
            <Skeleton count={4} variant="product" />
          ) : (
            products.map((item) => <FeaturedBannerCard key={item.id} item={item} base="/products" />)
          )}
        </div>
      </Section>

      {/* Benefit Badges */}
      <div className="container-bow pt-2">
        <TrustBadges />
      </div>
    </div>
  );
}
