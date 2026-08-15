import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/admin/Pagination';
import PromptDetailModal from '../components/user/PromptDetailModal';

interface PromptItem {
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
  { id: 'all', label: 'Tất cả', icon: '🌐', count: 0 },
  { id: 'chatgpt', label: 'ChatGPT', icon: '🤖', count: 0 },
  { id: 'midjourney', label: 'Midjourney', icon: '🎨', count: 0 },
  { id: 'claude', label: 'Claude', icon: '⚡', count: 0 },
  { id: 'capcut', label: 'CapCut', icon: '🎬', count: 0 },
  { id: 'flux', label: 'Flux & SD', icon: '🔮', count: 0 },
  { id: 'canva', label: 'Canva', icon: '🖌️', count: 0 },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; ctaProduct: string; ctaText: string }> = {
  chatgpt: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
    ctaProduct: 'ChatGPT Plus',
    ctaText: 'Dùng mượt nhất với tài khoản ChatGPT Plus',
  },
  midjourney: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200/60 dark:border-purple-900/40',
    ctaProduct: 'Midjourney',
    ctaText: 'Vẽ ảnh chất lượng cao với Midjourney Pro',
  },
  claude: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
    ctaProduct: 'Claude Pro',
    ctaText: 'Coding đỉnh cao với tài khoản Claude 3.5 Sonnet',
  },
  capcut: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-[#00A3FF] dark:text-[#35A8FF]',
    border: 'border-sky-200/60 dark:border-sky-900/40',
    ctaProduct: 'CapCut Pro',
    ctaText: 'Edit video giật giật không watermark với CapCut Pro',
  },
  flux: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
    ctaProduct: 'Leonardo AI',
    ctaText: 'Gen ảnh AI không giới hạn tại BOW',
  },
  canva: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200/60 dark:border-cyan-900/40',
    ctaProduct: 'Canva Pro',
    ctaText: 'Mở khóa toàn bộ tính năng Canva Pro vĩnh viễn',
  },
  other: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    ctaProduct: 'Sản phẩm',
    ctaText: 'Khám phá thêm các công cụ AI tại BOW',
  },
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
- Viết lại toàn bộ code bằng TypeScript chuẩn mực (Strict Type, không dùng "any", đầy đủ Interface, Generics, Error Handling bằng Result Pattern hoặc Custom Error Class).

5. 🧪 Bộ Unit Test Chuẩn (Jest / Vitest):
- Viết kèm test case bao quát Happy Path, Edge Cases (dữ liệu null/undefined/boundary) và Failure Handling.

Đoạn code cần xử lý:
\`\`\`typescript
[DÁN MÃ NGUỒN CỦA BẠN VÀO ĐÂY]
\`\`\``,
    image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
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

Nhiệm vụ: Xây dựng kịch bản video ngắn (dưới 60 giây) bán sản phẩm/dịch vụ [TÊN SẢN PHẨM] nhắm tới đối tượng [CHÂN DUNG KHÁCH HÀNG].

Cấu trúc kịch bản phải tuân theo công thức "Hook - Retain - Reward - Convert":

1. 🪝 3 Lựa Chọn Mở Đầu Giật Gân (3s First Hooks):
- Hook 1 (Phá vỡ định kiến/Tâm lý ngược): Một câu khẳng định ngược đời khiến người xem phải dừng lại.
- Hook 2 (Chạm đúng nỗi đau cấp bách): Đánh thẳng vào vấn đề đau đớn nhất mà họ gặp mỗi ngày.
- Hook 3 (Con số gây sốc / Bí mật ít ai biết): "90% người dùng [Sản phẩm] đang lãng phí tiền vì không biết điều này..."

2. 📈 Giữ Chân Người Xem (15s Pacing - Nỗi Đau & Đồng Cảm):
- Mô tả kịch bản hình ảnh (Visual Action) + Hiệu ứng âm thanh (SFX) để người xem không thể lướt qua.
- Dẫn dắt cảm xúc: Từ hoang mang, bực bội sang tò mò giải pháp.

3. 💡 Bật Mí Giải Pháp (25s Solution Demo):
- Trình bày 3 lợi ích cốt lõi độc nhất (Unique Selling Points - USP) của [TÊN SẢN PHẨM] một cách thực tế, không nói lý thuyết sáo rỗng.
- Hiển thị bằng chứng trực quan (Before vs After).

