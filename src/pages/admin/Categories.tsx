import { useCallback, useEffect, useState } from 'react';
import {
  listCategories,
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryRow,
} from '../../data/admin';
import type { ProductType } from '../../lib/database.types';
import { SearchIcon } from '../../components/icons';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function AdminCategories() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  // Filters & Searches State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'sort_order' | 'name'>('sort_order');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  
  // Form Draft State
  const [draft, setDraft] = useState({
    name: '',
    slug: '',
    type: 'ai-tool' as ProductType,
    sort_order: 0
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setRows(await listCategories());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAddModal = () => {
    setEditingCategory(null);
    setDraft({ name: '', slug: '', type: 'ai-tool', sort_order: 0 });
    setShowModal(true);
  };

  const openEditModal = (c: CategoryRow) => {
    setEditingCategory(c);
    setDraft({
      name: c.name,
      slug: c.slug,
      type: c.type,
      sort_order: c.sort_order
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      if (editingCategory) {
        // Edit existing
        await updateCategory(editingCategory.id, {
          name: draft.name.trim(),
          slug: (draft.slug || slugify(draft.name)).trim(),
          type: draft.type,
          sort_order: Number(draft.sort_order) || 0,
        });
      } else {
        // Create new
        await createCategory({
          name: draft.name.trim(),
          slug: (draft.slug || slugify(draft.name)).trim(),
          type: draft.type,
          sort_order: Number(draft.sort_order) || 0,
        });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    try {
      await deleteCategory(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  };

  // Stats Counters
  const countAI = rows.filter((r) => r.type === 'ai-tool').length;
  const countApps = rows.filter((r) => r.type === 'premium-app').length;
  const countProducts = rows.filter((r) => r.type === 'product').length;

  // Filter & Sort rows
  const processedRows = rows
    .filter((r) => {
      const matchesType = filterType === 'all' || r.type === filterType;
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.slug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'sort_order') {
        return a.sort_order - b.sort_order;
      } else {
        return a.name.localeCompare(b.name);
      }
    });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Danh mục</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý phân loại danh mục sản phẩm của BOW.</p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102 self-start sm:self-auto"
        >
          ➕ Thêm danh mục
        </button>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50 dark:bg-red-950/20 px-4.5 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          ⚠️ {err}
        </div>
      )}

      {/* STATISTICS COUNTERS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Tổng số danh mục', val: rows.length, bg: 'bg-blue-50 dark:bg-blue-950/20 text-[#2563EB] dark:text-[#35A8FF]' },
          { label: 'Danh mục AI Tools', val: countAI, bg: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' },
          { label: 'Danh mục Premium Apps', val: countApps, bg: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400' },
          { label: 'Danh mục Sản phẩm', val: countProducts, bg: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.label}</span>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{s.val}</span>
              <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold ${s.bg}`}>
                #
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* FILTER, SEARCH, SORT ROW */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#131C32] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 rounded-[22px] p-4 shadow-xs">
        <div className="flex flex-wrap gap-2.5">
          {/* Type filter dropdown */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
          >
            <option value="all">Mọi loại danh mục</option>
            <option value="ai-tool">AI Tool</option>
            <option value="premium-app">Premium App</option>
            <option value="product">Sản phẩm</option>
          </select>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-10 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
          >
            <option value="sort_order">Sắp xếp: Thứ tự hiển thị</option>
            <option value="name">Sắp xếp: Tên danh mục</option>
          </select>
        </div>

        {/* Search input */}
        <div className="flex h-10 items-center gap-2 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-4 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-4.5 w-4.5 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm danh mục..."
            className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* CATEGORIES TABLE CARD */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
          </div>
        ) : processedRows.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-semibold text-xs">
            Không tìm thấy danh mục nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-[#F8FBFF] dark:bg-slate-850/40 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-black">
                <tr>
                  <th className="px-6 py-4">Tên danh mục</th>
                  <th className="px-6 py-4">Đường dẫn slug</th>
                  <th className="px-6 py-4">Thuộc nhóm</th>
                  <th className="px-6 py-4 text-center">Số thứ tự</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FF] dark:divide-[#1E2A4A]/30">
                {processedRows.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F5FAFF]/50 dark:hover:bg-slate-800/10 transition-colors duration-150">
                    <td className="px-6 py-4 font-extrabold text-slate-900 dark:text-white">
                      {c.name}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-400">
                      /{c.slug}
                    </td>
                    <td className="px-6 py-4">
                      {c.type === 'ai-tool' && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">AI Tool</span>}
                      {c.type === 'premium-app' && <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">Premium App</span>}
                      {c.type === 'product' && <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/20 dark:text-purple-400">Product</span>}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">
                      {c.sort_order}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] text-slate-500 hover:text-[#2563EB] transition shadow-xs"
                          title="Sửa danh mục"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-red-50 text-slate-500 hover:text-red-500 transition shadow-xs"
                          title="Xóa danh mục"
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

      {/* RENDER MODAL THÊM / SỬA DANH MỤC */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowModal(false)} />
          
          <form onSubmit={handleSave} className="relative w-full max-w-md transform overflow-hidden rounded-[24px] border border-slate-100 bg-white dark:bg-[#131C32] p-6 sm:p-8 shadow-2xl transition-all text-left space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {editingCategory ? '📝 Cập nhật danh mục' : '📂 Thêm danh mục mới'}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Tên danh mục</label>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, slug: slugify(e.target.value) }))}
                  placeholder="Ví dụ: AI Chatbot, Game Premium..."
                  className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Đường dẫn Slug</label>
                <input
                  type="text"
                  required
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Thuộc loại nhóm</label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ProductType }))}
                  className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value="ai-tool">AI Tool</option>
                  <option value="premium-app">Premium App</option>
                  <option value="product">Sản phẩm</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Thứ tự sắp xếp hiển thị</label>
                <input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
                  className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-50 dark:border-slate-800 mt-5">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-500 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
              >
                {busy ? 'Đang lưu...' : '💾 Lưu lại'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
