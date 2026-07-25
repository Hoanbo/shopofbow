import { useCallback, useEffect, useState } from 'react';
import {
  listCategories,
  createCategory,
  deleteCategory,
  type CategoryRow,
} from '../../data/admin';
import type { ProductType } from '../../lib/database.types';
import { Field, Select, DeleteButton, Banner, AdminCard } from '../../components/admin/ui';

const typeLabels: Record<ProductType, string> = {
  'ai-tool': 'AI Tool',
  'premium-app': 'Premium App',
  product: 'Sản phẩm',
};

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
  const [draft, setDraft] = useState({ name: '', slug: '', type: 'ai-tool' as ProductType, sort_order: 0 });
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

  const add = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createCategory({
        name: draft.name.trim(),
        slug: (draft.slug || slugify(draft.name)).trim(),
        type: draft.type,
        sort_order: Number(draft.sort_order) || 0,
      });
      setDraft({ name: '', slug: '', type: 'ai-tool', sort_order: 0 });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Danh mục</h1>
        <p className="text-sm text-ink-muted">Nhóm sản phẩm theo AI Tools, Premium Apps hoặc sản phẩm.</p>
      </div>

      {err && <Banner kind="error">{err}</Banner>}

      <AdminCard title="Thêm danh mục">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field
            label="Tên"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, slug: slugify(e.target.value) }))}
          />
          <Field label="Slug" value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} />
          <Select label="Loại" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ProductType }))}>
            <option value="ai-tool">AI Tool</option>
            <option value="premium-app">Premium App</option>
            <option value="product">Sản phẩm</option>
          </Select>
          <Field
            label="Thứ tự"
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
          />
        </div>
        <button onClick={add} disabled={busy} className="btn-primary mt-4 disabled:opacity-60">
          {busy ? 'Đang thêm...' : '+ Thêm danh mục'}
        </button>
      </AdminCard>

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-brand-50/40" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-ink-muted">Chưa có danh mục nào.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/40 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-brand-50/30">
                  <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-ink-muted">/{c.slug}</td>
                  <td className="px-4 py-3 text-ink-soft">{typeLabels[c.type]}</td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton onDelete={() => onDelete(c.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
