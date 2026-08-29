# 🛡️ BOW Agent V1 Specification & Safety Boundary

Tài liệu xác định phạm vi và ranh giới an toàn của **✨ BOW Agent V1 (Frozen Spec)**.

---

## 1. MỤC TIÊU V1 (SCOPE)
Cung cấp trợ lý thông minh hỗ trợ khách hàng và khách vãng lai tra cứu thông tin 24/7 với hiệu suất cao, 100% dữ liệu thực từ Database Supabase.

### ✅ 8 Read-only Tools được phép hoạt động:
1. `searchProducts`: Tra cứu toàn bộ kho sản phẩm, phân nhóm AI Tools & Premium Apps, bảng giá, thời hạn, tính năng và bảo hành.
2. `getMyOrders`: Tra cứu lịch sử 6 đơn hàng gần nhất của chính user (yêu cầu xác thực).
3. `getMyWalletBalance`: Tra cứu số dư ví tài khoản của chính user (yêu cầu xác thực).
4. `getActiveCoupons`: Tra cứu các mã giảm giá đang kích hoạt còn hạn.
5. `checkWarrantyPolicy`: Tra cứu chính sách bảo hành 1 đổi 1 và quy trình hỗ trợ.
6. `searchPromptsLibrary`: Tra cứu thư viện Prompt AI theo từ khóa và danh mục.
7. `getFaqsAndGuides`: Tra cứu câu hỏi thường gặp và hướng dẫn sử dụng.
8. `getSupportChannels`: Tra cứu Hotline, link Zalo Admin và fanpage Facebook.

---

## 2. RANH GIỚI AN TOÀN TUYỆT ĐỐI CỦA V1 (SAFETY BOUNDARIES)

* ❌ **Read-only 100%**: Tuyệt đối không thực hiện bất kỳ hành động ghi (*write/mutate*) hay thay đổi trạng thái Database.
* ❌ **No Autonomous Payment / Checkout**: Agent không tự động trừ tiền ví hay tạo đơn thanh toán tự động. Mọi giao dịch phải do người dùng tự thao tác tại UI Checkout.
* ❌ **No Refund Execution**: Agent không tự động hoàn tiền (*refund*).
* ❌ **No Account Modification**: Agent không thể đổi mật khẩu, email, số điện thoại hay cấu hình 2FA của user.
* ❌ **No Destructive Action**: Không có quyền xóa dữ liệu, hủy đơn hàng hay thao tác quản trị.
* ❌ **No Multi-step Autonomous Loop**: Không tự ý suy luận vòng lặp phức tạp ngoài tầm kiểm soát.

---

## 3. CÁC TÍNH NĂNG ĐƯỢC GIỮ LẠI CHO V2 / V3 (OUT OF SCOPE FOR V1)
* ⏳ **V2 — Guided Actions**: Tạo ticket hỗ trợ tự động có confirm, mở modal mua nhanh, apply coupon tự động theo intent.
* ⏳ **V3 — Advanced AI Agent**: So sánh sản phẩm đa chiều, RAG Vector Database, semantic embeddings, phân tích thói quen mua sắm.

---

## 4. ARCHITECTURE PIPELINE
```
USER QUERY / QUICK CHIP
        ↓
QUERY PREPROCESSOR & PARAMETER EXTRACTION
        ↓
DYNAMIC PRODUCT RESOLVER (Scoring & Ambiguity)
        ↓
DATABASE SUPABASE (Source of Truth)
        ↓
TOOL EXECUTION (Read-only + Permission Guard)
        ↓
STRUCTURED MARKDOWN RESPONSE
```