4. 🎯 Kêu Gọi Hành Động Không Thể Chối Từ (7s Irresistible CTA):
- Tạo tính khan hiếm (Urgency/FOMO) + Ưu đãi đặc quyền nếu hành động ngay hôm đây.

5. 🎬 Gợi ý Chi tiết Biên tập (Editor Notes):
- B-Roll gợi ý, Font chữ phụ đề, Màu chữ nổi bật và Nhạc nền (Trending Sound BGM).`,
    image_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
    description: 'Khung kịch bản video ngắn chuẩn tâm lý học hành vi giữ chân người xem và chuyển đổi đơn hàng thần tốc với ChatGPT Plus.',
    tags: ['chatgpt', 'tiktok', 'viral', 'marketing', 'copywriting', 'video-script'],
    copy_count: 612,
    is_featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f3',
    title: 'Chụp Ảnh Sản Phẩm Studio Thương Mại Cao Cấp (Commercial Studio Photography)',
    category: 'midjourney',
    prompt_content: `/imagine prompt: Commercial studio product photography of a [TÊN SẢN PHẨM, VÍ DỤ: luxury matte black cosmetic bottle / premium wireless earbuds], placed on a sleek minimalist dark slate stone pedestal, surrounded by elegant crystal-clear water splashes with micro air bubbles, subtle botanical elements in soft focus background. 

Lighting: Three-point studio lighting setup, Profoto B10X with large softbox key light, subtle cyan and golden rim light emphasizing product contours, soft ambient fill light. 

Camera & Optics: Shot on Hasselblad H6D-100c, 90mm Macro Lens f/4, crisp sharp focus on product label, beautiful shallow depth of field, natural surface textures, photorealistic ray-traced reflections and refractions, 8k resolution, advertising quality, magazine cover grade --ar 16:9 --v 6.0 --style raw --q 2`,
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    description: 'Prompt chụp ảnh sản phẩm thương mại chuẩn studio nhiếp ảnh quảng cáo cao cấp với ánh sáng 3 điểm và lens macro siêu thực.',
    tags: ['midjourney', 'commercial', 'product-photography', 'studio-lighting', '8k', 'advertising'],
    copy_count: 534,
    is_featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f4',
    title: 'Viết Bài Chuẩn SEO Top 1 Google & Đáp Ứng E-E-A-T (Semantic SEO Master)',
    category: 'claude',
    prompt_content: `Bạn là một Chuyên gia SEO Content Strategist hàng đầu với tư duy Semantic Search và am hiểu sâu sắc thuật toán Google Helpful Content & E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).

Nhiệm vụ: Viết một bài viết toàn diện, chuyên sâu và chuẩn SEO về chủ đề: "[TỪ KHÓA CHÍNH]" dành cho tệp độc giả [ĐỐI TƯỢNG ĐỌC].

Yêu cầu kỹ thuật bắt buộc:
1. 🎯 Phân tích Search Intent:
- Xác định rõ mục đích tìm kiếm (Informational, Commercial Investigation, hay Transactional) và giải quyết triệt để vấn đề của người đọc ngay trong 100 từ đầu tiên (Inverted Pyramid Style).

2. 📐 Cấu trúc Heading Phân cấp (H1, H2, H3):
- Chèn từ khóa chính, từ khóa phụ (LSI keywords) và các biến thể ngữ nghĩa tự nhiên vào tiêu đề.
- Có bảng biểu so sánh (Markdown Table), danh sách gạch đầu dòng (Bullet Points) và Hộp trích dẫn quan trọng (Key Takeaways).

3. ✍️ Văn phong Chuyên gia Chân thực:
- Sử dụng giọng văn tự nhiên của người trong nghề (First-hand experience), tuyệt đối không dùng các từ ngữ sáo rỗng của AI như "Trong kỷ nguyên số", "Tóm lại là", "Như chúng ta đã biết".
- Đưa ra ví dụ thực tế và số liệu minh chứng cụ thể.

4. ❓ Mục FAQ & Schema Markup (JSON-LD):
- 4 câu hỏi thường gặp mà người dùng hay tìm kiếm (People Also Ask).
- Kèm theo đoạn mã Schema FAQPage chuẩn Google để dễ lên Rich Snippets.

