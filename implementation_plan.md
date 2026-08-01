# 🔥 Chẩn đoán & Fix SePay Webhook 401

## Root Cause Analysis

Sau khi đọc toàn bộ code + đối chiếu với screenshot SePay, tìm ra **3 vấn đề**:

---

### ❌ Vấn đề #1 — SAI URL WEBHOOK (nghiêm trọng nhất)

SePay đang gọi:
```
https://hzrbiadnppsehcfgufuw.supabase.co/functions/v1/clever-task
```

URL này là **Supabase Edge Function tên "clever-task"** — không tồn tại trong project.

URL đúng phải là:
```
https://shopofbow.netlify.app/.netlify/functions/sepay-webhook
```

---

### ❌ Vấn đề #2 — SePay chưa gửi đúng API Key Header

Function `sepay-webhook.ts` xác thực bằng:
```
Authorization: Apikey whsec_M9i8YzxMpYyiICJ4CSGlZn5T2j1IINat
```

Nhưng SePay cần được cấu hình để gửi header này. Cần kiểm tra SePay Dashboard đã
có cấu hình **API Key authentication** trùng với `SEPAY_API_KEY` chưa.

---

### ⚠️ Vấn đề #3 — Netlify env vars chưa chắc đồng bộ

File `.env` là local config, Netlify Functions dùng env vars trong **Site Settings > Environment variables**. Cần verify các biến sau đã đặt đúng trên Netlify:

| Biến | Giá trị |
|------|---------|
| `SUPABASE_URL` | `https://hzrbiadnppsehcfgufuw.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` |
| `SEPAY_API_KEY` | `whsec_M9i8YzxMpYyiICJ4CSGlZn5T2j1IINat` |
| `TELEGRAM_BOT_TOKEN` | Token mới (đã rotate) |
| `TELEGRAM_CHAT_ID` | `7102969020` |
| `INTERNAL_API_KEY` | `81d70e09-f061-4967-ab9c-9cdc1782e128` |

---

## Implementation Plan

### Bước 1: Test Netlify Function còn sống không (30 giây)

Chạy script diagnostic để gọi thử function với đúng format — nếu trả về 401 thì function
đang chạy nhưng API key sai. Nếu 404 thì function chưa deploy.

### Bước 2: Sửa URL trong SePay Dashboard

Thay URL webhook từ Supabase Edge Function sang Netlify Function.

### Bước 3: Cấu hình API Key trong SePay

SePay hỗ trợ gửi custom header. Thêm header `Authorization: Apikey whsec_M9i8YzxMpYyiICJ4CSGlZn5T2j1IINat`.

### Bước 4: Verify Netlify env vars

Tôi sẽ tạo một script test thực sự gọi function từ local với đúng key để xác nhận.

### Bước 5: Xử lý các đơn đã mất (fallback thủ công)

Với các đơn hàng đã thanh toán nhưng webhook lỗi → vẫn còn ở `pending_payment`, tôi sẽ
viết query để admin có thể confirm thủ công.

---

## Verify Plan

Sau khi fix, tôi sẽ:
1. Dùng `curl` test trực tiếp Netlify function với payload SePay thật
2. Kiểm tra Supabase DB xem đơn có được cập nhật không
3. Kiểm tra Telegram có nhận được thông báo không
