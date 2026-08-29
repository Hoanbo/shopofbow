# ✨ BOW AGENT V2 — GUIDED ACTIONS & INTERACTIVE WORKFLOWS

Phiên bản: **V2 (Guided Actions)**  
Kiến trúc: **5 Tầng Tách Bạch + Session Context Memory + Action Validation**

---

## 🎯 1. ĐỊNH VỊ V2 VÀ NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)

✨ **BOW AGENT V2 LÀ:**
- **Database-driven:** Dữ liệu hoàn toàn lấy từ Database, không tự bịa thông tin.
- **Rule-based:** Xử lý ý định (Intent) qua tập luật cứng, đảm bảo độ ổn định 100%.
- **Context-aware:** Lưu giữ bối cảnh đa lượt (Multi-turn Context) ngắn hạn.
- **Action-oriented:** Hỗ trợ điều hướng và mở luồng bằng Action Card.

🚫 **BOW AGENT V2 KHÔNG PHẢI LÀ:**
- **No LLM / Không AI bên thứ 3:** Không dùng OpenAI/Gemini để sinh ngôn ngữ tự nhiên.
- **Không autonomous (Không tự trị):** Mọi hành động đều phải do người dùng tự click xác nhận.
- **Không tự thanh toán:** Không tự ý trừ tiền tài khoản của khách.
- **Không tự refund:** Không tự ý hoàn tiền.
- **Không tự cấp tài khoản:** Không bypass luồng giao hàng bảo mật.
- **Không tự cộng wallet:** Chỉ mở popup hướng dẫn nạp, không thao tác Database trực tiếp.

* **V1**: Hiểu + Tra cứu dữ liệu thực tế từ Database (Read-only).
* **V2**: Hiểu + Tra cứu + **Đề xuất Hành động (Action Card UI)** + **Người dùng xác nhận** + **Mở đúng Workflow của Website**.

---

## 🏛️ 2. CẤU TRÚC KIẾN TRÚC MÃ NGUỒN

```
src/services/agent/
├── types.ts                  # Trung tâm toàn bộ Type Definitions (Intent, Action, Context...)
├── sessionContext.ts        # Quản lý bộ nhớ ngữ cảnh phiên hội thoại (TTL 45 phút)
├── intentResolver.ts        # Phân loại 10 Intent V2 có hiểu ngữ cảnh đa lượt
├── productResolver.ts       # Dynamic Product Resolver (Chấm điểm & Alias)
├── categoryResolver.ts      # Dynamic Category Resolver (Canonical ID/Slug)
├── actionPlanner.ts         # Bộ lập kế hoạch đề xuất hành động
├── actionValidator.ts       # Kiểm tra quyền sở hữu & tính toàn vẹn của Action
├── permissionGuard.ts       # Phân quyền Guest / Logged-in User
├── tools.ts                 # Tool Execution Layer
├── responseFormatter.ts     # Trình định dạng tin nhắn & Action Cards
├── agentEngine.ts           # Bộ điều phối chính (Orchestrator V2)
└── README.md                # Tài liệu kỹ thuật
```

---

## 🧩 3. GIAO THỨC HÀNH ĐỘNG (ACTION PROTOCOL)

| Action Type | Ý nghĩa nghiệp vụ | Giao diện kích hoạt |
|---|---|---|
| `NAVIGATE_CHECKOUT` | Mở trang / modal thanh toán mua nhanh | Mở `CheckoutModal` với đúng `productId` & `planId` |
| `NAVIGATE_ORDER_DETAIL` | Mở chi tiết đơn hàng đã mua | Mở `UserOrderDetailModal` |
| `NAVIGATE_RENEWAL` | Mở popup gia hạn đơn cũ kèm ưu đãi -10% | Mở `OrderRenewalModal` |
| `NAVIGATE_SUPPORT` | Mở form báo lỗi / yêu cầu bảo hành | Mở `CreateTicketModal` |
| `APPLY_COUPON` | Lưu mã giảm giá vào session thanh toán | Lưu vào `sessionStorage` tự động điền khi mua |
| `OPEN_DEPOSIT` | Mở giao diện nạp tiền vào ví | Mở modal VietQR nạp tiền tự động SePay |

---

## 🛡️ 4. NGUYÊN TẮC AN TOÀN VÀ BẢO TOÀN GIÁ (PRICE INTEGRITY)
1. **Giá hiển thị (Display-only)**: `displayPrice` trong payload chỉ để hiển thị trên UI. Luồng thanh toán của website luôn fetch lại giá gốc từ Database theo `planId` tại thời điểm tạo đơn.
2. **Quyền sở hữu (Ownership Protection)**: Khách vãng lai hoặc User A không thể mở đơn hay tạo ticket cho đơn hàng của User B.
3. **Chống Click Đúp (Anti Double-Click)**: Mỗi Action sinh ra kèm một `actionId` ngẫu nhiên và trạng thái khóa nút bấm trong lúc đang mở giao diện.
