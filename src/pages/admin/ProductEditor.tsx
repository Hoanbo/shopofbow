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
  original_price: 0,
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

  const [form, setForm] = useState({ ...emptyForm });
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  // sub-collections (only when editing an existing product)
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
          original_price: Number(p.original_price ?? 0),
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
    original_price: Number(form.original_price) || null,
    rating: Number(form.rating) || null,
    sold: Number(form.sold) || 0,
    is_active: form.is_active,
    is_featured: form.is_featured,
    sort_order: Number(form.sort_order) || 0,
  });

  const onSave = async () => {
    if (!form.name.trim()) {
      setErr('Vui lòng nhập tên sản phẩm');
      return;
    }
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      if (isNew) {
        const newId = await createProduct(buildPayload());
        setOk('Đã tạo sản phẩm. Đang chuyển sang trang chỉnh sửa...');
        nav(`/admin/products/${newId}`, { replace: true });
      } else {
        await updateProduct(id!, buildPayload());
        setOk('Đã lưu thay đổi.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload thất bại. Kiểm tra Supabase Storage.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-pill bg-brand-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-brand-100/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/products" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            ← Quay lại danh sách
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">
            {isNew ? 'Thêm sản phẩm' : form.name || 'Chỉnh sửa sản phẩm'}
          </h1>
        </div>
        <button onClick={onSave} disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Lưu'}
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

          {/* Plans / Features / FAQ — only after product exists */}
          {isNew ? (
            <AdminCard>
              <p className="text-sm text-ink-muted">
                Lưu sản phẩm trước để thêm gói giá, tính năng và câu hỏi thường gặp.
              </p>
            </AdminCard>
          ) : (
            <>
              <PlansEditor productId={id!} plans={plans} reload={() => loadSubs(id!)} />
              <FeaturesEditor productId={id!} features={features} reload={() => loadSubs(id!)} />
              <FaqEditor productId={id!} faqs={faqs} reload={() => loadSubs(id!)} />
            </>
          )}
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
                label="Giá gốc (₫)"
                type="number"
                value={form.original_price}
                onChange={(e) => set('original_price', Number(e.target.value))}
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
                <span className="mb-1 block text-sm font-semibold text-ink">Màu nhấn</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent}
                    onChange={(e) => set('accent', e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-brand-100"
                  />
                  <input
                    value={form.accent}
                    onChange={(e) => set('accent', e.target.value)}
                    className="h-11 flex-1 rounded-xl border border-brand-100 px-3 text-sm outline-none focus:border-brand-300"
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
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-ink-muted">Trống</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="/assets/... hoặc URL"
            className="h-10 w-full rounded-xl border border-brand-100 px-3 text-sm outline-none focus:border-brand-300"
          />
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-brand-100 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50">
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
              <button onClick={onClear} className="text-xs font-semibold text-rose-600 hover:underline">
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
function PlansEditor({ productId, plans, reload }: { productId: string; plans: PlanRow[]; reload: () => void }) {
  const [draft, setDraft] = useState({ name: '', duration: '', price: 0, original_price: 0, is_highlight: false });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await createPlan({
        product_id: productId,
        name: draft.name.trim(),
        duration: draft.duration || null,
        price: Number(draft.price) || 0,
        original_price: Number(draft.original_price) || null,
        is_highlight: draft.is_highlight,
        sort_order: plans.length + 1,
      });
      setDraft({ name: '', duration: '', price: 0, original_price: 0, is_highlight: false });
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCard title="Gói giá">
      {plans.length > 0 && (
        <div className="mb-4 space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 p-3">
              <span className="font-semibold text-ink">{p.name}</span>
              <span className="text-sm text-ink-muted">{p.duration}</span>
              <span className="text-sm font-bold text-brand-600">{Number(p.price).toLocaleString('vi-VN')}₫</span>
              {p.is_highlight && <span className="chip bg-brand-50 text-brand-700">Nổi bật</span>}
              <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={p.is_highlight}
                  onChange={async (e) => {
                    await updatePlan(p.id, { is_highlight: e.target.checked });
                    reload();
                  }}
                />
                Nổi bật
              </label>
              <DeleteButton
                onDelete={async () => {
                  await deletePlan(p.id);
                  reload();
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Tên gói" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <Field label="Thời hạn" value={draft.duration} onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))} />
        <Field label="Giá (₫)" type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} />
        <Field label="Giá gốc (₫)" type="number" value={draft.original_price} onChange={(e) => setDraft((d) => ({ ...d, original_price: Number(e.target.value) }))} />
      </div>
      <button onClick={add} disabled={busy} className="btn-ghost mt-3 disabled:opacity-60">
        + Thêm gói
      </button>
    </AdminCard>
  );
}

/* ─────────────── Features editor ─────────────── */
function FeaturesEditor({ productId, features, reload }: { productId: string; features: FeatureRow[]; reload: () => void }) {
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await createFeature({ product_id: productId, feature: text.trim(), sort_order: features.length + 1 });
    setText('');
    reload();
  };
  return (
    <AdminCard title="Tính năng nổi bật">
      {features.length > 0 && (
        <ul className="mb-4 space-y-2">
          {features.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-brand-100 p-3">
              <span className="flex-1 text-sm text-ink-soft">{f.feature}</span>
              <DeleteButton
                onDelete={async () => {
                  await deleteFeature(f.id);
                  reload();
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nhập tính năng và Enter"
          className="h-11 flex-1 rounded-xl border border-brand-100 px-3 text-sm outline-none focus:border-brand-300"
        />
        <button onClick={add} className="btn-ghost shrink-0">
          Thêm
        </button>
      </div>
    </AdminCard>
  );
}

/* ─────────────── FAQ editor ─────────────── */
function FaqEditor({ productId, faqs, reload }: { productId: string; faqs: FaqRow[]; reload: () => void }) {
  const [draft, setDraft] = useState({ question: '', answer: '' });
  const add = async () => {
    if (!draft.question.trim()) return;
    await createFaq({
      product_id: productId,
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      sort_order: faqs.length + 1,
    });
    setDraft({ question: '', answer: '' });
    reload();
  };
  return (
    <AdminCard title="Câu hỏi thường gặp (sản phẩm)">
      {faqs.length > 0 && (
        <div className="mb-4 space-y-2">
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl border border-brand-100 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{f.question}</p>
                  <p className="mt-1 text-sm text-ink-muted">{f.answer}</p>
                </div>
                <DeleteButton
                  onDelete={async () => {
                    await deleteFaq(f.id);
                    reload();
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Câu hỏi" value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
        <TextArea label="Trả lời" rows={3} value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
        <button onClick={add} className="btn-ghost">
          + Thêm FAQ
        </button>
      </div>
    </AdminCard>
  );
}
