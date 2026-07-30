import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, deleteProduct, setFeatured, setActive, type ProductRow } from '../../data/admin';
import { formatVND } from '../../data/catalog';
import type { ProductType } from '../../lib/database.types';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';

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
  const toast = useToast();

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

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const onDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
    try {
      await deleteProduct(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  };

  const toggleFeatured = async (row: ProductRow) => {
    try {
      await setFeatured(row.id, !row.is_featured);
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_featured: !x.is_featured } : x)));
    } catch (e: any) {
      toast.error('Không thể cập nhật nổi bật: ' + e.message);
    }
  };

  const toggleActive = async (row: ProductRow) => {
    try {
      await setActive(row.id, !row.is_active);
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (e: any) {
      toast.error('Không thể cập nhật hiển thị: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Sản phẩm</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý kho tài khoản AI Tools, Premium Apps và sản phẩm khác.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102 self-start sm:self-auto"
        >
          ➕ Thêm sản phẩm
        </Link>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50 dark:bg-red-950/20 px-4.5 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          ⚠️ {err}
        </div>
      )}

      {/* FILTER & SEARCH */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#131C32] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 rounded-[22px] p-4 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                type === f.key
                  ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-[#F4F8FF] dark:hover:bg-slate-850'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-4 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / slug..."
            className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-semibold text-xs">
            Chưa có sản phẩm nào. Hãy tạo sản phẩm đầu tiên của bạn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-[#F8FBFF] dark:bg-slate-850/40 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-black">
                <tr>
                  <th className="px-6 py-4">Sản phẩm</th>
                  <th className="px-6 py-4">Phân loại</th>
                  <th className="px-6 py-4">Đơn giá</th>
                  <th className="px-6 py-4 text-center">Nổi bật</th>
                  <th className="px-6 py-4 text-center">Kích hoạt</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FF] dark:divide-[#1E2A4A]/30">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F5FAFF]/50 dark:hover:bg-slate-800/10 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={row.logo_url ?? '/assets/bowLogo.jpeg'}
                          alt=""
                          className="h-10 w-10 rounded-xl object-contain border border-slate-100 dark:border-slate-800 bg-white"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-slate-900 dark:text-white text-xs leading-tight">{row.name}</p>
                          <p className="truncate text-[10px] text-slate-400 font-semibold mt-1">/{row.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                      {row.type === 'ai-tool' && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">AI Tool</span>}
                      {row.type === 'premium-app' && <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">Premium App</span>}
                      {row.type === 'product' && <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/20 dark:text-purple-400">Product</span>}
                    </td>
                    <td className="px-6 py-4 font-black text-[#2563EB] text-xs">
                      {formatVND(Number(row.base_price ?? 0))}
                    </td>
                    
                    {/* Switch toggles instead of raw buttons */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleFeatured(row)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          row.is_featured ? 'bg-[#22C55E]' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            row.is_featured ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleActive(row)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          row.is_active ? 'bg-[#22C55E]' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            row.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    
                    {/* SVG Action outline icons */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2.5">
                        <Link
                          to={`/admin/products/${row.id}`}
                          className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] text-slate-500 hover:text-[#2563EB] transition shadow-xs"
                          title="Sửa sản phẩm"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => onDelete(row.id)}
                          className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-red-50 text-slate-500 hover:text-red-500 transition shadow-xs"
                          title="Xóa sản phẩm"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
