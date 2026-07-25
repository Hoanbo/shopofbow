import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, deleteProduct, setFeatured, setActive, type ProductRow } from '../../data/admin';
import { formatVND } from '../../data/catalog';
import type { ProductType } from '../../lib/database.types';
import { DeleteButton, Banner } from '../../components/admin/ui';
import { SearchIcon } from '../../components/icons';

type Filter = 'all' | ProductType;

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'ai-tool', label: 'AI Tools' },
  { key: 'premium-app', label: 'Premium Apps' },
  { key: 'product', label: 'Sản phẩm' },
];

export default function AdminProducts() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listProducts({ type: type === 'all' ? undefined : type, search: q });
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [type, q]);

  // run on mount + when filters change (debounced for search)
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const onDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  };
  const toggleFeatured = async (row: ProductRow) => {
    await setFeatured(row.id, !row.is_featured);
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_featured: !x.is_featured } : x)));
  };
  const toggleActive = async (row: ProductRow) => {
    await setActive(row.id, !row.is_active);
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_active: !x.is_active } : x)));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Sản phẩm</h1>
          <p className="text-sm text-ink-muted">Quản lý toàn bộ AI Tools, Premium Apps và sản phẩm.</p>
        </div>
        <Link to="/admin/products/new" className="btn-primary">
          + Thêm sản phẩm
        </Link>
      </div>

      {err && <Banner kind="error">{err}</Banner>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={`rounded-pill px-3.5 py-2 text-sm font-semibold transition ${
                type === f.key ? 'bg-brand-gradient text-white shadow-card' : 'border border-brand-100 bg-white text-ink-soft hover:bg-brand-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex h-11 items-center gap-2 rounded-pill border border-brand-100 bg-white px-4 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-5 w-5 shrink-0 text-brand-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / slug..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
        {loading ? (
          <div className="divide-y divide-brand-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-brand-50/40" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-ink-muted">Chưa có sản phẩm nào. Hãy thêm mới.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-brand-100 bg-brand-50/40 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Giá</th>
                  <th className="px-4 py-3 text-center">Nổi bật</th>
                  <th className="px-4 py-3 text-center">Hiển thị</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={row.logo_url ?? '/assets/bowLogo.jpeg'}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 rounded-lg object-contain"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{row.name}</p>
                          <p className="truncate text-xs text-ink-muted">/{row.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.type}</td>
                    <td className="px-4 py-3 font-semibold text-brand-600">{formatVND(Number(row.base_price ?? 0))}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleFeatured(row)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.is_featured ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-ink-muted'
                        }`}
                      >
                        {row.is_featured ? 'Có' : 'Không'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(row)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {row.is_active ? 'Bật' : 'Tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/products/${row.id}`}
                          className="rounded-lg border border-brand-100 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                        >
                          Sửa
                        </Link>
                        <DeleteButton onDelete={() => onDelete(row.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
