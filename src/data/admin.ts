import { supabase } from '../lib/supabase';
import type { Database, ProductType } from '../lib/database.types';

export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];
export type PlanRow = Database['public']['Tables']['product_plans']['Row'];
export type FeatureRow = Database['public']['Tables']['product_features']['Row'];
export type FaqRow = Database['public']['Tables']['faqs']['Row'];
export type ContactRow = Database['public']['Tables']['contact_settings']['Row'];

type Insert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
type Update<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// ─────────────── Dashboard stats ───────────────
export interface AdminStats {
  totalProducts: number;
  totalAiTools: number;
  totalPremiumApps: number;
  totalFeatured: number;
}

async function countWhere(filter?: (q: ReturnType<typeof baseCount>) => unknown) {
  let q = baseCount();
  if (filter) q = filter(q) as typeof q;
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
function baseCount() {
  return supabase.from('products').select('*', { count: 'exact', head: true });
}

export async function fetchStats(): Promise<AdminStats> {
  const [totalProducts, totalAiTools, totalPremiumApps, totalFeatured] = await Promise.all([
    countWhere(),
    countWhere((q) => q.eq('type', 'ai-tool')),
    countWhere((q) => q.eq('type', 'premium-app')),
    countWhere((q) => q.eq('is_featured', true)),
  ]);
  return { totalProducts, totalAiTools, totalPremiumApps, totalFeatured };
}

// ─────────────── Categories ───────────────
export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(input: Insert<'categories'>) {
  const { error } = await supabase.from('categories').insert(input);
  if (error) throw error;
}
export async function updateCategory(id: string, patch: Update<'categories'>) {
  const { error } = await supabase.from('categories').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────── Products ───────────────
const PRODUCT_COLS =
  'id, category_id, name, slug, short_description, description, logo_url, banner_url, type, accent, badge, base_price, original_price, rating, sold, is_active, is_featured, sort_order, affiliate_enabled, affiliate_type, affiliate_reward, affiliate_discount, price_ctv, created_at, updated_at';

export async function listProducts(opts?: {
  type?: ProductType;
  search?: string;
}): Promise<ProductRow[]> {
  let q = supabase.from('products').select(PRODUCT_COLS);
  if (opts?.type) q = q.eq('type', opts.type);
  if (opts?.search?.trim()) {
    const like = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${like},slug.ilike.${like},short_description.ilike.${like}`);
  }
  const { data, error } = await q.order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as ProductRow[]) ?? [];
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductRow) ?? null;
}

export async function createProduct(input: Insert<'products'>): Promise<string> {
  const { data, error } = await supabase.from('products').insert(input).select('id').single();
  if (error) throw error;
  return data.id as string;
}
export async function updateProduct(id: string, patch: Update<'products'>) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
export async function setFeatured(id: string, value: boolean) {
  const { error } = await supabase.from('products').update({ is_featured: value }).eq('id', id);
  if (error) throw error;
}
export async function setActive(id: string, value: boolean) {
  const { error } = await supabase.from('products').update({ is_active: value }).eq('id', id);
  if (error) throw error;
}

// ─────────────── Plans ───────────────
export async function listPlans(productId: string): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('product_plans')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function createPlan(input: Insert<'product_plans'>) {
  const { error } = await supabase.from('product_plans').insert(input);
  if (error) throw error;
}
export async function updatePlan(id: string, patch: Update<'product_plans'>) {
  const { error } = await supabase.from('product_plans').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deletePlan(id: string) {
  const { error } = await supabase.from('product_plans').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────── Features ───────────────
export async function listFeatures(productId: string): Promise<FeatureRow[]> {
  const { data, error } = await supabase
    .from('product_features')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function createFeature(input: Insert<'product_features'>) {
  const { error } = await supabase.from('product_features').insert(input);
  if (error) throw error;
}
export async function deleteFeature(id: string) {
  const { error } = await supabase.from('product_features').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────── FAQs ───────────────
export async function listFaqs(productId?: string | null): Promise<FaqRow[]> {
  let q = supabase.from('faqs').select('*');
  q = productId ? q.eq('product_id', productId) : q.is('product_id', null);
  const { data, error } = await q.order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function createFaq(input: Insert<'faqs'>) {
  const { error } = await supabase.from('faqs').insert(input);
  if (error) throw error;
}
export async function updateFaq(id: string, patch: Update<'faqs'>) {
  const { error } = await supabase.from('faqs').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteFaq(id: string) {
  const { error } = await supabase.from('faqs').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────── Contact settings ───────────────
export async function getContactSettings(): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from('contact_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
export async function saveContactSettings(patch: Update<'contact_settings'>) {
  const existing = await getContactSettings();
  if (existing) {
    const { error } = await supabase.from('contact_settings').update(patch).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('contact_settings').insert(patch);
    if (error) throw error;
  }
}

// ─────────────── Storage upload ───────────────
const BUCKET = 'assets';

/** Upload a file to the `assets` bucket; returns public URL. */
export async function uploadImage(file: File, folder = 'products'): Promise<string> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const base64Data = await base64Promise;
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || 'image/png',
        base64Data,
        folder,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.publicUrl) return json.publicUrl;
    }
  } catch (apiErr) {
    console.warn('[uploadImage] /api/upload unavailable, falling back to client storage:', apiErr);
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
