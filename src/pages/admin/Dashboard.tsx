import { Link } from 'react-router-dom';
import { fetchStats } from '../../data/admin';
import { useAsync } from '../../hooks/useAsync';
import { SparkIcon, AppIcon, BagIcon, StarIcon, ArrowRight } from '../../components/icons';

const cards = [
  { key: 'totalProducts', label: 'Tổng sản phẩm', Icon: BagIcon, accent: '#06b6d4' },
  { key: 'totalAiTools', label: 'AI Tools', Icon: SparkIcon, accent: '#7c3aed' },
  { key: 'totalPremiumApps', label: 'Premium Apps', Icon: AppIcon, accent: '#e50914' },
  { key: 'totalFeatured', label: 'Sản phẩm nổi bật', Icon: StarIcon, accent: '#f5b301' },
] as const;

export default function Dashboard() {
  const { data: stats, loading, error } = useAsync(() => fetchStats(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Tổng quan</h1>
        <p className="text-sm text-ink-muted">Thống kê nhanh toàn bộ cửa hàng.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Không tải được thống kê: {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ key, label, Icon, accent }) => (
          <div key={key} className="rounded-2xl border border-brand-100 bg-white p-5 shadow-soft">
            <span
              className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-soft"
              style={{ backgroundColor: accent }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-3xl font-extrabold text-ink">
              {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-brand-100" /> : stats?.[key] ?? 0}
            </p>
            <p className="text-sm text-ink-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/products"
          className="group flex items-center justify-between rounded-2xl border border-brand-100 bg-white p-5 shadow-soft transition hover:shadow-card"
        >
          <div>
            <h3 className="font-bold text-ink">Quản lý sản phẩm</h3>
            <p className="text-sm text-ink-muted">Thêm, sửa, xóa AI Tools, Premium Apps, sản phẩm.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-brand-500 transition group-hover:translate-x-1" />
        </Link>
        <Link
          to="/admin/contact"
          className="group flex items-center justify-between rounded-2xl border border-brand-100 bg-white p-5 shadow-soft transition hover:shadow-card"
        >
          <div>
            <h3 className="font-bold text-ink">Cài đặt liên hệ</h3>
            <p className="text-sm text-ink-muted">Cập nhật Facebook, Zalo, hotline, email.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-brand-500 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
