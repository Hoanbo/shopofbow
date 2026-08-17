import { useState, useEffect, useCallback } from 'react';

export interface PromptVariable {
  raw: string;         // e.g. "[Tên sản phẩm]" or "[Tỉ lệ: --ar 16:9]"
  name: string;        // e.g. "Tên sản phẩm"
  defaultHint?: string; // e.g. "--ar 16:9"
  options?: string[];  // Preset quick chips
}

// Preset library mapped by keyword
const PRESET_OPTIONS: Record<string, string[]> = {
  tone: ['Chuyên nghiệp', 'Hài hước & Bắt trend', 'Thuyết phục bán hàng', 'Học thuật chuyên sâu', 'Ngắn gọn súc tích'],
  style: ['Photorealistic 8K', 'Cinematic Lighting', 'Cyberpunk Neon', 'Anime Ghibli Style', '3D Pixar Animation', 'Minimalist Modern', 'Vintage Film 90s'],
  ratio: ['--ar 16:9', '--ar 9:16', '--ar 1:1', '--ar 4:5', '--ar 21:9'],
  tech: ['TypeScript / React', 'Python / FastAPI', 'Next.js App Router', 'Node.js Express', 'Tailwind CSS', 'PostgreSQL / SQL', 'Docker'],
  audience: ['Gen Z & Giới trẻ', 'Dân văn phòng / Công sở', 'Chủ shop / Doanh nghiệp', 'Học sinh & Sinh viên', 'Lập trình viên'],
  platform: ['TikTok / Reels Script', 'Bài viết Facebook', 'Bài chuẩn SEO Blog', 'Email Marketing', 'LinkedIn Post', 'Kịch bản YouTube'],
  lighting: ['Golden Hour', 'Studio Softbox', 'Dramatic Cyberpunk', 'Natural Daylight', 'Volumetric Rays'],
};

/**
 * Trích xuất danh sách biến số từ nội dung Prompt (dạng [Tên biến])
 */
export function extractPromptVariables(content: string, category = ''): PromptVariable[] {
  if (!content) return [];

  // Match [Tên biến] nhưng bỏ qua các cú pháp kỹ thuật đặc thù
  const matches = content.match(/\[([^[\]\n]{2,50})\]/g);
  if (!matches) return [];

  const uniqueMatches = Array.from(new Set(matches));
  const cat = category.toLowerCase();

  return uniqueMatches.map((raw) => {
    // raw = "[Tên sản phẩm]" -> inner = "Tên sản phẩm"
    const inner = raw.slice(1, -1).trim();
    let name = inner;
    let defaultHint: string | undefined;

    if (inner.includes(':')) {
      const parts = inner.split(':');
      name = parts[0].trim();
      defaultHint = parts.slice(1).join(':').trim();
    }

    const lower = name.toLowerCase();
    let options: string[] | undefined;

    if (lower.includes('tông') || lower.includes('giọng') || lower.includes('tone')) {
      options = PRESET_OPTIONS.tone;
    } else if (lower.includes('phong cách') || lower.includes('style') || lower.includes('nghệ thuật')) {
      options = PRESET_OPTIONS.style;
    } else if (lower.includes('tỉ lệ') || lower.includes('khung hình') || lower.includes('ratio') || lower.includes('ar')) {
      options = PRESET_OPTIONS.ratio;
    } else if (lower.includes('ngôn ngữ') || lower.includes('công nghệ') || lower.includes('tech') || lower.includes('code') || cat === 'claude') {
      options = PRESET_OPTIONS.tech;
    } else if (lower.includes('đối tượng') || lower.includes('khách hàng') || lower.includes('audience')) {
      options = PRESET_OPTIONS.audience;
    } else if (lower.includes('nền tảng') || lower.includes('kênh') || lower.includes('platform')) {
      options = PRESET_OPTIONS.platform;
    } else if (lower.includes('ánh sáng') || lower.includes('lighting')) {
      options = PRESET_OPTIONS.lighting;
    } else if (cat === 'midjourney' || cat === 'flux') {
      if (lower.includes('ảnh') || lower.includes('chi tiết')) {
        options = PRESET_OPTIONS.style;
      }
    }

    return {
      raw,
      name,
      defaultHint,
      options,
    };
  });
}

/**
 * Tạo nội dung Prompt hoàn chỉnh từ nội dung gốc và bảng giá trị biến
 */
export function buildCustomizedPrompt(content: string, values: Record<string, string>): string {
  if (!content) return '';
  let result = content;

  Object.entries(values).forEach(([rawKey, val]) => {
    if (val && val.trim()) {
      // Thay thế tất cả lần xuất hiện của rawKey
      result = result.split(rawKey).join(val.trim());
    }
  });

  return result;
}

const FAVORITES_STORAGE_KEY = 'bow_prompt_favorites';

/**
 * Hook quản lý danh sách Prompt yêu thích (Bookmark)
 */
export function usePromptFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set<string>();
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch {}
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return {
    favorites,
    favoritesCount: favorites.size,
    toggleFavorite,
    isFavorite,
  };
}
