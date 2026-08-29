import { supabase } from '../../lib/supabase';
import type { CategoryInfo, CategoryResolution } from './types';

export type { CategoryInfo, CategoryResolution };

// Bộ Alias chuẩn hóa cho các danh mục canonical từ database
const CATEGORY_ALIASES: Record<string, string[]> = {
  'ai-tools': [
    'ai tools',
    'ai tool',
    'công cụ ai',
    'cong cu ai',
    'trí tuệ nhân tạo',
    'tri tue nhan tao',
    'nhóm ai',
    'nhom ai',
    'ai',
    'chatgpt',
    'claude',
  ],
  'premium-apps': [
    'premium apps',
    'premium app',
    'ứng dụng premium',
    'ung dung premium',
    'ứng dụng bản quyền',
    'ung dung ban quyen',
    'phần mềm bản quyền',
    'phan mem ban quyen',
    'ứng dụng',
    'ung dung',
    'apps',
    'app',
  ],
  'products': [
    'featured products',
    'featured',
    'sản phẩm nổi bật',
    'san pham noi bat',
    'nổi bật',
    'noi bat',
    'bán chạy',
    'ban chay',
    'hot',
  ],
};

let cachedCategories: CategoryInfo[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 phút cache

/**
 * Lấy danh sách danh mục từ Database
 */
export async function getAllCategories(): Promise<CategoryInfo[]> {
  const now = Date.now();
  if (cachedCategories && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedCategories;
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    cachedCategories = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      sortOrder: c.sort_order,
    }));
    lastFetchTime = now;
    return cachedCategories;
  } catch (err) {
    console.error('[Category Resolver] Error fetching categories:', err);
    return cachedCategories || [];
  }
}

/**
 * Chuẩn hóa chuỗi tìm kiếm
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân giải intent Category từ câu hỏi của người dùng
 */
export async function resolveCategoryQuery(rawQuery: string): Promise<CategoryResolution> {
  const categories = await getAllCategories();
  const normalized = normalizeText(rawQuery);

  if (!normalized) {
    return { matched: false };
  }

  // 1. Exact match theo Name hoặc Slug của Category
  for (const cat of categories) {
    const catNameNorm = normalizeText(cat.name);
    const catSlugNorm = normalizeText(cat.slug);

    if (normalized === catNameNorm || normalized === catSlugNorm) {
      return { matched: true, category: cat };
    }
  }

  // 2. Match theo Alias cấu hình
  for (const cat of categories) {
    const aliases = CATEGORY_ALIASES[cat.slug] || [];
    for (const alias of aliases) {
      const aliasNorm = normalizeText(alias);
      if (normalized === aliasNorm || normalized === `nhom ${aliasNorm}` || normalized === `danh muc ${aliasNorm}`) {
        return { matched: true, category: cat };
      }
    }
  }

  // 3. Match khi câu hỏi chứa từ khóa danh mục đặc thù (VD: "xem nhóm AI", "danh mục premium apps")
  for (const cat of categories) {
    const aliases = CATEGORY_ALIASES[cat.slug] || [];
    for (const alias of aliases) {
      const aliasNorm = normalizeText(alias);
      // Chỉ match nếu alias đủ dài (>= 3 ký tự) và xuất hiện nguyên từ
      if (aliasNorm.length >= 3) {
        const regex = new RegExp(`\\b${aliasNorm}\\b`, 'i');
        if (regex.test(normalized)) {
          return { matched: true, category: cat };
        }
      }
    }
  }

  return { matched: false };
}
