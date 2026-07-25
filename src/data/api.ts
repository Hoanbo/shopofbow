import { supabase } from '../lib/supabase';
import type { CatalogItem, PlanTier } from './types';
import type { Database, ProductType } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type PlanRow = Database['public']['Tables']['product_plans']['Row'];
type FeatureRow = Database['public']['Tables']['product_features']['Row'];
type FaqRow = Database['public']['Tables']['faqs']['Row'];
type ContactRow = Database['public']['Tables']['contact_settings']['Row'];

export interface ContactSettings {
  facebookUrl: string;
  zaloUrl: string;
  supportPhone: string;
  supportEmail: string;
}

export interface Faq {
  question: string;
  answer: string;
}

const GROUP_LABEL: Record<ProductType, string> = {
  'ai-tool': 'AI Tools',
  'premium-app': 'Premium Apps',
  product: 'Featured Products',
};

const PRODUCT_COLS =
  'id, category_id, name, slug, short_description, description, logo_url, banner_url, type, accent, badge, base_price, original_price, rating, sold, is_active, is_featured, sort_order, created_at, updated_at';

function mapPlan(p: PlanRow): PlanTier {
  return {
    label: p.name,
    duration: p.duration ?? '',
    price: Number(p.price ?? 0),
    originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
    highlight: p.is_highlight || undefined,
  };
}

function mapProduct(
  row: ProductRow,
  plans: PlanRow[] = [],
  features: FeatureRow[] = [],
): CatalogItem {
  const short = row.short_description ?? '';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: short,
    description: short,
    longDescription: row.description ?? short,
    category: row.type,
    group: GROUP_LABEL[row.type],
    image: row.logo_url ?? '',
    accent: row.accent ?? '#06b6d4',
    price: Number(row.base_price ?? 0),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    rating: row.rating != null ? Number(row.rating) : 5,
    sold: row.sold ?? 0,
    featured: row.is_featured || undefined,
    badge: row.badge ?? undefined,
    features: [...features].sort((a, b) => a.sort_order - b.sort_order).map((f) => f.feature),
    plans: [...plans].sort((a, b) => a.sort_order - b.sort_order).map(mapPlan),
  };
}

/** List products of a category type (cards don't need plans/features). */
export async function fetchByCategory(type: ProductType): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('type', type)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

/** Featured products across all categories (is_featured = true). */
export async function fetchFeatured(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

/** Single product with plans + features, by slug. */
export async function fetchBySlug(slug: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLS}, product_plans(*), product_features(*)`)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProductRow & {
    product_plans: PlanRow[] | null;
    product_features: FeatureRow[] | null;
  };
  return mapProduct(
    row,
    (row.product_plans ?? []).filter((p) => p.is_active),
    row.product_features ?? [],
  );
}

/** Search by name / description / category, active products only. */
export async function searchProducts(q: string): Promise<CatalogItem[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('is_active', true)
    .or(`name.ilike.${like},short_description.ilike.${like},description.ilike.${like}`)
    .order('sort_order', { ascending: true })
    .limit(24);
  if (error) throw error;
  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

/** FAQs for a product, or global FAQs (product_id is null) when no id given. */
export async function fetchFaqs(productId?: string): Promise<Faq[]> {
  let query = supabase.from('faqs').select('question, answer, sort_order, product_id');
  query = productId ? query.eq('product_id', productId) : query.is('product_id', null);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as FaqRow[] | null ?? []).map((f) => ({ question: f.question, answer: f.answer }));
}

const CONTACT_FALLBACK: ContactSettings = {
  facebookUrl: '#',
  zaloUrl: '#',
  supportPhone: '',
  supportEmail: '',
};

/** Contact settings (single row). Falls back to safe defaults. */
export async function fetchContactSettings(): Promise<ContactSettings> {
  const { data, error } = await supabase
    .from('contact_settings')
    .select('facebook_url, zalo_url, support_phone, support_email')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as ContactRow | null;
  if (!row) return CONTACT_FALLBACK;
  return {
    facebookUrl: row.facebook_url ?? '#',
    zaloUrl: row.zalo_url ?? '#',
    supportPhone: row.support_phone ?? '',
    supportEmail: row.support_email ?? '',
  };
}