5. 🏷️ Gợi ý Meta SEO:
- Meta Title (dưới 60 ký tự, chứa từ khóa chính + yếu tố kích thích click).
- Meta Description (dưới 155 ký tự, tóm tắt giá trị + CTA mạnh mẽ).`,
    image_url: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?auto=format&fit=crop&w=800&q=80',
    description: 'Framework viết bài chuẩn SEO đỉnh cao tối ưu hóa cho thuật toán E-E-A-T và Semantic Search của Google với Claude Pro.',
    tags: ['claude', 'seo', 'content-marketing', 'google-ranking', 'copywriting', 'eeat'],
    copy_count: 345,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f5',
    title: 'Quy Trình Biên Tập Video Viral Bán Hàng & Chỉnh Màu Cinematic (CapCut Pro)',
    category: 'capcut',
    prompt_content: `Bộ quy chuẩn kỹ thuật dựng video ngắn chuyển đổi cao dành cho CapCut Pro:

1. ✂️ Nhịp điệu cắt ghép (Pacing & Cuts):
- 3 giây đầu: Cắt hình mỗi 0.6s - 0.8s (Fast Cuts) kết hợp hiệu ứng Zoom In 110% để giữ mắt người xem.
- Thân bài: Cắt mỗi 2s - 3s, sử dụng J-Cut (tiếng xuất hiện trước hình) và L-Cut (hình đổi trước tiếng) để tạo sự liền mạch.

2. 🔊 Thiết kế Âm thanh (Sound Design - 3 Lớp):
- Lớp 1 (Voiceover): Áp dụng hiệu ứng "Clear Voice" hoặc "Mic Studio", giảm Noise -25dB.
- Lớp 2 (Sound FX): Chèn tiếng "Whoosh" khi đổi cảnh, tiếng "Pop" khi xuất hiện text, tiếng "Sub-bass Thud" khi nhấn mạnh luận điểm.
- Lớp 3 (BGM): Hạ âm lượng nhạc nền xuống -22dB đến -26dB khi có giọng nói, tăng lên -12dB ở đoạn hook đầu.

