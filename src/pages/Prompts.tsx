import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/admin/Pagination';
import PromptDetailModal from '../components/user/PromptDetailModal';
import { usePromptFavorites, extractPromptVariables } from '../utils/promptUtils';

export interface PromptItem {
  id: string;
  title: string;
  category: string;
  prompt_content: string;
  image_url?: string | null;
  description?: string | null;
  tags?: string[] | null;
  copy_count: number;
  is_featured: boolean;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả Tool', icon: '🌐' },
  { id: 'chatgpt', label: 'ChatGPT', icon: '🤖' },
  { id: 'claude', label: 'Claude', icon: '⚡' },
  { id: 'midjourney', label: 'Midjourney', icon: '🎨' },
  { id: 'capcut', label: 'CapCut', icon: '🎬' },
  { id: 'flux', label: 'Flux & SD', icon: '🔮' },
  { id: 'canva', label: 'Canva', icon: '🖌️' },
  { id: 'favorites', label: 'Đã lưu', icon: '❤️' },
];

const USE_CASES = [
  { id: 'all', label: 'Tất cả mục đích', icon: '✨' },
  { id: 'coding', label: 'Lập trình & Tech', icon: '💻', keywords: ['code', 'coding', 'typescript', 'python', 'architecture', 'security', 'refactor', 'unit-test', 'debug', 'database', 'sql'] },
  { id: 'marketing', label: 'Marketing & Content', icon: '📝', keywords: ['marketing', 'content', 'copywriting', 'seo', 'viral', 'facebook', 'tiktok', 'email', 'hook'] },
  { id: 'design', label: 'Đồ họa & Dựng ảnh', icon: '🎨', keywords: ['midjourney', 'flux', 'canva', 'design', 'image', '8k', 'art', 'vector', 'logo', 'photorealistic', 'portrait'] },
  { id: 'video', label: 'Dựng Video & TikTok', icon: '🎬', keywords: ['capcut', 'video', 'tiktok', 'reels', 'youtube', 'script', 'kịch bản', 'video-script'] },
  { id: 'business', label: 'Kinh doanh & Tài chính', icon: '💼', keywords: ['business', 'kinh doanh', 'startup', 'finance', 'excel', 'kế hoạch', 'sales', 'chiến lược'] },
  { id: 'learning', label: 'Học tập & Ngoại ngữ', icon: '🎓', keywords: ['learning', 'học tập', 'english', 'ielts', 'dịch thuật', 'nghiên cứu', 'tóm tắt', 'academic'] },
];

const SORT_OPTIONS = [
  { id: 'popular', label: 'Phổ biến nhất (Lượt copy)', icon: '⚡' },
  { id: 'featured', label: 'Nổi bật nhất', icon: '⭐' },
  { id: 'newest', label: 'Mới nhất', icon: '🕒' },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  chatgpt: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
  },
  midjourney: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200/60 dark:border-purple-900/40',
  },
  claude: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
  },
  capcut: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-[#00A3FF] dark:text-[#35A8FF]',
    border: 'border-sky-200/60 dark:border-sky-900/40',
  },
  flux: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
  },
  canva: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200/60 dark:border-cyan-900/40',
  },
  other: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

export const isValidPromptImageUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Chặn hoàn toàn Unsplash vì thường xuyên lỗi hoặc bị chặn trên production
  if (trimmed.includes('unsplash.com')) return false;
  return true;
};

