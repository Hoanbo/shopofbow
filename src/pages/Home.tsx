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
    <div className="space-y-8 pb-10 sm:space-y-12">
      {/* Hero Banner */}
      <HeroBanner />

      {/* AI Tools */}
      <Section
        icon={<SparkIcon className="h-5 w-5 text-sky-500" />}
        title="AI Tools"
        subtitle="Tài khoản AI chính chủ, kích hoạt tức thì"
        to="/ai-tools"
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {loadingAi ? (
            <Skeleton count={6} variant="tool" />
          ) : (
            aiTools.map((item) => <AIToolCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* Premium Apps */}
      <Section
        icon={<AppIcon className="h-5 w-5 text-sky-500" />}
        title="Premium Apps"
        subtitle="Netflix, Spotify, YouTube... giá siêu tốt"
        to="/premium-apps"
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {loadingApps ? (
            <Skeleton count={6} variant="app" />
          ) : (
            apps.map((item) => <PremiumAppCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* Sản phẩm nổi bật */}
      <Section
        icon={<StarIcon className="h-5 w-5 text-sky-500" />}
        title="Sản phẩm nổi bật"
        subtitle="Công cụ sáng tạo & tiện ích hàng đầu"
        to="/products"
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {loadingProducts ? (
            <Skeleton count={4} variant="product" />
          ) : (
            products.map((item) => <FeaturedBannerCard key={item.id} item={item} base="/products" />)
          )}
        </div>
      </Section>

      {/* Trust Badges */}
      <div className="container-bow">
        <TrustBadges />
      </div>
    </div>
  );
}
