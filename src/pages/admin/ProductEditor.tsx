import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getProduct,
  createProduct,
  updateProduct,
  listCategories,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listFeatures,
  createFeature,
  deleteFeature,
  listFaqs,
  createFaq,
  deleteFaq,
  uploadImage,
  type ProductRow,
  type PlanRow,
  type FeatureRow,
  type FaqRow,
  type CategoryRow,
} from '../../data/admin';
import type { ProductType } from '../../lib/database.types';
import { Field, TextArea, Select, Toggle, DeleteButton, Banner, AdminCard } from '../../components/admin/ui';
import { useToast } from '../../components/Toast';

const emptyForm = {
  name: '',
  slug: '',
  type: 'ai-tool' as ProductType,
  category_id: '',
  short_description: '',
  description: '',
  logo_url: '',
  banner_url: '',
  accent: '#06b6d4',
  badge: '',
  base_price: 0,
  rating: 5,
  sold: 0,
  is_active: true,
  is_featured: false,
  sort_order: 0,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ ...emptyForm });
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  // Sub-collections: Existing DB rows or Local Drafts for new product
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const loadSubs = useCallback(async (pid: string) => {
    const [p, f, q] = await Promise.all([listPlans(pid), listFeatures(pid), listFaqs(pid)]);
    setPlans(p);
    setFeatures(f);
    setFaqs(q);
  }, []);

  useEffect(() => {
    listCategories().then(setCats).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getProduct(id!)
      .then((p) => {
        if (!p) {
          setErr('Không tìm thấy sản phẩm');
          return;
        }
        setForm({
          name: p.name,
          slug: p.slug,
          type: p.type,
          category_id: p.category_id ?? '',
          short_description: p.short_description ?? '',
          description: p.description ?? '',
          logo_url: p.logo_url ?? '',
          banner_url: p.banner_url ?? '',
          accent: p.accent ?? '#06b6d4',
          badge: p.badge ?? '',
          base_price: Number(p.base_price ?? 0),
          rating: Number(p.rating ?? 5),
          sold: p.sold ?? 0,
          is_active: p.is_active,
          is_featured: p.is_featured,
          sort_order: p.sort_order,
        });
        return loadSubs(p.id);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  }, [id, isNew, loadSubs]);

  const buildPayload = (): Partial<ProductRow> => ({
    name: form.name.trim(),
    slug: (form.slug || slugify(form.name)).trim(),
    type: form.type,
    category_id: form.category_id || null,
    short_description: form.short_description || null,
    description: form.description || null,
    logo_url: form.logo_url || null,
    banner_url: form.banner_url || null,
    accent: form.accent || null,
    badge: form.badge || null,
    base_price: Number(form.base_price) || 0,
    original_price: null,
    rating: Number(form.rating) || null,
    sold: Number(form.sold) || 0,
    is_active: form.is_active,
    is_featured: form.is_featured,
    sort_order: Number(form.sort_order) || 0,
  });

  const onSave = async () => {
    if (!form.name.trim()) {
      setErr('Vui lòng nhập tên sản phẩm');
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      if (isNew) {
        // 1. Create main product record
        const newId = await createProduct(buildPayload());

        // 2. Insert any draft plans created before saving
        if (plans.length > 0) {
          for (let i = 0; i < plans.length; i++) {
            const p = plans[i];
            await createPlan({
              product_id: newId,
              name: p.name,
              duration: p.duration || null,
              price: Number(p.price) || 0,
              original_price: null,
              is_highlight: p.is_highlight,
              sort_order: i + 1,
            });
          }
        }

        // 3. Insert any draft features
        if (features.length > 0) {
          for (let i = 0; i < features.length; i++) {
            const f = features[i];
            await createFeature({
              product_id: newId,
              feature: f.feature,
              sort_order: i + 1,
            });
          }
        }

        // 4. Insert any draft FAQs
        if (faqs.length > 0) {
          for (let i = 0; i < faqs.length; i++) {
            const q = faqs[i];
            await createFaq({
              product_id: newId,
              question: q.question,
              answer: q.answer,
              sort_order: i + 1,
            });
          }
        }

        toast.success('🎉 Đã tạo sản phẩm và toàn bộ gói giá, tính năng thành công!');
        nav(`/admin/products/${newId}`, { replace: true });
      } else {
        await updateProduct(id!, buildPayload());
        toast.success('Đã lưu thay đổi sản phẩm!');
        setOk('Đã lưu thay đổi.');
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Lưu thất bại';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (file: File, field: 'logo_url' | 'banner_url') => {
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadImage(file, field === 'logo_url' ? 'logos' : 'banners');
      set(field, url);
      toast.success('Tải ảnh thành công!');
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Upload thất bại. Kiểm tra Supabase Storage.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-full bg-[#1E2A4A]" />
        <div className="h-96 animate-pulse rounded-2xl bg-[#131C32]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/products" className="text-xs font-bold text-[#35A8FF] hover:underline">
            ← Quay lại danh sách
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {isNew ? 'Thêm sản phẩm mới' : form.name || 'Chỉnh sửa sản phẩm'}
          </h1>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102 disabled:opacity-60"
        >
          {saving ? 'Đang lưu...' : '💾 Lưu lại'}
        </button>
      </div>

      {err && <Banner kind="error">{err}</Banner>}
      {ok && <Banner kind="success">{ok}</Banner>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* main info */}
        <div className="space-y-5 lg:col-span-2">
          <AdminCard title="Thông tin cơ bản">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tên sản phẩm"
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!slugTouched) set('slug', slugify(e.target.value));
                }}
              />
              <Field
                label="Slug (URL)"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value);
                }}
                hint="Dùng trong đường dẫn, ví dụ: chatgpt-plus"
              />
              <Select label="Loại" value={form.type} onChange={(e) => set('type', e.target.value as ProductType)}>
                <option value="ai-tool">AI Tool</option>
                <option value="premium-app">Premium App</option>
                <option value="product">Sản phẩm</option>
              </Select>
              <Select
                label="Danh mục"
                value={form.category_id}
                onChange={(e) => set('category_id', e.target.value)}
              >
                <option value="">— Không —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-4">
              <Field
                label="Mô tả ngắn"
                value={form.short_description}
                onChange={(e) => set('short_description', e.target.value)}
                hint="Hiển thị trên card sản phẩm"
              />
            </div>
            <div className="mt-4">
              <TextArea
                label="Mô tả chi tiết"
                rows={5}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </AdminCard>

          {/* Media */}
          <AdminCard title="Hình ảnh">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField
                label="Logo"
                url={form.logo_url}
                uploading={uploading}
                onUpload={(f) => onUpload(f, 'logo_url')}
                onClear={() => set('logo_url', '')}
                onUrl={(v) => set('logo_url', v)}
              />
              <ImageField
                label="Banner"
                url={form.banner_url}
                uploading={uploading}
                onUpload={(f) => onUpload(f, 'banner_url')}
                onClear={() => set('banner_url', '')}
                onUrl={(v) => set('banner_url', v)}
              />
            </div>
          </AdminCard>

          {/* Plans / Features / FAQ — Available IMMEDIATELY for both New & Edit */}
          <PlansEditor
            productId={id || 'new'}
            isNew={isNew}
            plans={plans}
            setPlans={setPlans}
            reload={() => !isNew && loadSubs(id!)}
          />
          <FeaturesEditor
            productId={id || 'new'}
            isNew={isNew}
            features={features}
            setFeatures={setFeatures}
            reload={() => !isNew && loadSubs(id!)}
          />
          <FaqEditor
            productId={id || 'new'}
            isNew={isNew}
            faqs={faqs}
            setFaqs={setFaqs}
            reload={() => !isNew && loadSubs(id!)}
          />
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <AdminCard title="Hiển thị">
            <div className="space-y-4">
              <Toggle label="Đang bán (hiển thị)" checked={form.is_active} onChange={(v) => set('is_active', v)} />
              <Toggle label="Sản phẩm nổi bật" checked={form.is_featured} onChange={(v) => set('is_featured', v)} />
              <Field
                label="Thứ tự sắp xếp"
                type="number"
                value={form.sort_order}
                onChange={(e) => set('sort_order', Number(e.target.value))}
              />
            </div>
          </AdminCard>

          <AdminCard title="Giá & đánh giá">
            <div className="space-y-4">
              <Field
                label="Giá bán (₫)"
                type="number"
                value={form.base_price}
                onChange={(e) => set('base_price', Number(e.target.value))}
              />
              <Field
                label="Đánh giá (0-5)"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => set('rating', Number(e.target.value))}
              />
              <Field
                label="Đã bán"
                type="number"
                value={form.sold}
                onChange={(e) => set('sold', Number(e.target.value))}
              />
            </div>
          </AdminCard>

          <AdminCard title="Giao diện">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Màu nhấn</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent}
                    onChange={(e) => set('accent', e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-1"
                  />
                  <input
                    value={form.accent}
                    onChange={(e) => set('accent', e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none"
                  />
                </div>
              </label>
              <Field label="Nhãn (badge)" value={form.badge} onChange={(e) => set('badge', e.target.value)} hint="Ví dụ: Bán chạy, HOT" />
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Image field ─────────────── */
function ImageField({
  label,
  url,
  uploading,
  onUpload,
  onClear,
  onUrl,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onUpload: (f: File) => void;
  onClear: () => void;
  onUrl: (v: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-bold text-slate-400">Trống</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="/assets/... hoặc URL"
            className="h-10 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-700">
              {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
            {url && (
              <button onClick={onClear} className="text-xs font-bold text-rose-500 hover:underline">
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Plans editor ─────────────── */
function PlansEditor({
  productId,
  isNew,
  plans,
  setPlans,
  reload,
}: {
  productId: string;
  isNew: boolean;
  plans: PlanRow[];
  setPlans: React.Dispatch<React.SetStateAction<PlanRow[]>>;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({ name: '', duration: '', price: 0, is_highlight: false });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const add = async () => {
    if (!draft.name.trim()) {
      toast.error('Vui lòng nhập tên gói giá');
      return;
    }
    if (!draft.price || Number(draft.price) <= 0) {
      toast.error('Vui lòng nhập giá cho gói');
      return;
    }

    if (isNew) {
      // Local draft mode for new product
      const newPlanDraft: PlanRow = {
        id: `draft-${Date.now()}-${Math.random()}`,
        product_id: 'new',
        name: draft.name.trim(),
        duration: draft.duration.trim() || null,
        price: Number(draft.price) || 0,
        original_price: null,
        description: null,
        is_highlight: draft.is_highlight,
        is_active: true,
        sort_order: plans.length + 1,
      };
      setPlans((prev) => [...prev, newPlanDraft]);
      setDraft({ name: '', duration: '', price: 0, is_highlight: false });
      toast.success('Đã thêm gói giá vào bản nháp!');
      return;
    }

    // Direct DB mode for existing product
    setBusy(true);
    try {
      await createPlan({
        product_id: productId,
        name: draft.name.trim(),
        duration: draft.duration.trim() || null,
        price: Number(draft.price) || 0,
        original_price: null,
        is_highlight: draft.is_highlight,
        sort_order: plans.length + 1,
      });
      setDraft({ name: '', duration: '', price: 0, is_highlight: false });
      toast.success('Đã thêm gói giá mới thành công!');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể thêm gói giá');
    } finally {
      setBusy(false);
    }
  };

  const removePlan = async (idToRemove: string) => {
    if (isNew) {
      setPlans((prev) => prev.filter((p) => p.id !== idToRemove));
      toast.success('Đã xóa gói giá!');
      return;
    }
    try {
      await deletePlan(idToRemove);
      toast.success('Đã xóa gói giá!');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi xóa gói');
    }
  };

  const toggleHighlight = async (p: PlanRow) => {
    if (isNew) {
      setPlans((prev) => prev.map((item) => (item.id === p.id ? { ...item, is_highlight: !item.is_highlight } : item)));
      return;
    }
    try {
      await updatePlan(p.id, { is_highlight: !p.is_highlight });
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi cập nhật nổi bật');
    }
  };

  return (
    <AdminCard title="Gói giá">
      {plans.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {plans.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 shadow-xs">
              <span className="font-extrabold text-slate-900 dark:text-white text-xs">{p.name}</span>
              {p.duration && <span className="text-xs text-slate-400 font-semibold">({p.duration})</span>}
              <span className="text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">{Number(p.price).toLocaleString('vi-VN')}₫</span>
              {p.is_highlight && (
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-[9px] font-extrabold text-[#2563EB] dark:text-[#35A8FF]">
                  ⭐ Nổi bật
                </span>
              )}
              <label className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={p.is_highlight}
                  onChange={() => toggleHighlight(p)}
                  className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                Nổi bật
              </label>
              <DeleteButton onDelete={() => removePlan(p.id)} />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Tên gói" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ví dụ: netflix farm 5 profile..." />
        <Field label="Thời hạn" value={draft.duration} onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))} placeholder="Ví dụ: 30 ngày..." />
        <Field label="Giá (₫)" type="number" value={draft.price || ''} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} placeholder="0" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.is_highlight}
            onChange={(e) => setDraft((d) => ({ ...d, is_highlight: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
          />
          Đặt làm Gói nổi bật (Hot / Khuyên dùng)
        </label>

        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-sky-500 hover:to-blue-700 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-500/20 transition-all hover:scale-102 active:scale-98 disabled:opacity-60 cursor-pointer"
        >
          {busy ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Đang thêm...
            </>
          ) : (
            <>
              <span>➕</span>
              <span>Thêm gói giá này</span>
            </>
          )}
        </button>
      </div>
    </AdminCard>
  );
}

/* ─────────────── Features editor ─────────────── */
function FeaturesEditor({
  productId,
  isNew,
  features,
  setFeatures,
  reload,
}: {
  productId: string;
  isNew: boolean;
  features: FeatureRow[];
  setFeatures: React.Dispatch<React.SetStateAction<FeatureRow[]>>;
  reload: () => void;
}) {
  const [text, setText] = useState('');
  const toast = useToast();

  const add = async () => {
    if (!text.trim()) return;
    if (isNew) {
      const draftFeature: FeatureRow = {
        id: `draft-feat-${Date.now()}-${Math.random()}`,
        product_id: 'new',
        feature: text.trim(),
        sort_order: features.length + 1,
      };
      setFeatures((prev) => [...prev, draftFeature]);
      setText('');
      toast.success('Đã thêm tính năng vào bản nháp!');
      return;
    }

    try {
      await createFeature({ product_id: productId, feature: text.trim(), sort_order: features.length + 1 });
      setText('');
      toast.success('Đã thêm tính năng!');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Không thể thêm tính năng');
    }
  };

  const removeFeature = async (fid: string) => {
    if (isNew) {
      setFeatures((prev) => prev.filter((f) => f.id !== fid));
      toast.success('Đã xóa tính năng!');
      return;
    }
    try {
      await deleteFeature(fid);
      toast.success('Đã xóa tính năng!');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi khi xóa tính năng');
    }
  };

  return (
    <AdminCard title="Tính năng nổi bật">
      {features.length > 0 && (
        <ul className="mb-4 space-y-2">
          {features.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3">
              <span className="flex-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{f.feature}</span>
              <DeleteButton onDelete={() => removeFeature(f.id)} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nhập tính năng và nhấn Enter..."
          className="h-11 flex-1 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none"
        />
        <button
          onClick={add}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:scale-102 shrink-0"
        >
          ➕ Thêm
        </button>
      </div>
    </AdminCard>
  );
}

/* ─────────────── FAQ editor ─────────────── */
function FaqEditor({
  productId,
  isNew,
  faqs,
  setFaqs,
  reload,
}: {
  productId: string;
  isNew: boolean;
  faqs: FaqRow[];
  setFaqs: React.Dispatch<React.SetStateAction<FaqRow[]>>;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({ question: '', answer: '' });
  const toast = useToast();

  const add = async () => {
    if (!draft.question.trim()) return;
    if (isNew) {
      const draftFaqItem: FaqRow = {
        id: `draft-faq-${Date.now()}-${Math.random()}`,
        product_id: 'new',
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        sort_order: faqs.length + 1,
      };
      setFaqs((prev) => [...prev, draftFaqItem]);
      setDraft({ question: '', answer: '' });
      toast.success('Đã thêm câu hỏi FAQ vào bản nháp!');
      return;
    }

    try {
      await createFaq({
        product_id: productId,
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        sort_order: faqs.length + 1,
      });
      setDraft({ question: '', answer: '' });
      toast.success('Đã thêm câu hỏi FAQ!');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Không thể thêm FAQ');
    }
  };

  const removeFaq = async (fqid: string) => {
    if (isNew) {
      setFaqs((prev) => prev.filter((f) => f.id !== fqid));
      toast.success('Đã xóa FAQ!');
      return;
    }
    try {
      await deleteFaq(fqid);
      toast.success('Đã xóa FAQ!');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi khi xóa FAQ');
    }
  };

  return (
    <AdminCard title="Câu hỏi thường gặp (FAQ)">
      {faqs.length > 0 && (
        <div className="mb-4 space-y-2">
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 dark:text-white text-xs">{f.question}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">{f.answer}</p>
                </div>
                <DeleteButton onDelete={() => removeFaq(f.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Câu hỏi" value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} placeholder="Ví dụ: Tài khoản dùng được mấy thiết bị?" />
        <TextArea label="Trả lời" rows={3} value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} placeholder="Nhập câu trả lời chi tiết..." />
        <button
          onClick={add}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102"
        >
          ➕ Thêm câu hỏi FAQ
        </button>
      </div>
    </AdminCard>
  );
}
