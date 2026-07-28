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

const MOCK_ITEMS: CatalogItem[] = [
  // AI Tools
  {
    id: 'ai-1',
    slug: 'chatgpt-plus',
    name: 'ChatGPT',
    tagline: 'Trải nghiệm AI mạnh mẽ và ổn định hơn',
    description: 'Tài khoản ChatGPT Plus chính chủ',
    longDescription: 'Tài khoản ChatGPT Plus chính chủ với GPT-4o không giới hạn.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/chatgpt.png',
    accent: '#10a37f',
    price: 149000,
    originalPrice: 500000,
    rating: 4.9,
    sold: 3200,
    featured: true,
    badge: 'Bán chạy',
    features: ['GPT-4o không giới hạn', 'Tạo ảnh DALL·E 3'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 149000 }],
  },
  {
    id: 'ai-2',
    slug: 'claude-pro',
    name: 'Claude',
    tagline: 'Hiệu suất vượt trội, hỗ trợ thông minh hơn',
    description: 'Claude Pro chính chủ',
    longDescription: 'Claude Pro của Anthropic mạnh về lập trình & phân tích tài liệu.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/claude.jpg',
    accent: '#d97757',
    price: 159000,
    originalPrice: 520000,
    rating: 4.9,
    sold: 1800,
    featured: true,
    badge: 'Cho lập trình',
    features: ['Context window 200k', 'Viết code cực mạnh'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 159000 }],
  },
  {
    id: 'ai-3',
    slug: 'gemini-advanced',
    name: 'Gemini',
    tagline: 'Mô hình AI đa thức tối tân từ Google',
    description: 'Gemini Advanced 2TB Google One',
    longDescription: 'Tài khoản Gemini Advanced tích hợp Google One 2TB.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/gemini.jpg',
    accent: '#1a73e8',
    price: 139000,
    originalPrice: 480000,
    rating: 4.8,
    sold: 1450,
    featured: false,
    features: ['Đa thức tối tân', 'Tích hợp Google One 2TB'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 139000 }],
  },
  {
    id: 'ai-4',
    slug: 'cursor-pro',
    name: 'Cursor',
    tagline: 'Trình soạn thảo code tích hợp AI hàng đầu',
    description: 'Cursor Pro IDE',
    longDescription: 'Cursor Pro IDE hỗ trợ sinh code và refactor cực nhanh.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/cursor.jpg',
    accent: '#000000',
    price: 179000,
    originalPrice: 550000,
    rating: 5.0,
    sold: 980,
    featured: false,
    features: ['Tích hợp AI Autocomplete', 'Chat với codebase'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 179000 }],
  },
  {
    id: 'ai-5',
    slug: 'grok-ai',
    name: 'Grok',
    tagline: 'AI thông minh kết nối dữ liệu thời gian thực',
    description: 'Grok AI Premium',
    longDescription: 'Grok AI từ xAI hỗ trợ tìm kiếm thời gian thực.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/grok.png',
    accent: '#000000',
    price: 169000,
    originalPrice: 500000,
    rating: 4.7,
    sold: 620,
    featured: false,
    features: ['Dữ liệu thời gian thực', 'Phản hồi hài hước & thông minh'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 169000 }],
  },
  {
    id: 'ai-6',
    slug: 'perplexity-pro',
    name: 'Perplexity',
    tagline: 'Công cụ tìm kiếm AI chuyên sâu & chính xác',
    description: 'Perplexity Pro',
    longDescription: 'Perplexity Pro tra cứu thông tin kèm trích dẫn nguồn rõ ràng.',
    category: 'ai-tool',
    group: 'AI Tools',
    image: '/assets/perplexity.jpg',
    accent: '#20b2aa',
    price: 159000,
    originalPrice: 490000,
    rating: 4.8,
    sold: 1100,
    featured: false,
    features: ['Tra cứu kèm trích dẫn', 'Chọn mô hình AI linh hoạt'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 159000 }],
  },

  // Premium Apps
  {
    id: 'app-1',
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    tagline: 'Xem video không quảng cáo và nghe nhạc thoải mái',
    description: 'Tài khoản YouTube Premium nâng cấp chính chủ',
    longDescription: 'Tài khoản YouTube Premium không quảng cáo, nghe nhạc background và YouTube Music.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/youtube.jpg',
    accent: '#ff0000',
    price: 39000,
    originalPrice: 79000,
    rating: 4.9,
    sold: 5400,
    featured: true,
    badge: 'Siêu rẻ',
    features: ['Không quảng cáo', 'Phát nhạc nền', 'Tải video ngoại tuyến'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 39000 }],
  },
  {
    id: 'app-2',
    slug: 'netflix-premium',
    name: 'Netflix',
    tagline: 'Xem phim 4K Ultra HD không giới hạn',
    description: 'Tài khoản Netflix Premium Ultra HD 4K',
    longDescription: 'Thưởng thức phim chiếu rạp, series độc quyền trên Netflix độ phân giải 4K.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/netflix.png',
    accent: '#e50914',
    price: 79000,
    originalPrice: 260000,
    rating: 4.9,
    sold: 4200,
    featured: true,
    features: ['Phim Ultra HD 4K', 'Xem trên nhiều thiết bị'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 79000 }],
  },
  {
    id: 'app-3',
    slug: 'capcut-pro',
    name: 'CapCut Pro',
    tagline: 'Công cụ chỉnh sửa video chuyên nghiệp',
    description: 'Tài khoản CapCut Pro',
    longDescription: 'Mở khóa toàn bộ hiệu ứng, mẫu template và tính năng AI của CapCut Pro.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/capcut.png',
    accent: '#000000',
    price: 59000,
    originalPrice: 199000,
    rating: 4.9,
    sold: 2300,
    featured: true,
    features: ['Mở khóa hiệu ứng VIP', 'Xóa nền AI'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 59000 }],
  },
  {
    id: 'app-4',
    slug: 'locket-gold',
    name: 'Locket Gold',
    tagline: 'Chia sẻ khoảnh khắc đẹp cùng bạn bè',
    description: 'Tài khoản Locket Gold',
    longDescription: 'Nâng cấp Locket Gold tính năng chia sẻ khoảnh khắc hình ảnh đỉnh cao.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/locket.png',
    accent: '#ffb703',
    price: 49000,
    originalPrice: 149000,
    rating: 4.8,
    sold: 1650,
    featured: false,
    features: ['Tính năng VIP', 'Icon ứng dụng độc quyền'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 49000 }],
  },
  {
    id: 'app-5',
    slug: 'canva-pro',
    name: 'Canva Pro',
    tagline: 'Thiết kế đồ họa không giới hạn cho mọi nhu cầu',
    description: 'Tài khoản Canva Pro Edu / Team',
    longDescription: 'Truy cập hàng triệu mẫu thiết kế, hình ảnh, font chữ và công cụ tách nền tự động.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/canva.jpg',
    accent: '#00c4cc',
    price: 49000,
    originalPrice: 150000,
    rating: 4.9,
    sold: 3800,
    featured: false,
    features: ['Tách nền 1 click', 'Hàng triệu stock ảnh VIP'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 49000 }],
  },
  {
    id: 'app-6',
    slug: 'spotify-premium',
    name: 'Spotify',
    tagline: 'Nghe nhạc chất lượng cao không quảng cáo',
    description: 'Tài khoản Spotify Premium',
    longDescription: 'Thưởng thức hàng triệu bài hát không quảng cáo, chuyển bài không giới hạn.',
    category: 'premium-app',
    group: 'Premium Apps',
    image: '/assets/spotify.jpg',
    accent: '#1ed760',
    price: 45000,
    originalPrice: 99000,
    rating: 4.9,
    sold: 2900,
    featured: false,
    features: ['Chất lượng nhạc 320kbps', 'Tải nhạc offline'],
    plans: [{ label: '1 tháng', duration: '30 ngày', price: 45000 }],
  },
];

/** List products of a category type (cards don't need plans/features). */
export async function fetchByCategory(type: ProductType): Promise<CatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLS)
      .eq('type', type)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.map((row) => mapProduct(row as ProductRow));
    }
  } catch (e) {
    console.warn('Supabase fetch failed, falling back to mock catalog:', e);
  }
  return MOCK_ITEMS.filter((item) => item.category === type);
}

/** Featured products across all categories (is_featured = true). */
export async function fetchFeatured(): Promise<CatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLS)
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.map((row) => mapProduct(row as ProductRow));
    }
  } catch (e) {
    console.warn('Supabase fetch failed, falling back to mock catalog:', e);
  }
  return MOCK_ITEMS.filter((item) => item.featured);
}

/** Single product with plans + features, by slug. */
export async function fetchBySlug(slug: string): Promise<CatalogItem | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_COLS}, product_plans(*), product_features(*)`)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (!error && data) {
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
  } catch (e) {
    console.warn('Supabase fetch failed, falling back to mock catalog:', e);
  }
  return MOCK_ITEMS.find((item) => item.slug === slug) ?? null;
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
