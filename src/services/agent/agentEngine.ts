import type { AgentContext, AgentMessage } from './types';
import { resolveIntent } from './intentResolver';
import { resolveProductQuery } from './productResolver';
import { resolveCategoryQuery, getAllCategories } from './categoryResolver';
import {
  getSessionContext,
  rememberProductContext,
  rememberOrderContext,
  rememberCategoryContext,
  clearSessionContext,
} from './sessionContext';
import {
  planCheckoutAction,
  planRenewalAction,
  planSupportTicketAction,
  planApplyCouponAction,
  planDepositAction,
  planOrderDetailAction,
  planMultipleCheckoutActions,
} from './actionPlanner';
import {
  formatSingleProductResponse,
  formatCatalogOverviewResponse,
  formatCategoryDetailResponse,
  formatCompactOrdersResponse,
} from './responseFormatter';
import {
  searchProducts,
  getMyOrders,
  checkWarrantyPolicy,
  getActiveCoupons,
  getMyWalletBalance,
  getFaqsAndGuides,
  getSupportChannels,
} from './tools';

import { agentAnalytics } from './monitoring/agentAnalytics';

export * from './types';

/**
 * Xử lý tin nhắn của người dùng và điều phối Tool Execution + Action Planning V2
 */
export async function processAgentMessage(
  userText: string,
  context: AgentContext
): Promise<AgentMessage> {
  const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const timestamp = new Date().toISOString();
  let sessionCtx = getSessionContext();

  // --------------------------------------------------------------------------
  // 0. MESSAGE_RECEIVED
  // --------------------------------------------------------------------------
  agentAnalytics.track({
    eventType: 'MESSAGE_RECEIVED',
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
    metadata: { query: userText }
  });

  const lowerText = userText.toLowerCase();
  const resetKeywords = ['reset', 'làm mới', 'bắt đầu lại', 'xóa ngữ cảnh', 'đổi chủ đề', 'bỏ qua cái trên', 'thôi'];
  if (resetKeywords.some(kw => lowerText.includes(kw))) {
    clearSessionContext();
    sessionCtx = getSessionContext();
    
    agentAnalytics.track({
      eventType: 'SESSION_RESET',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });

    return {
      id,
      sender: 'agent',
      content: `🔄 Mình đã làm mới cuộc hội thoại.\n\nBạn cần hỗ trợ tìm sản phẩm, xem bảng giá hay tra cứu đơn hàng nào?`,
      timestamp,
      suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng'],
    };
  }

  // 1. Phân loại Intent có hiểu ngữ cảnh
  let intent = resolveIntent(userText);

  agentAnalytics.track({
    eventType: 'INTENT_RESOLVED',
    intent,
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
  });

  // Observability Log
  console.log('[BOW Agent V2 Engine]', {
    userInput: userText,
    classifiedIntent: intent,
    sessionContext: {
      hasProduct: !!sessionCtx.lastMentionedProduct,
      hasOrder: !!sessionCtx.lastMentionedOrder,
      hasCategory: !!sessionCtx.lastMentionedCategory,
    },
    userRole: context.role,
    isAuthenticated: context.isAuthenticated,
  });

  // --------------------------------------------------------------------------
  // 1. INTENT: CATALOG (Xem tổng quan danh mục sản phẩm)
  // --------------------------------------------------------------------------
  if (intent === 'CATALOG') {
    const [prodRes, categories] = await Promise.all([
      searchProducts({}),
      getAllCategories(),
    ]);
    const products = prodRes.data || [];
    const overview = formatCatalogOverviewResponse(products, categories);

    return {
      id,
      sender: 'agent',
      content: overview.content,
      timestamp,
      data: { type: 'catalog_overview', products },
      suggestions: overview.suggestions,
    };
  }

  // --------------------------------------------------------------------------
  // 2. INTENT: VIEW_CATEGORY (Kiểm tra xem câu hỏi có khớp Category hay không)
  // --------------------------------------------------------------------------
  const categoryMatch = await resolveCategoryQuery(userText);
  if (categoryMatch.matched && categoryMatch.category) {
    const cat = categoryMatch.category;
    rememberCategoryContext(cat);
    const prodRes = await searchProducts({ categoryId: cat.id });
    const products = prodRes.data || [];
    const formatted = formatCategoryDetailResponse(cat, products);

    return {
      id,
      sender: 'agent',
      content: formatted.content,
      timestamp,
      data: { type: 'category_detail', categoryId: cat.id, products },
      suggestions: formatted.suggestions,
    };
  }

  // --------------------------------------------------------------------------
  // 3. INTENT: BUY (Mua hàng trực tiếp kèm Action Card)
  // --------------------------------------------------------------------------
  if (intent === 'BUY') {
    const resolution = await resolveProductQuery(userText);
    let productToBuy = resolution.candidate;
    let planToBuy = undefined;

    if (!productToBuy && sessionCtx.lastMentionedProduct) {
      productToBuy = sessionCtx.lastMentionedProduct;
    }

    if (productToBuy) {
      agentAnalytics.track({
        eventType: 'PRODUCT_RESOLVED',
        intent,
        productId: productToBuy.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      const lower = userText.toLowerCase();
      // Lấy danh sách các gói đang active
      let activePlans = productToBuy.plans || [];

      // Lọc gói khác nếu yêu cầu
      if (resolution.extractedParams.isOtherPlanQuery && sessionCtx.lastMentionedPlan) {
        activePlans = activePlans.filter(p => p.id !== sessionCtx.lastMentionedPlan!.id);
      }

      // Nhận diện Plan dựa trên từ khóa
      if (resolution.extractedParams.durationFilter) {
        planToBuy = activePlans.find((p) => p.duration.toLowerCase().includes(resolution.extractedParams.durationFilter!.toLowerCase()) || p.name.toLowerCase().includes(resolution.extractedParams.durationFilter!.toLowerCase()));
      } else if (lower.includes('1 năm') || lower.includes('12 tháng') || lower.includes('năm')) {
        planToBuy = activePlans.find((p) => p.duration.includes('1 năm') || p.name.includes('1 năm') || p.duration.includes('12 tháng'));
      } else if (lower.includes('6 tháng') || lower.includes('nửa năm')) {
        planToBuy = activePlans.find((p) => p.duration.includes('6 tháng') || p.name.includes('6 tháng'));
      } else if (lower.includes('3 tháng')) {
        planToBuy = activePlans.find((p) => p.duration.includes('3 tháng') || p.name.includes('3 tháng'));
      } else if (lower.includes('1 tháng') || lower.includes('30 ngày')) {
        planToBuy = activePlans.find((p) => p.duration.includes('1 tháng') || p.name.includes('1 tháng'));
      } else if (lower.includes('1 tuần') || lower.includes('tuần') || lower.includes('7 ngày')) {
        planToBuy = activePlans.find((p) => p.duration.includes('1 tuần') || p.duration.includes('7') || p.name.includes('1 tuần'));
      } else if (lower.includes('tháng')) {
        planToBuy = activePlans.find((p) => p.duration.includes('1 tháng') || p.name.includes('1 tháng'));
      }

      if (!planToBuy && resolution.extractedParams.isCheapestQuery && activePlans.length > 0) {
        planToBuy = [...activePlans].sort((a, b) => a.price - b.price)[0];
      }
      if (!planToBuy && resolution.extractedParams.isMostExpensiveQuery && activePlans.length > 0) {
        planToBuy = [...activePlans].sort((a, b) => b.price - a.price)[0];
      }

      if (!planToBuy && sessionCtx.lastMentionedPlan && !resolution.extractedParams.isOtherPlanQuery) {
        // Kiểm tra xem lastMentionedPlan có thuộc product này không
        if (activePlans.some(p => p.id === sessionCtx.lastMentionedPlan!.id)) {
          planToBuy = sessionCtx.lastMentionedPlan;
        }
      }

      // Xử lý Global Rule PRODUCT != PLAN
      if (!planToBuy) {
        if (activePlans.length === 1) {
          planToBuy = activePlans[0];
        } else if (activePlans.length === 0) {
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Sản phẩm ${productToBuy.name} hiện tại chưa có gói dịch vụ nào khả dụng.**\n\nBạn vui lòng quay lại sau hoặc tham khảo các sản phẩm khác nhé!`,
            timestamp,
            suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
          };
        } else {
          // Có nhiều Plan -> Yêu cầu người dùng chọn
          agentAnalytics.track({
            eventType: 'PLAN_UNRESOLVED',
            intent,
            productId: productToBuy.id,
            reason: 'MULTIPLE_PLANS_AVAILABLE',
            sessionId: sessionCtx.updatedAt.toString(),
            userId: context.userId,
          });
          agentAnalytics.track({
            eventType: 'CLARIFICATION_REQUESTED',
            intent,
            productId: productToBuy.id,
            reason: 'MULTIPLE_PLANS_AVAILABLE',
            sessionId: sessionCtx.updatedAt.toString(),
            userId: context.userId,
          });

          rememberProductContext(productToBuy, undefined);
          const multipleActions = planMultipleCheckoutActions(productToBuy, activePlans, context);
          let msg = `🎬 **Sản phẩm ${productToBuy.name} có nhiều lựa chọn gói dịch vụ:**\n\n`;
          msg += `Bạn muốn chọn gói nào dưới đây? 👇`;
          
          return {
            id,
            sender: 'agent',
            content: msg,
            timestamp,
            data: { type: 'buy_checkout_selection', product: productToBuy },
            actions: multipleActions,
            suggestions: ['Gói rẻ nhất', 'Gói khác', '🛍️ Xem danh mục'],
          };
        }
      }

      // Đã có Product và Plan -> Sinh Quick Buy duy nhất
      agentAnalytics.track({
        eventType: 'PLAN_RESOLVED',
        intent,
        productId: productToBuy.id,
        planId: planToBuy.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      rememberProductContext(productToBuy, planToBuy);
      const action = planCheckoutAction(productToBuy, planToBuy, context);

      const priceText = `**${planToBuy.price.toLocaleString('vi-VN')}đ**`;
      const planNameText = ` (${planToBuy.name})`;

      let msg = `🎬 **Bạn đang chọn mua gói ${productToBuy.name}${planNameText}**\n\n`;
      msg += `💰 Mức giá thanh toán: ${priceText}\n`;
      msg += `🛡️ Bảo hành 1 đổi 1 trong suốt thời gian sử dụng dịch vụ.\n\n`;
      msg += `Bấm nút **"${action?.label || '💳 Mua ngay'}"** bên dưới để mở giao diện thanh toán và nhận tài khoản ngay nhé! ✨`;

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        data: { type: 'buy_checkout', product: productToBuy, plan: planToBuy },
        action: action || undefined,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
      };
    } else {
      // Intent BUY nhưng không có Product nào được nhắc tới
      agentAnalytics.track({
        eventType: 'PRODUCT_UNRESOLVED',
        intent,
        reason: 'PRODUCT_NOT_FOUND',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      return {
        id,
        sender: 'agent',
        content: `🤔 **Bạn muốn mua sản phẩm/gói nào?**\n\nBạn có thể nhập tên sản phẩm hoặc chọn từ danh mục bên dưới để mình kiểm tra giá nhé.`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'ChatGPT Plus', 'CapCut Pro'],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. INTENT: RENEW (Gia hạn đơn hàng cũ)
  // --------------------------------------------------------------------------
  if (intent === 'RENEW') {
    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để gia hạn đơn hàng!**\n\nVui lòng [Đăng nhập](/login) để hệ thống kiểm tra các gói tài khoản đã mua của bạn nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục'],
      };
    }

    const res = await getMyOrders({ limit: 6 }, context);
    const orders = res.data || [];

    if (orders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `📦 **Bạn chưa có đơn hàng nào trước đây để gia hạn.**\n\nBạn có muốn mình tư vấn một số gói tài khoản hot đang có sẵn không? ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
      };
    }

    const targetOrder = sessionCtx.lastMentionedOrder || orders[0];
    rememberOrderContext(targetOrder);
    const action = planRenewalAction(targetOrder, context);

    let msg = `🔄 **Gia hạn đơn hàng: ${targetOrder.product_name} (${targetOrder.plan_label})**\n\n`;
    msg += `📦 Mã thanh toán: \`${targetOrder.payment_code}\`\n`;
    msg += `🎁 **Đặc quyền gia hạn:** Nhận ngay ưu đãi **giảm 10%** trừ trực tiếp vào số tiền thanh toán!\n\n`;
    msg += `Bấm **"Gia hạn ngay"** bên dưới để mở popup xác nhận gia hạn nhé! 🚀`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'order_renewal', order: targetOrder },
      action: action || undefined,
      suggestions: ['📦 Xem tất cả đơn', '💳 Số dư ví', '🛍️ Xem danh mục'],
    };
  }

  // --------------------------------------------------------------------------
  // 5. INTENT: WARRANTY (Hỗ trợ lỗi / Bảo hành)
  // --------------------------------------------------------------------------
  if (intent === 'WARRANTY') {
    if (context.isAuthenticated) {
      const res = await getMyOrders({ limit: 6 }, context);
      const orders = res.data || [];
      const relevantOrder = sessionCtx.lastMentionedOrder || orders[0];

      if (relevantOrder) {
        rememberOrderContext(relevantOrder);
        const action = planSupportTicketAction(relevantOrder, userText, context);

        let msg = `🛠️ **Hỗ trợ bảo hành dịch vụ ${relevantOrder.product_name}:**\n\n`;
        msg += `📦 Đơn hàng liên quan: **${relevantOrder.product_name}** (\`${relevantOrder.payment_code}\`)\n`;
        msg += `⏱️ **Thời gian xử lý:** Từ 5 - 30 phút (Kỹ thuật viên trực 24/7).\n\n`;
        msg += `Bạn có thể bấm **"Gửi yêu cầu bảo hành"** bên dưới để tạo phiếu hỗ trợ kỹ thuật tự động:`;

        return {
          id,
          sender: 'agent',
          content: msg,
          timestamp,
          data: { type: 'warranty_ticket', order: relevantOrder },
          action: action || undefined,
          suggestions: ['Gặp hỗ trợ viên Zalo', '📦 Xem tất cả đơn', 'Chính sách bảo hành'],
        };
      }
    }

    // Khách chưa đăng nhập hoặc chưa có đơn: Hiển thị quy trình bảo hành
    const res = await checkWarrantyPolicy({ productName: userText });
    const policy = res.data;

    let msg = `🛡️ **Chính Sách Bảo Hành Cao Cấp tại Shop of BOW:**\n\n`;
    msg += `✅ **Cam kết 1 ĐỔI 1 hoặc HOÀN TIỀN** nếu phát sinh bất kỳ lỗi kỹ thuật nào từ nhà cung cấp.\n`;
    msg += `⏱️ **Thời gian xử lý:** Từ 5 - 30 phút (Hỗ trợ 24/7).\n\n`;
    msg += `**Quy trình nhận bảo hành:**\n`;
    policy.warrantySteps.forEach((s: string) => {
      msg += `${s}\n`;
    });
    msg += `\n💬 Nhắn ngay [Zalo Admin](https://zalo.me/0966821315) để được hỗ trợ tức thì!`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: ['Đăng nhập để bảo hành', 'Gặp hỗ trợ viên', '🛍️ Xem danh mục'],
    };
  }

  // --------------------------------------------------------------------------
  // 6. INTENT: ORDER_QUERY (Tra cứu đơn hàng)
  // --------------------------------------------------------------------------
  if (intent === 'ORDER_QUERY') {
    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để kiểm tra đơn hàng của mình!**\n\nĐể bảo mật thông tin tài khoản và mã bàn giao dịch vụ, bạn vui lòng [Đăng nhập](/login) trước nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục', 'Chính sách bảo hành'],
      };
    }

    const codeMatch = userText.match(/bow-[\w\d]+/i);
    const paymentCode = codeMatch ? codeMatch[0] : undefined;

    const res = await getMyOrders({ paymentCode, limit: 12 }, context);
    if (!res.success) {
      return {
        id,
        sender: 'agent',
        content: `⚠️ **Mình chưa thể tải lịch sử đơn hàng lúc này.**\n\nBạn vui lòng thử lại sau ít phút hoặc mở [Quản lý Đơn hàng](/dashboard?tab=orders) nhé!`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }

    const orders = res.data || [];
    if (orders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `📦 **Bạn chưa có đơn hàng nào trong hệ thống.**\n\nBạn có thể [Xem danh mục sản phẩm](/products) để chọn gói tài khoản phù hợp nhé! ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
      };
    }

    const compactRes = formatCompactOrdersResponse(orders, userText);
    let orderAction = undefined;
    if (compactRes.topOrder) {
      rememberOrderContext(compactRes.topOrder);
      orderAction = planOrderDetailAction(compactRes.topOrder, context);
    }

    return {
      id,
      sender: 'agent',
      content: compactRes.content,
      timestamp,
      data: { type: 'orders', orders },
      action: orderAction || undefined,
      suggestions: compactRes.suggestions,
    };
  }

  // --------------------------------------------------------------------------
  // 7. INTENT: WALLET (Số dư & Nạp tiền)
  // --------------------------------------------------------------------------
  if (intent === 'WALLET') {
    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `💳 **Bạn cần đăng nhập để kiểm tra số dư ví!**\n\nVui lòng [Đăng nhập](/login) để xem số dư và nạp tiền tự động 1-Click nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục'],
      };
    }

    const res = await getMyWalletBalance(context);
    const balStr = res.data?.formatted || '0đ';

    // Bắt số tiền nếu người dùng nói "nạp 100k", "nạp 50000"
    const amountMatch = userText.match(/(\d+)\s*(k|nghìn|ngàn|tr|triệu|đ|vnd)?/i);
    let plannedDepositAmount = 50000;
    if (amountMatch) {
      const num = parseInt(amountMatch[1], 10);
      const unit = (amountMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
        plannedDepositAmount = num * 1000;
      } else if (unit === 'tr' || unit === 'triệu') {
        plannedDepositAmount = num * 1000000;
      } else if (num >= 10000) {
        plannedDepositAmount = num;
      }
    }

    const action = planDepositAction(plannedDepositAmount, context);

    return {
      id,
      sender: 'agent',
      content: `💳 **Số dư ví hiện tại của bạn:** **${balStr}**\n\nBạn có thể dùng số dư ví để thanh toán tức thì tại Shop of BOW! Bấm nút bên dưới để mở giao diện nạp tiền tự động qua VietQR:`,
      timestamp,
      action: action || undefined,
      suggestions: ['Nạp 50.000đ', 'Nạp 100.000đ', 'Nạp 200.000đ', '🛍️ Xem danh mục'],
    };
  }

  // --------------------------------------------------------------------------
  // 8. INTENT: COUPON (Mã giảm giá & Áp dụng)
  // --------------------------------------------------------------------------
  if (intent === 'COUPON') {
    const res = await getActiveCoupons();
    const coupons = res.data || [];

    if (coupons.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `🎟️ Hiện tại hệ thống đang áp dụng **Mức giá ưu đãi trực tiếp** trên từng sản phẩm. Đừng quên theo dõi fanpage để cập nhật voucher sự kiện mới nhất nhé! 🎁`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }

    const topCoupon = coupons[0];
    const discountText = topCoupon.discount_type === 'percentage'
      ? `Giảm ${topCoupon.discount_value}%`
      : `Giảm ${Number(topCoupon.discount_value).toLocaleString('vi-VN')}đ`;

    const action = planApplyCouponAction(topCoupon.code, discountText, context);

    let msg = `🎉 **Danh sách Mã Giảm Giá đang áp dụng tại Shop of BOW:**\n\n`;
    coupons.forEach((c: any) => {
      const disc = c.discount_type === 'percentage' ? `Giảm ${c.discount_value}%` : `Giảm ${Number(c.discount_value).toLocaleString('vi-VN')}đ`;
      msg += `🎟️ Mã: \`${c.code}\` — **${disc}**\n`;
      if (c.name) msg += `   *${c.name}*\n`;
      if (c.minimum_order_amount && c.minimum_order_amount > 0) {
        msg += `   - Đơn tối thiểu: ${Number(c.minimum_order_amount).toLocaleString('vi-VN')}đ\n`;
      }
      msg += `\n`;
    });

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'coupons', coupons },
      action: action || undefined,
      suggestions: ['🛍️ Xem danh mục', 'Kiểm tra bảo hành'],
    };
  }

  // --------------------------------------------------------------------------
  // 9. INTENT: FAQ (Câu hỏi & Hướng dẫn)
  // --------------------------------------------------------------------------
  if (intent === 'FAQ') {
    const res = await getFaqsAndGuides({ query: userText.replace(/hướng dẫn|cách dùng|kích hoạt|faq/gi, '').trim() });
    const faqs = res.data || [];

    if (faqs.length > 0) {
      let msg = `❓ **Câu hỏi & Hướng dẫn sử dụng tại Shop of BOW:**\n\n`;
      faqs.slice(0, 3).forEach((f: any) => {
        msg += `📌 **Q: ${f.question}**\n`;
        msg += `💡 A: ${f.answer}\n\n`;
      });

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        suggestions: ['Gặp hỗ trợ viên', '🛍️ Xem danh mục', 'Chính sách bảo hành'],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 10. INTENT: GENERAL (Liên hệ hỗ trợ viên)
  // --------------------------------------------------------------------------
  if (intent === 'GENERAL') {
    const res = await getSupportChannels();
    const sc = res.data;

    let msg = `📞 **Kênh Hỗ Trợ Trực Tiếp của ${sc.brand}:**\n\n`;
    msg += `💬 **Zalo Hỗ Trợ:** [Nhắn Zalo Ngay](${sc.zalo}) (\`${sc.hotline}\`)\n`;
    msg += `📱 **Hotline:** \`${sc.hotline}\`\n`;
    msg += `🌐 **Fanpage Facebook:** [Bobowcon](${sc.facebook})\n`;
    msg += `⏰ **Thời gian hoạt động:** ${sc.hours}\n\n`;
    msg += `Đội ngũ kỹ thuật viên của BOW luôn sẵn sàng hỗ trợ bạn! ✨`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: ['🛍️ Xem danh mục', 'Kiểm tra đơn hàng', 'Mã giảm giá'],
    };
  }

  // --------------------------------------------------------------------------
  // 11. INTENT: PRODUCT_SEARCH (Tra cứu sản phẩm động từ Database)
  // --------------------------------------------------------------------------
  const resolution = await resolveProductQuery(userText);

  // Case 11A: Ambiguous - Tìm thấy nhiều sản phẩm tương đương
  if (resolution.isAmbiguous && resolution.candidates.length > 1) {
    agentAnalytics.track({
      eventType: 'PRODUCT_UNRESOLVED',
      intent,
      reason: 'AMBIGUOUS_PRODUCT',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });
    agentAnalytics.track({
      eventType: 'CLARIFICATION_REQUESTED',
      intent,
      reason: 'AMBIGUOUS_PRODUCT',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });

    let msg = `🔍 ${resolution.ambiguityMessage || 'Mình tìm thấy một số lựa chọn phù hợp:'}\n\n`;
    resolution.candidates.forEach((c) => {
      const priceStr = c.startingPrice > 0 ? `từ **${c.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
      msg += `• **${c.name}** — Giá: ${priceStr}\n`;
      msg += `  👉 [Xem gói ${c.name}](/products/${c.slug || c.id})\n`;
    });

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'ambiguous_products', candidates: resolution.candidates },
      suggestions: resolution.candidates.slice(0, 3).map((c) => c.name),
    };
  }

  // Case 11B: Matched chính xác 1 sản phẩm (Product Detail + Sinh Action Card Quick Buy)
  if (resolution.matched && resolution.candidate) {
    const product = resolution.candidate;

    agentAnalytics.track({
      eventType: 'PRODUCT_RESOLVED',
      intent,
      productId: product.id,
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });

    let selectedPlan = undefined;
    
    let activePlans = product.plans || [];

    // Lọc gói khác nếu yêu cầu
    if (resolution.extractedParams.isOtherPlanQuery && sessionCtx.lastMentionedPlan) {
      activePlans = activePlans.filter(p => p.id !== sessionCtx.lastMentionedPlan!.id);
    }

    if (resolution.extractedParams.durationFilter) {
      selectedPlan = activePlans.find(
        (pl) => pl.duration.toLowerCase().includes(resolution.extractedParams.durationFilter!.toLowerCase()) ||
                pl.name.toLowerCase().includes(resolution.extractedParams.durationFilter!.toLowerCase())
      );
    } else if (resolution.extractedParams.isCheapestQuery && activePlans.length > 0) {
      selectedPlan = [...activePlans].sort((a, b) => a.price - b.price)[0];
    } else if (resolution.extractedParams.isMostExpensiveQuery && activePlans.length > 0) {
      selectedPlan = [...activePlans].sort((a, b) => b.price - a.price)[0];
    }
    
    // Nếu chỉ có 1 plan duy nhất, tự chọn
    if (!selectedPlan && activePlans.length === 1) {
      selectedPlan = activePlans[0];
    }

    rememberProductContext(product, selectedPlan);
    let singleAction = undefined;
    let multipleActions = undefined;

    // Nếu đã chốt plan (hoặc mua luôn + đã có plan), tạo 1 Action
    if (selectedPlan) {
      singleAction = planCheckoutAction(product, selectedPlan, context) || undefined;
      agentAnalytics.track({
        eventType: 'PLAN_RESOLVED',
        intent,
        productId: product.id,
        planId: selectedPlan.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
    } else if (activePlans.length > 1) {
      // Nếu có nhiều plan, tạo nhiều Action Card
      multipleActions = planMultipleCheckoutActions(product, activePlans, context);
      agentAnalytics.track({
        eventType: 'PLAN_UNRESOLVED',
        intent,
        productId: product.id,
        reason: 'MULTIPLE_PLANS_AVAILABLE',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
      agentAnalytics.track({
        eventType: 'CLARIFICATION_REQUESTED',
        intent,
        productId: product.id,
        reason: 'MULTIPLE_PLANS_AVAILABLE',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
    }

    const content = formatSingleProductResponse(
      product,
      resolution.extractedParams.durationFilter,
      resolution.extractedParams.isCheapestQuery
    );

    return {
      id,
      sender: 'agent',
      content,
      timestamp,
      data: { type: 'product', product },
      action: singleAction,
      actions: multipleActions,
      suggestions: ['🛍️ ← Danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
    };
  }

  // Case 11C: Không tìm thấy sản phẩm cụ thể
  agentAnalytics.track({
    eventType: 'PRODUCT_UNRESOLVED',
    intent,
    reason: 'PRODUCT_NOT_FOUND',
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
  });

  return {
    id,
    sender: 'agent',
    content: `🔎 **Mình chưa tìm thấy sản phẩm phù hợp với từ khóa "${userText}".**\n\nBạn có thể thử tìm kiếm các sản phẩm nổi bật:\n• **CapCut Pro**\n• **ChatGPT Plus**\n• **Canva Pro**\n• **Netflix Premium**\n\nHoặc bấm **"🛍️ Xem danh mục"** để xem toàn bộ danh mục sản phẩm nhé! ✨`,
    timestamp,
    suggestions: ['CapCut Pro', 'ChatGPT Plus', 'Canva Pro', '🛍️ Xem danh mục'],
  };
}
