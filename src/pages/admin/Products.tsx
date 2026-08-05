import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, deleteProduct, setFeatured, setActive, type ProductRow } from '../../data/admin';
import { formatVND } from '../../data/catalog';
import type { ProductType } from '../../lib/database.types';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';

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
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 6;
  const toast = useToast();

  useEffect(() => {
    setCurrentPage(1);
  }, [type, q]);

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

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const onDelete = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa sản phẩm',
      message: 'Bạn có chắc chắn muốn xóa sản phẩm này không? Hành động này không thể hoàn tác.',
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          setRows((r) => r.filter((x) => x.id !== id));
          toast.success('Xóa sản phẩm thành công!');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
          setErr(e instanceof Error ? e.message : 'Xóa thất bại');
        }
      },
    });
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
        )}
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Xóa sản phẩm"
        variant="danger"
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