const FALLBACK_PROMPTS: PromptItem[] = [
  {
    id: 'f1',
    title: 'Chuyên Gia Audit & Tối Ưu Hóa Code Toàn Diện (Senior Tech Lead)',
    category: 'claude',
    prompt_content: `Bạn là một Principal Software Engineer và Security Auditor với 15+ năm kinh nghiệm trong các hệ thống phân tán quy mô lớn (High-Concurrency Distributed Systems). 

Hãy phân tích, rà soát và refactor đoạn code sau theo quy trình 5 bước nghiêm ngặt:

1. 🔍 Phân tích Kiến trúc & Code Smell:
- Đánh giá tính tuân thủ SOLID principles, Clean Architecture và DRY/KISS.
- Chỉ ra các vấn đề về phân tầng (Layering), coupling cao hoặc vi phạm Separation of Concerns.

2. 🛡️ Rà soát Lỗ hổng Bảo mật (OWASP Top 10):
- Kiểm tra SQL Injection, XSS, CSRF, Race Conditions, Memory Leaks, Insecure Deserialization hoặc rò rỉ biến môi trường.

3. ⚡ Tối ưu Hiệu năng & Bộ nhớ:
- Phân tích độ phức tạp thời gian (Time Complexity - Big O) và không gian (Space Complexity).
- Tối ưu hóa truy vấn Database (tránh N+1 query), cơ chế Caching (Redis/In-memory) và xử lý bất đồng bộ (Async/Await, Promise.all).

4. 🛠️ Mã nguồn Refactor Hoàn chỉnh:
- Viết lại toàn bộ code bằng [NGÔN NGỮ LẬP TRÌNH: TypeScript] chuẩn mực (Strict Type, không dùng "any", đầy đủ Interface, Generics, Error Handling bằng Result Pattern hoặc Custom Error Class).

5. 🧪 Bộ Unit Test Chuẩn:
- Viết kèm test case bao quát Happy Path, Edge Cases (dữ liệu null/undefined/boundary) và Failure Handling.

Đoạn code cần xử lý:
\`\`\`
[DÁN MÃ NGUỒN CỦA BẠN VÀO ĐÂY]
\`\`\``,
    image_url: null,
    description: 'Mega-Prompt 5 bước biến Claude 3.5 Sonnet / Cursor Pro thành Senior Tech Lead rà soát kiến trúc, bảo mật và refactor code chuẩn enterprise.',
    tags: ['claude', 'coding', 'typescript', 'architecture', 'security', 'refactor', 'unit-test'],
    copy_count: 428,
    is_featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f2',
    title: 'Chiến Lược Content & Kịch Bản Video Ngắn Triệu View (Viral Hook Matrix)',
    category: 'chatgpt',
    prompt_content: `Đóng vai một Viral Growth Hacker và Creative Director từng xây dựng các kênh TikTok/Reels đạt hàng triệu người theo dõi trong ngành [NGÀNH HÀNG CỦA BẠN].

Nhiệm vụ: Xây dựng kịch bản video ngắn (dưới 60 giây) bán sản phẩm/dịch vụ [TÊN SẢN PHẨM] nhắm tới đối tượng [CHÂN DUNG KHÁCH HÀNG] với tông giọng [TÔNG GIỌNG: Hài hước & Bắt trend].

Cấu trúc kịch bản phải tuân theo công thức "Hook - Retain - Reward - Convert":

1. 🪝 3 Lựa Chọn Mở Đầu Giật Gân (3s First Hooks):
- Hook 1 (Phá vỡ định kiến/Tâm lý ngược): Một câu khẳng định ngược đời khiến người xem phải dừng lại.
- Hook 2 (Chạm đúng nỗi đau cấp bách): Đánh thẳng vào vấn đề đau đớn nhất mà họ gặp mỗi ngày.
- Hook 3 (Con số gây sốc / Bí mật ít ai biết): "90% người dùng [TÊN SẢN PHẨM] đang lãng phí tiền vì không biết điều này..."

2. 📈 Giữ Chân Người Xem (15s Pacing - Nỗi Đau & Đồng Cảm):
- Mô tả kịch bản hình ảnh (Visual Action) + Hiệu ứng âm thanh (SFX) để người xem không thể lướt qua.
- Dẫn dắt cảm xúc: Từ hoang mang, bực bội sang tò mò giải pháp.

3. 💡 Bật Mí Giải Pháp (25s Solution Demo):
- Trình bày 3 lợi ích cốt lõi độc nhất (USP) của [TÊN SẢN PHẨM] một cách thực tế.
- Hiển thị bằng chứng trực quan (Before vs After).

4. 🎯 Kêu Gọi Hành Động Không Thể Chối Từ (7s Irresistible CTA):
- Tạo tính khan hiếm (Urgency/FOMO) + Ưu đãi đặc quyền nếu hành động ngay hôm nay.

5. 🎬 Gợi ý Chi tiết Biên tập (Editor Notes):
- B-Roll gợi ý, Font chữ phụ đề, Màu chữ nổi bật và Nhạc nền (Trending Sound BGM).`,
    image_url: null,
    description: 'Khung kịch bản video ngắn chuẩn tâm lý học hành vi giữ chân người xem và chuyển đổi đơn hàng thần tốc với ChatGPT Plus.',
    tags: ['chatgpt', 'tiktok', 'viral', 'marketing', 'copywriting', 'video-script'],
    copy_count: 612,
    is_featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f3',
    title: 'Chân Dung Nhiếp Ảnh 8K Siêu Thực Studio Hyper-Realistic',
    category: 'midjourney',
    prompt_content: `cinematic hyper-realistic studio portrait of [CHỦ THỂ: a stylish young Asian entrepreneur], wearing [TRANG PHỤC: modern minimalist black blazer], dramatic [ÁNH SÁNG: golden hour volumetric lighting], professional 85mm f/1.4 lens photography, ultra detailed skin texture, subtle depth of field, sharp focus on eyes, 8k resolution, photorealistic, Hasselblad medium format --ar [TỈ LỆ: 16:9] --v 6.0 --stylize 250 --quality 2`,
    image_url: null,
    description: 'Prompt tạo ảnh chân dung nghệ thuật thương mại sắc nét từng lỗ chân lông chuẩn nhiếp ảnh Hasselblad trên Midjourney v6.',
    tags: ['midjourney', 'portrait', '8k', 'photorealistic', 'lighting', 'photography'],
    copy_count: 539,
    is_featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f4',
    title: 'Dựng Kịch Bản Phân Cảnh Video CapCut Tự Động (Auto Scene Scripting)',
    category: 'capcut',
    prompt_content: `Hãy đóng vai một chuyên gia Video Editor và Motion Graphic Director sử dụng CapCut Pro. 

Dựa trên chủ đề video: [CHỦ ĐỀ VIDEO] với độ dài dự kiến [ĐỘ DÀI: 45 giây], hãy tạo bảng phân cảnh chi tiết từng giây (Scene by Scene Breakdown) theo mẫu:

| Giây (Time) | Khung hình & Cảnh quay (Visual & Angle) | Lời thoại / Voiceover (Script) | Hiệu ứng CapCut (Animation/Transition) | Text Overlay & Âm thanh (SFX) |
|---|---|---|---|---|
| 00:00 - 00:03 | Cận cảnh (Extreme Close-up) biểu cảm bất ngờ | [Lời mở đầu giật gân] | Flash White + Shake (Hiệu ứng rung giật) | Text đỏ đậm + Âm thanh "Whoosh" |

Yêu cầu thêm:
1. Gợi ý bộ lọc màu (Filter & Color Grading) phù hợp nhất trong thư viện CapCut.
2. Gợi ý 3 phong cách chuyển cảnh (Transitions) mượt mà nhất.
3. Gợi ý loại nhạc nền (BGM: Lofi, Phonk, Cinematic, Upbeat) theo từng nhịp điệu phân cảnh.`,
    image_url: null,
    description: 'Bảng kịch bản phân cảnh từng giây tối ưu cho việc cắt ghép, chèn hiệu ứng và chuyển cảnh mượt mà trên CapCut Pro.',
    tags: ['capcut', 'video', 'editing', 'storyboard', 'timeline', 'animation'],
    copy_count: 310,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f5',
    title: 'Flux.1 — Logo & Mascot Thương Hiệu 3D Đẳng Cấp (Vector Flat Art)',
    category: 'flux',
    prompt_content: `modern minimalist cute 3D mascot logo of [CON VẬT HOẶC BIỂU TƯỢNG: a friendly cybernetic robot cat], vibrant gradient colors [TÔNG MÀU: electric blue and neon violet], soft rounded shapes, high-end tech branding, clean white background, vector asset, isometric 3d render, octane render style, trending on dribbble, smooth textures --ar [TỈ LỆ: 1:1]`,
    image_url: null,
    description: 'Prompt tạo linh vật mascot và logo 3D isometric phong cách Dribbble cho startup công nghệ trên Flux.1 & Leonardo AI.',
    tags: ['flux', 'logo', 'mascot', '3d', 'vector', 'branding'],
    copy_count: 245,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f6',
    title: 'Bộ Khung Thiết Kế Banner Quảng Cáo & Carousel Chốt Đơn (Canva Pro)',
    category: 'canva',
    prompt_content: `Bạn là một Creative Designer chuyên tạo các bộ Banner Carousel quảng cáo chạy ads Facebook & Instagram có CTR (Click-Through Rate) trên 5%.

Hãy lập kế hoạch thiết kế bộ ảnh 5 slide Carousel quảng bá cho sản phẩm [TÊN SẢN PHẨM] với phong cách [PHONG CÁCH: Hiện đại tối giản]:

Slide 1 (Ảnh bìa hút mắt):
- Tiêu đề chính (Main Headline - Tối đa 6 từ): [Nội dung tiêu đề]
- Hình ảnh trung tâm (Hero Visual): Gợi ý bố cục và vị trí đặt sản phẩm.
- Màu sắc chủ đạo: 3 mã màu HEX tương phản cao.

Slide 2 (Vấn đề & Nỗi đau):
- 2 gạch đầu dòng ngắn gọn về khó khăn khách hàng đang gặp.
- Icon / Minh họa đi kèm.

Slide 3 (Giải pháp vượt trội):
- 3 tính năng nổi bật giải quyết triệt để vấn đề ở Slide 2.

Slide 4 (Đánh giá thực tế / Social Proof):
- Cách trình bày Feedback khách hàng, đánh giá 5 sao ⭐⭐⭐⭐⭐.

Slide 5 (Call to Action chốt đơn):
- Khung ưu đãi giảm giá, quà tặng giới hạn, nút CTA nổi bật.

Gợi ý Font chữ trong Canva:
- Font Tiêu đề (Heading): Serif/Sans-serif mạnh mẽ.
- Font Nội dung (Body): Dễ đọc trên điện thoại.`,
    image_url: null,
    description: 'Bố cục chuẩn 5 slide Carousel quảng cáo tối ưu chuyển đổi CTR cao dễ dàng áp dụng trực tiếp vào Canva Pro.',
    tags: ['canva', 'banner', 'carousel', 'ads', 'design', 'social-media'],
    copy_count: 298,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
];

// Custom Elegant Dropdown matching BOW Dark/Light Theme
function CustomFilterDropdown({
  value,
  onChange,
  options,
  prefix = '',
}: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; icon?: string }[];
  prefix?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value) || options[0];

  return (
    <div ref={ref} className={`relative ${isOpen ? 'z-50' : 'z-20'} w-full sm:w-auto`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full sm:w-auto items-center justify-between gap-2 rounded-2xl border bg-white dark:bg-[#131C32] px-3.5 py-2.5 text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap ${
          isOpen
            ? 'border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
            : 'border-slate-200/90 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {prefix && <span className="text-[11px] font-bold text-slate-400 shrink-0">{prefix}:</span>}
          {selectedOption.icon && <span className="text-sm shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-1.5 w-full sm:w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-[#18243E]/95 p-1.5 shadow-2xl backdrop-blur-md animate-scale-up space-y-0.5 max-h-72 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#35A8FF]'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="text-sm shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <span className="text-blue-500 font-black text-xs shrink-0 ml-1">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Prompts() {
  const toast = useToast();
  const [prompts, setPrompts] = useState<PromptItem[]>(FALLBACK_PROMPTS);
  const [loading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeUseCase, setActiveUseCase] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Favorites Hook
  const { favorites, favoritesCount, toggleFavorite, isFavorite } = usePromptFavorites();

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, activeUseCase, sortBy, searchQuery]);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const { data, error } = await (supabase
        .from('ai_prompts')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false }) as any);

      if (!error && data && data.length > 0) {
        setPrompts(data);
      }
    } catch {
      // Fallback prompts are already in place
    }
  };

  const handleCopyPrompt = async (item: PromptItem, customContent?: string) => {
    const textToCopy = (customContent && customContent.trim()) ? customContent : item.prompt_content;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);

      // Increment copy count in background
      try {
        await ((supabase as any).rpc('increment_prompt_copy', { p_id: item.id }));
        setPrompts((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, copy_count: p.copy_count + 1 } : p))
        );
      } catch (rpcErr) {
        console.error('RPC increment error:', rpcErr);
      }

      toast.success('📋 Đã sao chép câu lệnh Prompt vào Clipboard!');
    } catch {
      toast.error('Không thể sao chép tự động. Vui lòng chọn và sao chép thủ công.');
    }
  };

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      // 1. Tool / Favorites Filter
      if (activeCategory === 'favorites') {
        if (!favorites.has(p.id)) return false;
      } else if (activeCategory !== 'all') {
        if (p.category.toLowerCase() !== activeCategory.toLowerCase()) return false;
      }

      // 2. Use-Case Filter
      if (activeUseCase !== 'all') {
        const uc = USE_CASES.find((u) => u.id === activeUseCase);
        if (uc?.keywords) {
          const contentLower = (p.prompt_content + ' ' + (p.title || '') + ' ' + (p.description || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
          const matchUseCase = uc.keywords.some((kw) => contentLower.includes(kw));
          if (!matchUseCase) return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchContent = p.prompt_content.toLowerCase().includes(q);
        const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));

        if (!matchTitle && !matchDesc && !matchContent && !matchTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'popular') {
        return (b.copy_count || 0) - (a.copy_count || 0);
      }
      if (sortBy === 'featured') {
        if (a.is_featured === b.is_featured) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.is_featured ? -1 : 1;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  }, [prompts, activeCategory, activeUseCase, sortBy, searchQuery, favorites]);

  const totalPages = Math.ceil(filteredPrompts.length / ITEMS_PER_PAGE) || 1;
  const paginatedPrompts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPrompts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPrompts, currentPage]);

  const hasActiveFilters = searchQuery.trim() !== '' || activeUseCase !== 'all' || activeCategory !== 'all';

  return (
    <div className="min-h-screen bg-[#F5F9FF] dark:bg-[#0B1224] pt-6 pb-28 sm:py-12 transition-colors duration-300">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 space-y-6 sm:space-y-8">
        
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[32px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-gradient-to-br from-white via-[#F0F7FF] to-[#E5F2FF] dark:from-[#131C32] dark:via-[#0F172A] dark:to-[#18243E] p-6 sm:p-12 shadow-xl text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/40 px-3.5 py-1 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] shadow-2xs backdrop-blur-xs">
            <span>✨</span>
            <span>Kho Tài Nguyên AI & Trình Điền Thông Số Tương Tác</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Thư Viện <span className="bg-gradient-to-r from-[#00A3FF] to-[#2563EB] bg-clip-text text-transparent">Prompt AI</span> Thông Minh
          </h1>

          <p className="mx-auto max-w-2xl text-xs sm:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Tuyển tập hàng trăm câu lệnh AI mẫu chất lượng cao cho ChatGPT, Claude Code, Midjourney, CapCut & Flux. Tự động điền biến số trực quan, live preview và sao chép 1-click hoàn toàn miễn phí!
          </p>

          {/* Search Bar in Hero */}
          <div className="mx-auto max-w-xl pt-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm Prompt (chân dung 8k, viết content, coding, logo...)"
                className="w-full h-12 sm:h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-[#18243E]/90 pl-11 pr-10 text-xs sm:text-sm font-medium text-slate-900 dark:text-white shadow-lg focus:border-[#2563EB] focus:outline-none transition"
              />
              <span className="absolute left-4 text-slate-400 text-lg">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1. Category Bar: Desktop wrap cleanly, Mobile smooth scroll */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap sm:flex-wrap overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all'
              ? prompts.length
              : cat.id === 'favorites'
              ? favoritesCount
              : prompts.filter((p) => p.category.toLowerCase() === cat.id).length;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-xs ${
                  isActive
                    ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-md scale-102'
                    : 'bg-white dark:bg-[#131C32] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#E8F1FF] dark:border-[#1E2A4A]/50'
                }`}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. Unified Streamlined Toolbar: Results Counter + Custom Dropdowns (Mục đích & Sắp xếp) */}
        <div className="relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-white/70 dark:bg-[#131C32]/70 backdrop-blur-md shadow-xs">
          
          {/* Left: Summary Results & Quick Reset */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              Hiển thị <span className="text-[#2563EB] dark:text-[#35A8FF] font-black">{filteredPrompts.length}</span> câu lệnh Prompt
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                  setActiveUseCase('all');
                }}
                className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer ml-2"
              >
                <span>✕</span> Đặt lại bộ lọc
              </button>
            )}
          </div>

          {/* Right: Custom Elegant Dropdowns (Use-Case + Sorting) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <CustomFilterDropdown
              value={activeUseCase}
              onChange={setActiveUseCase}
              options={USE_CASES}
              prefix="Mục đích"
            />

            <CustomFilterDropdown
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS}
              prefix="Sắp xếp"
            />
          </div>

        </div>

        {/* 3. Prompt Grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 rounded-[28px] bg-white/60 dark:bg-[#131C32]/60 animate-pulse border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-12 text-center space-y-3">
            <span className="text-4xl block">🔍</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {activeCategory === 'favorites' ? 'Chưa có Prompt nào được lưu' : 'Không tìm thấy Prompt phù hợp'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeCategory === 'favorites'
                ? 'Hãy bấm vào biểu tượng trái tim ❤️ trên bất kỳ Prompt nào để lưu lại dùng thường xuyên.'
                : 'Thử chọn mục đích khác hoặc chuyển sang danh mục "Tất cả Tool".'}
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); setActiveUseCase('all'); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 px-4 py-2 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline cursor-pointer"
            >
              Xem tất cả Prompts →
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedPrompts.map((item) => {
                const catStyle = CATEGORY_STYLES[item.category.toLowerCase()] || CATEGORY_STYLES.other;
                const isCopied = copiedId === item.id;
                const promptVars = extractPromptVariables(item.prompt_content, item.category);
                const hasVariables = promptVars.length > 0;
                const favorited = isFavorite(item.id);

                return (
                  <div
                    key={item.id}
                    className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-white dark:bg-[#131C32] p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group space-y-4 hover:-translate-y-1 relative"
                  >
                    <div className="space-y-3">
                      
                      {/* Thumbnail Image or Visual Header */}
                      {isValidPromptImageUrl(item.image_url) && !imgErrors[item.id] ? (
                        <div
                          onClick={() => setSelectedPrompt(item)}
                          className="relative h-44 w-full overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 cursor-pointer group/img"
                        >
                          <img
                            src={item.image_url!}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={() => setImgErrors((prev) => ({ ...prev, [item.id]: true }))}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-black text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                              {hasVariables ? '🎛️ Điền thông số & Xem' : '🔍 Xem chi tiết'}
                            </span>
                          </div>
                          
                          {/* Badges on Image */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                            {item.is_featured ? (
                              <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-black shadow-md flex items-center gap-1">
                                <span>⭐</span> Nổi bật
                              </span>
                            ) : <span />}

                            {/* Favorite Heart Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className={`h-8 w-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                                favorited
                                  ? 'bg-rose-500/90 text-white scale-105 shadow-md'
                                  : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-rose-400'
                              }`}
                            >
                              <span className="text-sm">{favorited ? '❤️' : '🤍'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => setSelectedPrompt(item)}
                          className={`relative h-28 w-full overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-gradient-to-br ${
                          item.category.toLowerCase() === 'chatgpt' ? 'from-emerald-600/20 via-teal-900/30 to-slate-900' :
                          item.category.toLowerCase() === 'midjourney' ? 'from-purple-600/20 via-indigo-900/30 to-slate-900' :
                          item.category.toLowerCase() === 'claude' ? 'from-amber-600/20 via-orange-900/30 to-slate-900' :
                          item.category.toLowerCase() === 'capcut' ? 'from-sky-600/20 via-blue-900/30 to-slate-900' :
                          'from-blue-600/20 via-indigo-900/30 to-slate-900'
                        } flex items-center justify-between p-4 cursor-pointer group/banner`}>
                          <div className="flex items-center gap-3">
                            <span className="text-3xl p-2.5 rounded-2xl bg-white/10 backdrop-blur-md shadow-xs transition-transform group-hover/banner:scale-110">
                              {CATEGORIES.find((c) => c.id === item.category.toLowerCase())?.icon || '🤖'}
                            </span>
                            <div>
                              <span className="text-xs font-black text-white uppercase tracking-wider block">
                                {item.category} Prompt
                              </span>
                              <span className="text-[11px] text-slate-300 font-medium line-clamp-1">
                                {item.title}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.is_featured && (
                              <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-black shadow-md flex items-center gap-1">
                                <span>⭐</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className={`h-8 w-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                                favorited
                                  ? 'bg-rose-500/90 text-white shadow-md'
                                  : 'bg-white/20 text-white/80 hover:bg-white/30 hover:text-rose-300'
                              }`}
                            >
                              <span className="text-sm">{favorited ? '❤️' : '🤍'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Top Badges & Copy Count */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {item.category}
                          </span>
                          {hasVariables && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <span>🎛️</span> {promptVars.length} biến
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold flex items-center gap-1">
                          <span>📋</span> {item.copy_count} lượt chép
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3
                          onClick={() => setSelectedPrompt(item)}
                          className="text-sm sm:text-base font-black text-slate-900 dark:text-white hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition-colors leading-snug cursor-pointer"
                        >
                          {item.title}
                        </h3>
                        {item.description && (
                          <p
                            onClick={() => setSelectedPrompt(item)}
                            className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed cursor-pointer hover:text-slate-900 dark:hover:text-white transition"
                          >
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Prompt Box with Quick Detail Link */}
                      <div className="relative">
                        <div
                          onClick={() => setSelectedPrompt(item)}
                          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#18243E] p-3 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-24 overflow-hidden select-all cursor-pointer relative group/code"
                        >
                          <p className="whitespace-pre-wrap line-clamp-3">{item.prompt_content}</p>
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 dark:from-[#18243E] to-transparent pointer-events-none" />
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedPrompt(item)}
                          className="w-full mt-2 py-1.5 px-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>{hasVariables ? '🎛️ Điền thông số & Tùy biến câu lệnh →' : '🔍 Xem chi tiết câu lệnh →'}</span>
                        </button>
                      </div>

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSearchQuery(tag)}
                              className="text-[10px] font-semibold text-slate-400 hover:text-[#2563EB] bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md transition cursor-pointer"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      {hasVariables ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPrompt(item)}
                          className="w-full h-10 rounded-2xl font-black text-xs transition-all shadow-md bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] text-white hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-blue-500/25"
                        >
                          <span>🎛️ Điền thông số & Sao chép</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(item)}
                          className={`w-full h-10 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-500 text-white scale-98'
                              : 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] text-white hover:scale-102 active:scale-98'
                          }`}
                        >
                          {isCopied ? (
                            <span>✓ Đã sao chép câu lệnh!</span>
                          ) : (
                            <>
                              <span>📋 Sao chép Prompt</span>
                              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">1-Click</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredPrompts.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  itemLabel="câu lệnh Prompt"
                  onPageChange={(p) => {
                    setCurrentPage(p);
                    window.scrollTo({ top: 350, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* Prompt Detail Modal with Interactive Builder & Direct Launch */}
        <PromptDetailModal
          prompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onCopy={handleCopyPrompt}
          isCopied={copiedId === selectedPrompt?.id}
          onTagClick={(tag) => setSearchQuery(tag)}
          isFavorite={selectedPrompt ? isFavorite(selectedPrompt.id) : false}
          onToggleFavorite={toggleFavorite}
        />
      </div>
    </div>
  );
}
