# BOW — Let's Connect

Cửa hàng giới thiệu **AI Tools & Premium Apps** (ChatGPT, Claude, Gemini, Netflix, Spotify, Canva…) xây dựng bằng **React + TypeScript + Vite + Tailwind CSS**, dữ liệu động qua **Supabase**, có **Admin Dashboard** và deploy sẵn sàng lên **Vercel**.

## Tech stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3
- React Router 6 (SPA)
- Supabase (Postgres + Auth + Storage)

## Tính năng

**Website công khai**
- Trang chủ: AI Tools, Premium Apps, Featured Products, CTA liên hệ
- Danh sách theo loại: `/ai-tools`, `/premium-apps`, `/products` (search + filter + sort)
- Trang chi tiết động theo slug: gói giá, tính năng, FAQ, sản phẩm liên quan
- Nút **Liên hệ Facebook / Zalo** trên từng sản phẩm (lấy link từ `contact_settings`)
- Search toàn site, SEO title/description động, Open Graph, lazy-load ảnh
- Loading / empty / error states, responsive Desktop + Mobile

**Admin Dashboard** (`/admin`)
- Đăng nhập bằng Supabase Auth
- Thống kê: tổng sản phẩm, AI Tools, Premium Apps, sản phẩm nổi bật
- CRUD: Products, Categories, Product Plans, Features, FAQs (theo sản phẩm + chung)
- Chọn sản phẩm nổi bật / bật-tắt hiển thị
- Upload logo/banner lên Supabase Storage
- Chỉnh sửa Facebook URL, Zalo URL, hotline, email

---

## 1. Chạy local

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị Supabase (xem mục 2)
npm run dev
```

Mở http://localhost:5173

Biến môi trường (`.env.local`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> `anon key` an toàn để dùng ở trình duyệt vì RLS chỉ cho phép đọc công khai; mọi thao tác ghi yêu cầu đăng nhập.

---

## 2. Thiết lập Supabase

1. Tạo project tại https://supabase.com → **Project Settings → API** để lấy `URL` và `anon public key`.
2. Vào **SQL Editor** và chạy lần lượt các file trong `supabase/migrations/`:
   - `0001_init.sql` — tạo bảng + RLS đọc công khai
   - `0002_seed.sql` — dữ liệu mẫu (khớp catalog gốc)
   - `0003_admin.sql` — quyền ghi cho user đã đăng nhập + bucket Storage `assets`
3. **Tạo tài khoản admin**: **Authentication → Users → Add user** (nhập email + mật khẩu, tick *Auto Confirm*).
4. **Tắt đăng ký công khai** để chỉ admin được tạo có thể đăng nhập: **Authentication → Providers → Email** → tắt *Enable sign-ups* (khuyến nghị).
5. Đăng nhập bằng tài khoản admin tại `/login`, sau đó truy cập `/admin`.

### Upload ảnh
Migration `0003_admin.sql` đã tạo bucket công khai `assets`. Admin có thể upload logo/banner trực tiếp trong trang chỉnh sửa sản phẩm. Nếu chưa chạy migration này, chức năng upload sẽ báo lỗi (vẫn có thể dán URL ảnh thủ công).

---

## 3. Deploy lên Vercel

Repo đã có `vercel.json` cấu hình sẵn SPA fallback và Vercel Serverless Functions (không lỗi 404 khi refresh deep-link).

**Cách 1 — nối Git (khuyến nghị):**
1. Push code lên GitHub/GitLab.
2. Vercel → **Add New... → Project → Import Git Repository** → chọn repo.
3. Framework Preset chọn **Vite**, Build command `npm run build`, output directory `dist` (đã tự động nhận diện).
4. **Site settings → Environment variables** thêm:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

**Cách 2 — Vercel CLI:**
```bash
npm i -g vercel
vercel --prod
```

> Nhớ thêm domain Vercel vào **Supabase → Authentication → URL Configuration → Site URL / Redirect URLs** để đăng nhập admin hoạt động trên production.

---

## Scripts

```bash
npm run dev        # chạy dev server
npm run build      # type-check (tsc -b) + build production
npm run preview    # xem thử bản build
npm run typecheck  # chỉ type-check
```

## Cấu trúc thư mục

```
src/
  components/        # Header, Footer, cards, SearchBar, admin/ui...
  context/           # AuthContext, ContactContext
  data/              # api.ts (đọc public), admin.ts (CRUD), types.ts
  hooks/             # useAsync, useSeo
  lib/               # supabase client + database types
  pages/             # trang công khai + pages/admin/*
supabase/migrations/ # 0001_init, 0002_seed, 0003_admin
vercel.json          # build + SPA redirect + headers + serverless
```
