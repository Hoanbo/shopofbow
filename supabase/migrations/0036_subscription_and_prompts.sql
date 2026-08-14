-- Migration 0036: Subscription Renewal Engine and AI Prompt Hub

-- 1. Add subscription and renewal fields to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_policy TEXT DEFAULT 'new_account',
ADD COLUMN IF NOT EXISTS renewed_from_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_account TEXT;

-- Index for expiration queries (checking expiring services)
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_renewal_policy ON orders(renewal_policy);

-- 2. Create ai_prompts table for AI Prompt Hub & SEO
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'chatgpt', 'midjourney', 'claude', 'capcut', 'flux', 'canva', 'other'
  prompt_content TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  copy_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for prompt category filtering and search
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_featured ON ai_prompts(is_featured);

-- Enable RLS
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Public can view prompts
DROP POLICY IF EXISTS "Public can view ai prompts" ON ai_prompts;
CREATE POLICY "Public can view ai prompts" ON ai_prompts
  FOR SELECT
  USING (true);

-- Authenticated admins can manage prompts (Using hardened public.is_admin())
DROP POLICY IF EXISTS "Admins can insert ai prompts" ON ai_prompts;
CREATE POLICY "Admins can insert ai prompts" ON ai_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update ai prompts" ON ai_prompts;
CREATE POLICY "Admins can update ai prompts" ON ai_prompts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete ai prompts" ON ai_prompts;
CREATE POLICY "Admins can delete ai prompts" ON ai_prompts
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- RPC to increment copy count safely
CREATE OR REPLACE FUNCTION increment_prompt_copy(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_prompts
  SET copy_count = COALESCE(copy_count, 0) + 1
  WHERE id = p_id;
END;
$$;

-- Seed Master-Class Professional Mega-Prompts
INSERT INTO ai_prompts (title, category, prompt_content, image_url, description, tags, copy_count, is_featured)
VALUES 
(
  'Chuyên Gia Audit & Tối Ưu Hóa Code Toàn Diện (Senior Tech Lead)',
  'claude',
  'Bạn là một Principal Software Engineer và Security Auditor với 15+ năm kinh nghiệm trong các hệ thống phân tán quy mô lớn (High-Concurrency Distributed Systems). 

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
```typescript
[DÁN MÃ NGUỒN CỦA BẠN VÀO ĐÂY]
```',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
  'Mega-Prompt 5 bước biến Claude 3.5 Sonnet / Cursor Pro thành Senior Tech Lead rà soát kiến trúc, bảo mật và refactor code chuẩn enterprise.',
  ARRAY['claude', 'coding', 'typescript', 'architecture', 'security', 'refactor', 'unit-test'],
  428,
  true
),
(
  'Chiến Lược Content & Kịch Bản Video Ngắn Triệu View (Viral Hook Matrix)',
  'chatgpt',
  'Đóng vai một Viral Growth Hacker và Creative Director từng xây dựng các kênh TikTok/Reels đạt hàng triệu người theo dõi trong ngành [NGÀNH HÀNG CỦA BẠN].

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
- Tạo tính khan hiếm (Urgency/FOMO) + Ưu đãi đặc quyền nếu hành động ngay hôm nay.

5. 🎬 Gợi ý Chi tiết Biên tập (Editor Notes):
- B-Roll gợi ý, Font chữ phụ đề, Màu chữ nổi bật và Nhạc nền (Trending Sound BGM).',
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
  'Khung kịch bản video ngắn chuẩn tâm lý học hành vi giữ chân người xem và chuyển đổi đơn hàng thần tốc với ChatGPT Plus.',
  ARRAY['chatgpt', 'tiktok', 'viral', 'marketing', 'copywriting', 'video-script'],
  612,
  true
),
(
  'Chụp Ảnh Sản Phẩm Studio Thương Mại Cao Cấp (Commercial Studio Photography)',
  'midjourney',
  '/imagine prompt: Commercial studio product photography of a [TÊN SẢN PHẨM, VÍ DỤ: luxury matte black cosmetic bottle / premium wireless earbuds], placed on a sleek minimalist dark slate stone pedestal, surrounded by elegant crystal-clear water splashes with micro air bubbles, subtle botanical elements in soft focus background. 

Lighting: Three-point studio lighting setup, Profoto B10X with large softbox key light, subtle cyan and golden rim light emphasizing product contours, soft ambient fill light. 

Camera & Optics: Shot on Hasselblad H6D-100c, 90mm Macro Lens f/4, crisp sharp focus on product label, beautiful shallow depth of field, natural surface textures, photorealistic ray-traced reflections and refractions, 8k resolution, advertising quality, magazine cover grade --ar 16:9 --v 6.0 --style raw --q 2',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  'Prompt chụp ảnh sản phẩm thương mại chuẩn studio nhiếp ảnh quảng cáo cao cấp với ánh sáng 3 điểm và lens macro siêu thực.',
  ARRAY['midjourney', 'commercial', 'product-photography', 'studio-lighting', '8k', 'advertising'],
  534,
  true
),
(
  'Viết Bài Chuẩn SEO Top 1 Google & Đáp Ứng E-E-A-T (Semantic SEO Master)',
  'claude',
  'Bạn là một Chuyên gia SEO Content Strategist hàng đầu với tư duy Semantic Search và am hiểu sâu sắc thuật toán Google Helpful Content & E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).

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
- Meta Description (dưới 155 ký tự, tóm tắt giá trị + CTA mạnh mẽ).',
  'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?auto=format&fit=crop&w=800&q=80',
  'Framework viết bài chuẩn SEO đỉnh cao tối ưu hóa cho thuật toán E-E-A-T và Semantic Search của Google với Claude Pro.',
  ARRAY['claude', 'seo', 'content-marketing', 'google-ranking', 'copywriting', 'eeat'],
  345,
  false
),
(
  'Quy Trình Biên Tập Video Viral Bán Hàng & Chỉnh Màu Cinematic (CapCut Pro)',
  'capcut',
  'Bộ quy chuẩn kỹ thuật dựng video ngắn chuyển đổi cao dành cho CapCut Pro:

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
- Độ hạt (Film Grain): +10 (Tạo chất phim điện ảnh sang trọng).',
  'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
  'Công thức dựng video ngắn, thiết kế âm thanh SFX và thông số chỉnh màu chuẩn điện ảnh dành riêng cho CapCut Pro.',
  ARRAY['capcut', 'video-editing', 'color-grading', 'sound-design', 'tiktok-reels'],
  489,
  false
),
(
  'Thiết Kế Giao Diện UI/UX Dashboard SaaS Hiện Đại (Modern SaaS UI/UX)',
  'midjourney',
  '/imagine prompt: Modern sleek SaaS web application dashboard UI/UX design for an AI Analytics & Financial Platform, clean dark mode theme with rich deep navy (#0B1224) background, elegant frosted glassmorphism metric cards with subtle vibrant blue (#00A3FF) and neon purple glowing borders.

Key Elements: Real-time revenue interactive line charts, glowing AI insight widgets, polished transactions data table with status pill badges, modern minimalist sidebar with glowing active icons, clean user profile header with notification indicators.

Style & Aesthetics: Figma-ready design style, Dribbble and Behance trending, pixel-perfect 12-column grid layout, SF Pro typography, refined micro-interactions, high-end fintech aesthetics, 8k resolution, crisp vector details --ar 16:9 --v 6.0 --style raw',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
  'Prompt tạo giao diện Web/App SaaS Dashboard phong cách Dark Mode Glassmorphism chuẩn Dribbble & Behance.',
  ARRAY['midjourney', 'ui-ux', 'dashboard', 'figma', 'glassmorphism', 'saas', 'dark-mode'],
  298,
  false
);
