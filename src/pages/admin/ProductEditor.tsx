import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  getProduct,
  listProducts,
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
import { Field, TextArea, Select, Toggle, DeleteButton, AdminCard } from '../../components/admin/ui';
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
  price_ctv: 0,
  affiliate_enabled: true,
  affiliate_type: 'fixed' as 'fixed' | 'percent',
  affiliate_reward: 0,
  affiliate_discount: 0,
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
          toast.error('Không tìm thấy sản phẩm');
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
          price_ctv: Number(p.price_ctv ?? 0),
          affiliate_enabled: p.affiliate_enabled !== false,
          affiliate_type: (p.affiliate_type as 'fixed' | 'percent') || 'fixed',
          affiliate_reward: Number(p.affiliate_reward ?? 0),
          affiliate_discount: Number(p.affiliate_discount ?? 0),
          rating: Number(p.rating ?? 5),
          sold: p.sold ?? 0,
          is_active: p.is_active,
          is_featured: p.is_featured,
          sort_order: p.sort_order,
        });
        return loadSubs(p.id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Lỗi tải dữ liệu'))
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
    price_ctv: Number(form.price_ctv) > 0 ? Number(form.price_ctv) : null,
    affiliate_enabled: form.affiliate_enabled,
    affiliate_type: form.affiliate_type,
    affiliate_reward: Number(form.affiliate_reward) || 0,
    affiliate_discount: Number(form.affiliate_discount) || 0,
    original_price: null,
    rating: Number(form.rating) || null,
    sold: Number(form.sold) || 0,
    is_active: form.is_active,
    is_featured: form.is_featured,
    sort_order: Number(form.sort_order) || 0,
  });

  const onSave = async () => {
    if (saving) return;

    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }
    if (form.base_price != null && Number(form.base_price) < 0) {
      toast.error('Giá bán sản phẩm không được là số âm');
      return;
    }
    setSaving(true);
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

        (supabase.from('audit_logs') as any).insert([
          {
            actor_name: 'Admin',
            actor_role: 'admin',
            action: 'create_product',
            entity_type: 'product',
            entity_id: newId,
            description: `Admin đã tạo sản phẩm mới "${form.name}" (Mã #${newId})`,
            metadata: { product_id: newId, name: form.name, base_price: form.base_price }
          }
        ]).then(() => {});

        toast.success('Đã lưu sản phẩm thành công');
        nav(`/admin/products/${newId}`, { replace: true });
      } else {
        await updateProduct(id!, buildPayload());

        (supabase.from('audit_logs') as any).insert([
          {
            actor_name: 'Admin',
            actor_role: 'admin',
            action: 'update_product',
            entity_type: 'product',
            entity_id: id!,
            description: `Admin đã cập nhật thông tin sản phẩm "${form.name}"`,
            metadata: { product_id: id!, name: form.name, base_price: form.base_price }
          }
        ]).then(() => {});

        toast.success('Đã lưu sản phẩm thành công');
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Lưu sản phẩm thất bại';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (file: File, field: 'logo_url' | 'banner_url') => {
    setUploading(true);
    try {
      const url = await uploadImage(file, field === 'logo_url' ? 'logos' : 'banners');
      set(field, url);
      toast.success('Tải ảnh thành công!');
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Upload thất bại. Kiểm tra Supabase Storage.';
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
            <div className="space-y-6">
              <LogoPicker
                url={form.logo_url}
                uploading={uploading}
                onUpload={(f) => onUpload(f, 'logo_url')}
                onClear={() => set('logo_url', '')}
                onSelect={(v) => set('logo_url', v)}
              />
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <ImageField
                  label="Banner"
                  url={form.banner_url}
                  uploading={uploading}
                  onUpload={(f) => onUpload(f, 'banner_url')}
                  onClear={() => set('banner_url', '')}
                  onUrl={(v) => set('banner_url', v)}
                />
              </div>
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

          <AdminCard title="Giá & Đánh giá">
            <div className="space-y-4">
              <Field
                label="Giá bán lẻ (₫)"
                type="number"
                min="0"
                value={form.base_price}
                onChange={(e) => set('base_price', Math.max(0, Number(e.target.value) || 0))}
              />
              <Field
                label="👑 Giá Sỉ CTV (₫)"
                type="number"
                min="0"
                value={form.price_ctv || ''}
                onChange={(e) => set('price_ctv', Math.max(0, Number(e.target.value) || 0))}
                hint="Giá ưu đãi khi tài khoản CTV đăng nhập (0 hoặc để trống = dùng giá bán lẻ)"
              />
              <Field
                label="Đánh giá (0-5)"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => set('rating', Math.min(5, Math.max(0, Number(e.target.value) || 0)))}
              />
              <Field
                label="Đã bán"
                type="number"
                min="0"
                value={form.sold}
                onChange={(e) => set('sold', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </AdminCard>

          <AdminCard title="🤝 Tiếp thị liên kết (Affiliate)">
            <div className="space-y-4">
              <Toggle
                label="Bật Affiliate cho sản phẩm này"
                checked={form.affiliate_enabled}
                onChange={(v) => set('affiliate_enabled', v)}
              />
              {form.affiliate_enabled && (
                <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">
                      Loại hoa hồng giới thiệu
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#0B132B] border border-slate-200/80 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => set('affiliate_type', 'fixed')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
                          form.affiliate_type === 'fixed'
                            ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-[#35A8FF] shadow-sm border border-slate-200/80 dark:border-slate-700 ring-1 ring-blue-500/10'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="text-sm">💰</span>
                        <span>Cố định (VNĐ)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => set('affiliate_type', 'percent')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
                          form.affiliate_type === 'percent'
                            ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-[#35A8FF] shadow-sm border border-slate-200/80 dark:border-slate-700 ring-1 ring-blue-500/10'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="text-sm">📊</span>
                        <span>Theo phần trăm (%)</span>
                      </button>
                    </div>
                  </div>

                  <Field
                    label={form.affiliate_type === 'percent' ? 'Hoa hồng người giới thiệu (%)' : 'Hoa hồng người giới thiệu (₫)'}
                    type="number"
                    min="0"
                    value={form.affiliate_reward || ''}
                    onChange={(e) => set('affiliate_reward', Math.max(0, Number(e.target.value) || 0))}
                    hint="Cộng thẳng vào ví tiền web của người giới thiệu khi đơn hoàn thành"
                  />
                </div>
              )}
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

/* ─────────────── Preset Logos ─────────────── */
const PRESET_LOGOS: { name: string; url: string }[] = [
  { name: 'BOW Logo (Mặc định)', url: '/assets/logos/bowLogo.jpeg' },
  { name: 'Canva Pro', url: '/assets/logos/canva-pro.jpg' },
  { name: 'CapCut Pro', url: '/assets/logos/capcut-pro.png' },
  { name: 'ChatGPT Plus', url: '/assets/logos/chatgpt-plus.png' },
  { name: 'Claude Pro', url: '/assets/logos/claude.jpg' },
  { name: 'Claude API', url: '/assets/logos/api-claude.png' },
  { name: 'Codex API', url: '/assets/logos/api-codex.png' },
  { name: 'Cursor Pro', url: '/assets/logos/cursor-pro.jpg' },
  { name: 'Gemini Pro', url: '/assets/logos/gemini-pro.jpg' },
  { name: 'Grok Premium', url: '/assets/logos/grok-premium.png' },
  { name: 'Kling AI', url: '/assets/logos/kling-ai.jpg' },
  { name: 'Leonardo AI', url: '/assets/logos/leonardo-ai.png' },
  { name: 'Locket Gold', url: '/assets/logos/locket-gold.png' },
  { name: 'Meitu SVIP', url: '/assets/logos/meitu-svip.png' },
  { name: 'Netflix Premium', url: '/assets/logos/netflix-premium.png' },
  { name: 'Notion', url: '/assets/logos/notion.png' },
  { name: 'Perplexity Pro', url: '/assets/logos/perplexity-pro.jpg' },
  { name: 'Spotify Premium', url: '/assets/logos/spotify-premium.jpg' },
  { name: 'TV360 Standard', url: '/assets/logos/tv360-standard.png' },
  { name: 'Veo3', url: '/assets/logos/veo3.png' },
  { name: 'Youku VIP', url: '/assets/logos/youku-vip.png' },
  { name: 'YouTube Premium', url: '/assets/logos/youtube-premium.jpg' },
];

/* ─────────────── Logo Picker Component ─────────────── */
function LogoPicker({
  url,
  uploading,
  onUpload,
  onClear,
  onSelect,
}: {
  url: string;
  uploading: boolean;
  onUpload: (f: File) => void;
  onClear: () => void;
  onSelect: (v: string) => void;
}) {
  const [showGallery, setShowGallery] = useState(false);
  const [search, setSearch] = useState('');
  const [dbLogos, setDbLogos] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    listProducts()
      .then((prods) => {
        const uniqueMap = new Map<string, string>();
        for (const p of prods) {
          if (p.logo_url && !uniqueMap.has(p.logo_url)) {
            uniqueMap.set(p.logo_url, p.name);
          }
        }
        const extra: { name: string; url: string }[] = [];
        uniqueMap.forEach((name, u) => {
          if (!PRESET_LOGOS.some((pr) => pr.url === u)) {
            extra.push({ name, url: u });
          }
        });
        setDbLogos(extra);
      })
      .catch(() => {});
  }, []);

  const allLogos = [...PRESET_LOGOS, ...dbLogos];
  const filtered = allLogos.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.url.toLowerCase().includes(search.toLowerCase())
  );

  const displayUrl = url || '/assets/logos/bowLogo.jpeg';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Logo sản phẩm (Dùng chung cho tất cả các gói)
        </span>
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          1 Logo / Sản phẩm
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
        {/* Logo Preview */}
        <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-blue-500/30 bg-slate-50 dark:bg-slate-900/60 p-2 shadow-xs">
          <img
            src={displayUrl}
            alt="Logo Preview"
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/logos/bowLogo.jpeg';
            }}
          />
        </div>

        {/* Action Controls */}
        <div className="min-w-0 flex-1 space-y-2 w-full">
          <input
            value={url}
            onChange={(e) => onSelect(e.target.value)}
            placeholder="/assets/... hoặc https://..."
            className="h-10 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none text-slate-800 dark:text-slate-200"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGallery((v) => !v)}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 transition hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              {showGallery ? '📂 Đóng thư viện' : '🖼️ Chọn logo có sẵn'}
            </button>

            <label className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-700">
              {uploading ? 'Đang tải...' : '📁 Tải ảnh mới'}
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
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-bold text-rose-500 hover:underline px-2 py-1"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Gallery Grid with Search */}
      {showGallery && (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3.5 space-y-3">
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Tìm kiếm logo (ví dụ: Netflix, Canva, ChatGPT...)"
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium outline-none focus:border-blue-500"
            />
          </div>

          <div className="max-h-52 overflow-y-auto grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 pr-1">
            {filtered.map((item, idx) => {
              const isSelected = url === item.url || (!url && item.url === '/assets/logos/bowLogo.jpeg');
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    onSelect(item.url);
                    setShowGallery(false);
                  }}
                  className={`group relative flex flex-col items-center justify-center rounded-xl p-2 border transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:border-blue-400 hover:shadow-xs'
                  }`}
                  title={item.name}
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-9 w-9 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/logos/bowLogo.jpeg';
                    }}
                  />
                  <span className="mt-1 w-full truncate text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center">
                    {item.name}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs font-semibold text-slate-400">
                Không tìm thấy logo phù hợp với từ khóa "{search}"
              </div>
            )}
          </div>
        </div>
      )}
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
  const [draft, setDraft] = useState({
    name: '',
    duration: '',
    price: 0,
    price_ctv: 0,
    warranty: '',
    is_highlight: false,
    badge: '',
    features: [] as string[],
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [featureInput, setFeatureInput] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const resetDraft = () => {
    setDraft({
      name: '',
      duration: '',
      price: 0,
      price_ctv: 0,
      warranty: '',
      is_highlight: false,
      badge: '',
      features: [],
    });
    setFeatureInput('');
    setEditingPlanId(null);
  };

  const startEdit = (p: PlanRow) => {
    setEditingPlanId(p.id);
    setDraft({
      name: p.name,
      duration: p.duration ?? '',
      price: Number(p.price) || 0,
      price_ctv: Number(p.price_ctv) || 0,
      warranty: p.notes ?? '',
      is_highlight: p.is_highlight ?? false,
      badge: p.badge ?? '',
      features: p.features ? [...p.features] : [],
    });
    setFeatureInput('');
  };

  const addFeature = () => {
    const val = featureInput.trim();
    if (!val) return;
    if (draft.features.includes(val)) {
      toast.error('Tính năng này đã có trong danh sách');
      return;
    }
    setDraft((d) => ({ ...d, features: [...d.features, val] }));
    setFeatureInput('');
  };

  const removeFeature = (index: number) => {
    setDraft((d) => ({ ...d, features: d.features.filter((_, i) => i !== index) }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Vui lòng nhập tên gói giá');
      return;
    }
    if (!draft.price || Number(draft.price) <= 0) {
      toast.error('Vui lòng nhập giá cho gói');
      return;
    }

    if (editingPlanId) {
      // UPDATE MODE
      if (isNew) {
        setPlans((prev) =>
          prev.map((item) =>
            item.id === editingPlanId
              ? {
                  ...item,
                  name: draft.name.trim(),
                  duration: draft.duration.trim() || null,
                  price: Number(draft.price) || 0,
                  price_ctv: Number(draft.price_ctv) > 0 ? Number(draft.price_ctv) : null,
                  notes: draft.warranty.trim() || null,
                  is_highlight: draft.is_highlight,
                  badge: draft.badge.trim() || null,
                  features: draft.features.length > 0 ? draft.features : null,
                }
              : item
          )
        );
        resetDraft();
        toast.success('Đã cập nhật gói giá!');
        return;
      }

      setBusy(true);
      try {
        await updatePlan(editingPlanId, {
          name: draft.name.trim(),
          duration: draft.duration.trim() || null,
          price: Number(draft.price) || 0,
          price_ctv: Number(draft.price_ctv) > 0 ? Number(draft.price_ctv) : null,
          notes: draft.warranty.trim() || null,
          is_highlight: draft.is_highlight,
          badge: draft.badge.trim() || null,
          features: draft.features.length > 0 ? draft.features : null,
        });
        resetDraft();
        toast.success('Đã cập nhật gói giá thành công!');
        reload();
      } catch (err: any) {
        toast.error(err?.message || 'Không thể cập nhật gói giá');
      } finally {
        setBusy(false);
      }
    } else {
      // CREATE MODE
      if (isNew) {
        const newPlanDraft: PlanRow = {
          id: `draft-${Date.now()}-${Math.random()}`,
          product_id: 'new',
          name: draft.name.trim(),
          duration: draft.duration.trim() || null,
          price: Number(draft.price) || 0,
          price_ctv: Number(draft.price_ctv) > 0 ? Number(draft.price_ctv) : null,
          original_price: null,
          description: null,
          notes: draft.warranty.trim() || null,
          is_highlight: draft.is_highlight,
          is_active: true,
          sort_order: plans.length + 1,
          badge: draft.badge.trim() || null,
          features: draft.features.length > 0 ? draft.features : null,
        };
        setPlans((prev) => [...prev, newPlanDraft]);
        resetDraft();
        toast.success('Đã thêm gói giá vào bản nháp!');
        return;
      }

      setBusy(true);
      try {
        await createPlan({
          product_id: productId,
          name: draft.name.trim(),
          duration: draft.duration.trim() || null,
          price: Number(draft.price) || 0,
          price_ctv: Number(draft.price_ctv) > 0 ? Number(draft.price_ctv) : null,
          original_price: null,
          notes: draft.warranty.trim() || null,
          is_highlight: draft.is_highlight,
          sort_order: plans.length + 1,
          badge: draft.badge.trim() || null,
          features: draft.features.length > 0 ? draft.features : null,
        });
        resetDraft();
        toast.success('Đã thêm gói giá mới thành công!');
        reload();
      } catch (err: any) {
        toast.error(err?.message || 'Không thể thêm gói giá');
      } finally {
        setBusy(false);
      }
    }
  };

  const removePlan = async (idToRemove: string) => {
    if (editingPlanId === idToRemove) resetDraft();
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
    <AdminCard title="Gói giá & Tính năng riêng từng gói">
      {plans.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {plans.map((p) => {
            const isEditingThis = editingPlanId === p.id;
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-2 rounded-2xl border p-3.5 shadow-xs transition ${
                  isEditingThis
                    ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs">{p.name}</span>
                  {p.duration && <span className="text-xs text-slate-400 font-semibold">({p.duration})</span>}
                  <span className="text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">{Number(p.price).toLocaleString('vi-VN')}₫</span>
                  {p.price_ctv != null && Number(p.price_ctv) > 0 && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/40 px-2 py-0.5 text-[9px] font-black text-amber-700 dark:text-amber-300">
                      👑 Sỉ CTV: {Number(p.price_ctv).toLocaleString('vi-VN')}₫
                    </span>
                  )}
                  {p.notes && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                      🛡️ {p.notes}
                    </span>
                  )}
                  {p.badge && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:text-blue-300">
                      🏷 {p.badge}
                    </span>
                  )}
                  {p.is_highlight && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                      ⭐ Nổi bật
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none mr-1">
                      <input
                        type="checkbox"
                        checked={p.is_highlight}
                        onChange={() => toggleHighlight(p)}
                        className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      Nổi bật
                    </label>

                    <button
                      type="button"
                      onClick={() => (isEditingThis ? resetDraft() : startEdit(p))}
                      className={`rounded-lg border px-3 py-1 text-xs font-bold transition cursor-pointer ${
                        isEditingThis
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                      }`}
                    >
                      {isEditingThis ? '✏️ Đang sửa' : '✏️ Sửa'}
                    </button>

                    <DeleteButton onDelete={() => removePlan(p.id)} />
                  </div>
                </div>

                {/* Feature Chips for this specific plan */}
                {p.features && p.features.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                    <span className="text-slate-400 font-semibold mr-1">Tính năng gói:</span>
                    {p.features.map((feat, fIdx) => (
                      <span key={fIdx} className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 font-bold">
                        ✓ {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {editingPlanId ? '✏️ Chỉnh sửa gói giá hiện tại' : '➕ Thêm gói giá mới'}
          </h4>
          {editingPlanId && (
            <button
              type="button"
              onClick={resetDraft}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              Hủy sửa
            </button>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-5 items-start">
          <Field label="Tên gói *" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ví dụ: 1 tháng..." />
          <Field label="Thời hạn *" value={draft.duration} onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))} placeholder="Ví dụ: 30 ngày..." />
          <Field
            label="Giá lẻ (₫) *"
            type="number"
            min="0"
            value={draft.price || ''}
            onChange={(e) => setDraft((d) => ({ ...d, price: Math.max(0, Number(e.target.value) || 0) }))}
            placeholder="0"
          />
          <Field
            label="👑 Giá Sỉ (₫)"
            type="number"
            min="0"
            value={draft.price_ctv || ''}
            onChange={(e) => setDraft((d) => ({ ...d, price_ctv: Math.max(0, Number(e.target.value) || 0) }))}
            placeholder="Để trống = Giá lẻ"
          />
          <Field label="Nhãn / Badge" value={draft.badge} onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))} placeholder="Ví dụ: HOT..." />
        </div>

        {/* Bảo hành input & Quick Suggestion Pills */}
        <div className="space-y-1.5">
          <Field
            label="Chính sách bảo hành"
            value={draft.warranty}
            onChange={(e) => setDraft((d) => ({ ...d, warranty: e.target.value }))}
            placeholder="Ví dụ: Full thời gian, 24 giờ, 7 ngày, Không bảo hành..."
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Gợi ý nhanh:</span>
            {[
              'Bảo hành Full thời gian',
              'Bảo hành 24 giờ',
              'Bảo hành 7 ngày',
              'Bảo hành 30 ngày',
              'Không bảo hành',
            ].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, warranty: opt }))}
                className="rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 text-[10px] font-bold transition cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Feature List Input for this Plan */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 p-3.5 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Tính năng nổi bật riêng của gói này:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFeature();
                }
              }}
              placeholder="Ví dụ: 5 thành viên, Profile riêng, Slot riêng... (Nhấn Enter để thêm)"
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#2563EB] focus:outline-none"
            />
            <button
              type="button"
              onClick={addFeature}
              className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-4 py-2 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
            >
              + Thêm
            </button>
          </div>

          {/* List of features added to draft */}
          {draft.features.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {draft.features.map((feat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
                >
                  <span>✓ {feat}</span>
                  <button
                    type="button"
                    onClick={() => removeFeature(idx)}
                    className="ml-1 text-blue-400 hover:text-red-500 font-black cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
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

        <div className="flex items-center gap-2">
          {editingPlanId && (
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Hủy sửa
            </button>
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-sky-500 hover:to-blue-700 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-500/20 transition-all hover:scale-102 active:scale-98 disabled:opacity-60 cursor-pointer"
          >
            {busy ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang lưu...
              </>
            ) : editingPlanId ? (
              <>
                <span>💾</span>
                <span>Cập nhật gói giá</span>
              </>
            ) : (
              <>
                <span>➕</span>
                <span>Thêm gói giá mới</span>
              </>
            )}
          </button>
        </div>
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
    <AdminCard title="Tính năng chung của sản phẩm (Hiển thị dự phòng nếu gói không có tính năng riêng)">
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
