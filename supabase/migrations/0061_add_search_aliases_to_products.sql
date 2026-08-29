-- ============================================================
-- Migration 0061: Thêm trường search_aliases cho bảng products
-- Dành cho Dynamic Product Resolver của BOW Agent
-- ============================================================

-- 1. Bổ sung cột search_aliases (mảng text) vào bảng products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS search_aliases text[] DEFAULT '{}'::text[];

-- 2. Tạo GIN index để tối ưu hóa truy vấn mảng search_aliases
CREATE INDEX IF NOT EXISTS idx_products_search_aliases ON public.products USING GIN(search_aliases);

-- 3. Backfill dữ liệu aliases mẫu vào các sản phẩm hiện có
UPDATE public.products
SET search_aliases = ARRAY['capcut', 'capcut pro', 'cap cut', 'capcut pc', 'chinh video']
WHERE slug ILIKE '%capcut%' OR name ILIKE '%capcut%';

UPDATE public.products
SET search_aliases = ARRAY['chatgpt', 'chat gpt', 'gpt', 'openai', 'chatgpt plus', 'gpt-4o', 'gpt4']
WHERE slug ILIKE '%chatgpt%' OR name ILIKE '%chatgpt%';

UPDATE public.products
SET search_aliases = ARRAY['claude', 'claude ai', 'claude pro', 'anthropic', 'sonnet', 'claude 3.5']
WHERE slug ILIKE '%claude%' OR name ILIKE '%claude%';

UPDATE public.products
SET search_aliases = ARRAY['canva', 'canva pro', 'canva edu', 'thiet ke canva']
WHERE slug ILIKE '%canva%' OR name ILIKE '%canva%';

UPDATE public.products
SET search_aliases = ARRAY['gemini', 'gemini advanced', 'google one', 'google ai', 'google drive']
WHERE slug ILIKE '%google%' OR slug ILIKE '%gemini%' OR name ILIKE '%gemini%' OR name ILIKE '%google one%';

UPDATE public.products
SET search_aliases = ARRAY['netflix', 'netflix 4k', 'netflix premium', 'xem phim netflix']
WHERE slug ILIKE '%netflix%' OR name ILIKE '%netflix%';

UPDATE public.products
SET search_aliases = ARRAY['youtube', 'yt', 'youtube premium', 'yt premium', 'youtube khong quang cao']
WHERE slug ILIKE '%youtube%' OR name ILIKE '%youtube%';

UPDATE public.products
SET search_aliases = ARRAY['spotify', 'spotify premium', 'nghe nhac spotify']
WHERE slug ILIKE '%spotify%' OR name ILIKE '%spotify%';

UPDATE public.products
SET search_aliases = ARRAY['figma', 'figma pro', 'figma professional', 'thiet ke figma']
WHERE slug ILIKE '%figma%' OR name ILIKE '%figma%';

UPDATE public.products
SET search_aliases = ARRAY['leonardo', 'leonardo ai', 've anh ai', 'tao anh ai']
WHERE slug ILIKE '%leonardo%' OR name ILIKE '%leonardo%';

UPDATE public.products
SET search_aliases = ARRAY['elevenlabs', 'eleven labs', 'giong doc ai', 'voice ai']
WHERE slug ILIKE '%eleven%' OR name ILIKE '%eleven%';

UPDATE public.products
SET search_aliases = ARRAY['autodesk', 'autocad', '3ds max', 'revit', 'maya']
WHERE slug ILIKE '%autodesk%' OR name ILIKE '%autodesk%';