3. 📝 Preset Phụ Đề Nổi Bật:
- Font chữ: Montserrat Black / Arial Bold / Proxima Nova.
- Màu sắc: Vàng Neon (#FFD600) kết hợp Viền đen (Stroke 4px) + Bóng đổ (Shadow 40%).
- Hiệu ứng Text Animation: "Spring Bounce" hoặc "Karaoke Glow".

4. 🎨 Thông số Chỉnh Màu Cinematic Film Look:
- Độ sáng (Brightness): -6
- Độ tương phản (Contrast): +18
- Vùng sáng (Highlights): -22 (Lấy lại chi tiết bầu trời/khuôn mặt)
- Vùng tối (Shadows): +14 (Kéo sáng chi tiết áo quần)
- Độ nét (Sharpen): +25
- Độ hạt (Film Grain): +10 (Tạo chất phim điện ảnh sang trọng).`,
    image_url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
    description: 'Công thức dựng video ngắn, thiết kế âm thanh SFX và thông số chỉnh màu chuẩn điện ảnh dành riêng cho CapCut Pro.',
    tags: ['capcut', 'video-editing', 'color-grading', 'sound-design', 'tiktok-reels'],
    copy_count: 489,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f6',
    title: 'Thiết Kế Giao Diện UI/UX Dashboard SaaS Hiện Đại (Modern SaaS UI/UX)',
    category: 'midjourney',
    prompt_content: `/imagine prompt: Modern sleek SaaS web application dashboard UI/UX design for an AI Analytics & Financial Platform, clean dark mode theme with rich deep navy (#0B1224) background, elegant frosted glassmorphism metric cards with subtle vibrant blue (#00A3FF) and neon purple glowing borders.

Key Elements: Real-time revenue interactive line charts, glowing AI insight widgets, polished transactions data table with status pill badges, modern minimalist sidebar with glowing active icons, clean user profile header with notification indicators.

Style & Aesthetics: Figma-ready design style, Dribbble and Behance trending, pixel-perfect 12-column grid layout, SF Pro typography, refined micro-interactions, high-end fintech aesthetics, 8k resolution, crisp vector details --ar 16:9 --v 6.0 --style raw`,
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    description: 'Prompt tạo giao diện Web/App SaaS Dashboard phong cách Dark Mode Glassmorphism chuẩn Dribbble & Behance.',
    tags: ['midjourney', 'ui-ux', 'dashboard', 'figma', 'glassmorphism', 'saas', 'dark-mode'],
    copy_count: 298,
    is_featured: false,
    created_at: new Date().toISOString(),
  },
];

export default function Prompts() {
  const toast = useToast();
  const [prompts, setPrompts] = useState<PromptItem[]>(FALLBACK_PROMPTS);
  const [loading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

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

  const handleCopyPrompt = async (item: PromptItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt_content);
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
      const matchCat = activeCategory === 'all' || p.category.toLowerCase() === activeCategory.toLowerCase();
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchContent = p.prompt_content.toLowerCase().includes(q);
      const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));

      return matchTitle || matchDesc || matchContent || matchTags;
    });
  }, [prompts, activeCategory, searchQuery]);

  const totalPages = Math.ceil(filteredPrompts.length / ITEMS_PER_PAGE) || 1;
  const paginatedPrompts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPrompts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPrompts, currentPage]);

  return (
    <div className="min-h-screen bg-[#F5F9FF] dark:bg-[#0B1224] pt-6 pb-28 sm:py-12 transition-colors duration-300">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[32px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-gradient-to-br from-white via-[#F0F7FF] to-[#E5F2FF] dark:from-[#131C32] dark:via-[#0F172A] dark:to-[#18243E] p-6 sm:p-12 shadow-xl text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/40 px-3.5 py-1 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] shadow-2xs backdrop-blur-xs">
            <span>✨</span>
            <span>Kho Tài Nguyên AI Độc Quyền</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Thư Viện <span className="bg-gradient-to-r from-[#00A3FF] to-[#2563EB] bg-clip-text text-transparent">Prompt AI</span> Miễn Phí
          </h1>

          <p className="mx-auto max-w-2xl text-xs sm:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Tuyển tập hàng trăm câu lệnh AI mẫu chất lượng cao cho ChatGPT, Midjourney, Claude Code, CapCut, Flux & Canva. Sao chép 1-click và sử dụng ngay lập tức!
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
                  className="absolute right-3.5 h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all'
              ? prompts.length
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

        {/* Prompt Grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 rounded-[28px] bg-white/60 dark:bg-[#131C32]/60 animate-pulse border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-12 text-center space-y-3">
            <span className="text-4xl block">🔍</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Không tìm thấy Prompt phù hợp</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả".
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 px-4 py-2 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
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

                return (
                  <div
                    key={item.id}
                    className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-white dark:bg-[#131C32] p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group space-y-4 hover:-translate-y-1"
                  >
                    <div className="space-y-3">
                      {/* Thumbnail Image or Gradient Visual Header */}
                      {item.image_url && !imgErrors[item.id] ? (
                        <div
                          onClick={() => setSelectedPrompt(item)}
                          className="relative h-44 w-full overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 cursor-pointer group/img"
                        >
                          <img
                            src={item.image_url}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={() => setImgErrors((prev) => ({ ...prev, [item.id]: true }))}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-black text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                              🔍 Xem chi tiết
                            </span>
                          </div>
                          {item.is_featured && (
                            <span className="absolute top-2.5 right-2.5 rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-black shadow-md flex items-center gap-1 z-10">
                              <span>⭐</span> Nổi bật
                            </span>
                          )}
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
                          {item.is_featured && (
                            <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-black shadow-md flex items-center gap-1 shrink-0">
                              <span>⭐</span> Nổi bật
                            </span>
                          )}
                        </div>
                      )}

                      {/* Top Badges & Copy Count */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          {item.category}
                        </span>
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
                          <span>🔍 Xem chi tiết, mục đích & kết quả mẫu →</span>
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
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
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

        {/* Prompt Detail Modal */}
        <PromptDetailModal
          prompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onCopy={handleCopyPrompt}
          isCopied={copiedId === selectedPrompt?.id}
          onTagClick={(tag) => setSearchQuery(tag)}
        />
      </div>
    </div>
  );
}
