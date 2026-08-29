import type { AgentContext } from './permissions';
import {
  searchProducts,
  getMyOrders,
  checkWarrantyPolicy,
  searchPromptsLibrary,
  getActiveCoupons,
  getMyWalletBalance,
  getFaqsAndGuides,
  getSupportChannels,
  type ProductItemResult,
} from './tools';
import { resolveProductQuery } from './productResolver';
import { resolveCategoryQuery, getAllCategories, type CategoryInfo } from './categoryResolver';

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
  data?: any;
  suggestions?: string[];
}

export type AgentIntent =
  | 'GET_ALL_CATALOG'
  | 'GET_CATEGORY_DETAIL'
  | 'SEARCH_PRODUCTS'
  | 'GET_MY_ORDERS'
  | 'GET_COUPONS'
  | 'GET_WALLET_BALANCE'
  | 'CHECK_WARRANTY'
  | 'SEARCH_PROMPTS'
  | 'GET_SUPPORT'
  | 'GET_FAQS'
  | 'GENERAL_QUERY';

/**
 * Phân loại ý định tổng quát từ câu hỏi
 */
function classifyIntent(text: string): AgentIntent {
  const lower = text.toLowerCase().trim();

  // 1. Xem danh mục tổng quan (Catalog Overview)
  if (
    lower === 'xem danh mục' ||
    lower === 'danh mục' ||
    lower === '🛍️ xem danh mục' ||
    lower === '🛍️ tất cả sản phẩm' ||
    lower === '🛍️ ← danh mục' ||
    lower === '← danh mục' ||
    lower === 'quay lại danh mục' ||
    lower === 'danh mục sản phẩm' ||
    lower === 'tất cả sản phẩm' ||
    lower === 'toàn bộ sản phẩm' ||
    lower.includes('shop có bán những gì') ||
    lower.includes('có những sản phẩm nào') ||
    lower.includes('shop có những gì') ||
    lower.includes('bảng giá tổng hợp')
  ) {
    return 'GET_ALL_CATALOG';
  }

  // 2. Đơn hàng
  if (
    lower.includes('đơn hàng') ||
    lower.includes('order') ||
    lower.includes('mã đơn') ||
    lower.includes('bow-') ||
    lower.includes('trạng thái đơn') ||
    lower.includes('kiểm tra đơn') ||
    lower.includes('đơn gần nhất') ||
    lower.includes('đã mua')
  ) {
    return 'GET_MY_ORDERS';
  }

  // 3. Số dư ví & Nạp tiền
  if (
    lower.includes('số dư') ||
    lower.includes('ví') ||
    lower.includes('nạp tiền') ||
    lower.includes('tiền trong tài khoản') ||
    lower.includes('ví của tôi') ||
    lower.includes('còn bao nhiêu')
  ) {
    return 'GET_WALLET_BALANCE';
  }

  // 4. Mã giảm giá / Coupon / Voucher
  if (
    lower.includes('mã giảm giá') ||
    lower.includes('coupon') ||
    lower.includes('voucher') ||
    lower.includes('khuyến mãi') ||
    lower.includes('sale') ||
    lower.includes('giảm giá') ||
    lower.includes('ưu đãi')
  ) {
    return 'GET_COUPONS';
  }

  // 5. Chính sách bảo hành & Đổi trả
  if (
    lower.includes('bảo hành') ||
    lower.includes('lỗi') ||
    lower.includes('đổi trả') ||
    lower.includes('chính sách') ||
    lower.includes('bị khóa') ||
    lower.includes('không vào được') ||
    lower.includes('hoàn tiền')
  ) {
    return 'CHECK_WARRANTY';
  }

  // 6. Thư viện Prompt AI
  if (
    lower.includes('prompt') ||
    lower.includes('câu lệnh') ||
    lower.includes('midjourney') ||
    lower.includes('tạo ảnh') ||
    lower.includes('viết content') ||
    lower.includes('thư viện prompt')
  ) {
    return 'SEARCH_PROMPTS';
  }

  // 7. Kênh liên hệ / Hotline / Hỗ trợ trực tiếp
  if (
    lower.includes('liên hệ') ||
    lower.includes('hotline') ||
    lower.includes('zalo') ||
    lower.includes('facebook') ||
    lower.includes('gặp admin') ||
    lower.includes('sđt') ||
    lower.includes('điện thoại') ||
    lower.includes('hỗ trợ viên')
  ) {
    return 'GET_SUPPORT';
  }

  // 8. FAQs & Hướng dẫn sử dụng
  if (
    lower.includes('hướng dẫn') ||
    lower.includes('cách kích hoạt') ||
    lower.includes('cách dùng') ||
    lower.includes('làm sao để') ||
    lower.includes('faq') ||
    lower.includes('câu hỏi')
  ) {
    return 'GET_FAQS';
  }

  return 'SEARCH_PRODUCTS';
}

/**
 * Format câu trả lời sản phẩm chi tiết có hỗ trợ lọc Plan theo yêu cầu
 */
function formatSingleProductResponse(
  product: ProductItemResult,
  durationFilter?: string,
  isCheapest?: boolean
): string {
  const badgeText = product.badge ? ` \`[${product.badge}]\`` : '';
  let msg = `🛍️ **Thông tin gói ${product.name}${badgeText} tại Shop of BOW:**\n\n`;

  if (product.tagline) {
    msg += `*${product.tagline}*\n\n`;
  }

  // Nếu người dùng hỏi thời hạn cụ thể (VD: "gói 1 tháng")
  if (durationFilter && product.plans.length > 0) {
    const matchedPlan = product.plans.find(
      (pl) => pl.duration.toLowerCase().includes(durationFilter.toLowerCase()) || pl.name.toLowerCase().includes(durationFilter.toLowerCase())
    );

    if (matchedPlan) {
      const originalText = matchedPlan.originalPrice && matchedPlan.originalPrice > matchedPlan.price
        ? ` (Giá gốc: ~${matchedPlan.originalPrice.toLocaleString('vi-VN')}đ~)`
        : '';
      msg += `🎯 **Gói ${matchedPlan.name} (${matchedPlan.duration}):** **${matchedPlan.price.toLocaleString('vi-VN')}đ**${originalText}\n\n`;
    }
  }

  // Nếu người dùng hỏi gói rẻ nhất
  if (isCheapest && product.plans.length > 0) {
    const cheapestPlan = [...product.plans].sort((a, b) => a.price - b.price)[0];
    msg += `💡 **Gói tiết kiệm nhất:** **${cheapestPlan.name} (${cheapestPlan.duration})** chỉ từ **${cheapestPlan.price.toLocaleString('vi-VN')}đ**\n\n`;
  }

  // Hiển thị đầy đủ các gói
  if (product.plans && product.plans.length > 0) {
    msg += `📋 **Bảng giá tất cả các gói:**\n`;
    product.plans.forEach((pl) => {
      const highlightTag = pl.isHighlight ? ' ⭐ *Bán chạy nhất*' : '';
      const originalText = pl.originalPrice && pl.originalPrice > pl.price ? ` ~${pl.originalPrice.toLocaleString('vi-VN')}đ~` : '';
      const durationText = pl.duration ? ` (${pl.duration})` : '';
      msg += `  • **${pl.name}**${durationText}: **${pl.price.toLocaleString('vi-VN')}đ**${originalText}${highlightTag}\n`;
    });
    msg += `\n`;
  } else {
    const priceStr = product.startingPrice > 0 ? `${product.startingPrice.toLocaleString('vi-VN')}đ` : 'Liên hệ';
    msg += `💰 Giá chỉ từ: **${priceStr}**\n\n`;
  }

  if (product.features && product.features.length > 0) {
    msg += `✨ **Tính năng nổi bật:** ${product.features.slice(0, 4).join(' • ')}\n\n`;
  }

  msg += `🛡️ **Chính sách:** ${product.warranty}\n`;
  msg += `👉 [Xem chi tiết & Mua ngay](/products/${product.slug || product.id})\n`;

  return msg;
}

/**
 * Format Catalog Overview: Tổng quan các danh mục, không dump chi tiết từng sản phẩm
 */
async function formatCatalogOverviewResponse(products: ProductItemResult[]): Promise<{ content: string; suggestions: string[] }> {
  const dbCategories = await getAllCategories();

  // Đếm số lượng sản phẩm theo từng category_id
  const catCountMap = new Map<string, number>();
  let unassignedCount = 0;

  products.forEach((p) => {
    if (p.categoryId) {
      catCountMap.set(p.categoryId, (catCountMap.get(p.categoryId) || 0) + 1);
    } else {
      unassignedCount++;
    }
  });

  let msg = `🏪 **Shop of BOW**\n\n`;
  msg += `Hiện tại shop đang cung cấp **${products.length} sản phẩm** phân bổ trong **${dbCategories.length} danh mục**:\n\n`;

  const suggestions: string[] = [];

  dbCategories.forEach((cat) => {
    const count = catCountMap.get(cat.id) || 0;
    const icon = cat.slug === 'ai-tools' ? '🤖' : cat.slug === 'premium-apps' ? '🎨' : '⭐';
    msg += `${icon} **${cat.name}** · ${count} sản phẩm\n`;
    suggestions.push(`${icon} ${cat.name}`);
  });

  if (unassignedCount > 0) {
    msg += `📁 **Sản phẩm khác** · ${unassignedCount} sản phẩm\n`;
  }

  msg += `\nBạn muốn xem danh mục nào? Hãy chọn danh mục bên dưới nhé! ✨`;

  return {
    content: msg,
    suggestions: suggestions.slice(0, 4),
  };
}

/**
 * Format Category Detail: Chi tiết 1 danh mục với tối đa 5 sản phẩm đầu tiên
 */
function formatCategoryDetailResponse(category: CategoryInfo, products: ProductItemResult[]): { content: string; suggestions: string[] } {
  const topProducts = products.slice(0, 5);
  const remainingCount = products.length - topProducts.length;
  const icon = category.slug === 'ai-tools' ? '🤖' : category.slug === 'premium-apps' ? '🎨' : '⭐';

  let msg = `${icon} **${category.name}**\n\n`;
  msg += `**${products.length} sản phẩm** trong danh mục:\n\n`;

  topProducts.forEach((p) => {
    const priceStr = p.startingPrice > 0 ? `từ **${p.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
    msg += `• **${p.name}** — ${priceStr}\n`;
    msg += `  👉 [Xem gói ${p.name}](/products/${p.slug || p.id})\n`;
  });

  if (remainingCount > 0) {
    msg += `\n👉 [Xem tất cả ${products.length} sản phẩm trên website](/products?category=${category.slug})\n`;
  }

  msg += `\n💡 *Gõ tên sản phẩm để xem bảng giá chi tiết từng gói nhé!*`;

  const suggestions = topProducts.slice(0, 3).map((p) => p.name);
  suggestions.push('🛍️ ← Danh mục');

  return { content: msg, suggestions };
}

/**
 * Định dạng danh sách đơn hàng nhỏ gọn, phân biệt rõ Product Order vs Nạp ví và hỗ trợ Deep-link chính xác
 */
function formatCompactOrdersResponse(
  rawOrders: any[],
  queryText: string
): { content: string; suggestions: string[] } {
  const lower = queryText.toLowerCase();

  let filtered = [...rawOrders];
  let title = '📦 **Đơn hàng gần đây của bạn:**';

  if (lower.includes('hoàn tiền') || lower.includes('refund')) {
    filtered = filtered.filter((o) => o.status === 'refunded');
    title = '💸 **Các đơn hàng đã hoàn tiền:**';
  } else if (lower.includes('hoàn thành') || lower.includes('đã giao') || lower.includes('thành công')) {
    filtered = filtered.filter((o) => o.status === 'completed');
    title = '✅ **Các đơn hàng đã hoàn thành:**';
  } else if (lower.includes('chờ thanh toán') || lower.includes('chưa thanh toán')) {
    filtered = filtered.filter((o) => o.status === 'pending_payment');
    title = '⏳ **Đơn hàng đang chờ thanh toán:**';
  } else {
    const productKeywords = ['capcut', 'canva', 'chatgpt', 'netflix', 'youtube', 'spotify', 'figma', 'claude', 'gemini', 'autodesk', 'adobe'];
    const matchedKw = productKeywords.find((kw) => lower.includes(kw));
    if (matchedKw) {
      filtered = filtered.filter((o) => (o.product_name || '').toLowerCase().includes(matchedKw));
      title = `📦 **Đơn hàng ${matchedKw.toUpperCase()} gần đây:**`;
    }
  }

  if (filtered.length === 0) {
    return {
      content: `📦 **Không tìm thấy đơn hàng nào phù hợp với yêu cầu của bạn.**\n\nBạn có thể [Xem toàn bộ lịch sử đơn hàng](/dashboard?tab=orders) hoặc tra cứu gói sản phẩm mới nhé! ✨`,
      suggestions: ['📦 Xem tất cả đơn', '🛍️ Xem danh mục', '💳 Số dư ví'],
    };
  }

  const isFullRequest = lower.includes('tất cả') || lower.includes('toàn bộ') || lower.includes('đầy đủ') || lower.includes('hết') || lower.includes('6 đơn');
  const isSingleLatest = lower.includes('gần nhất') && !lower.includes('các') && !lower.includes('những') && !lower.includes('3 đơn') && !lower.includes('danh sách');
  const displayLimit = isFullRequest ? 8 : isSingleLatest ? 1 : 3;
  const displayOrders = filtered.slice(0, displayLimit);
  const remainingCount = filtered.length - displayOrders.length;

  const statusMap: Record<string, string> = {
    completed: '✅ Đã hoàn thành',
    processing: '🟡 Đang xử lý',
    pending_delivery: '📦 Chờ bàn giao',
    pending_payment: '⏳ Chờ thanh toán',
    cancelled: '❌ Đã hủy',
    refunded: '💸 Đã hoàn tiền',
  };

  let msg = `${title}\n\n`;

  displayOrders.forEach((o) => {
    const isWallet = (o.product_name || '').toLowerCase().includes('nạp tiền') || (o.product_name || '').toLowerCase().includes('nạp ví');
    const statusText = statusMap[o.status] || o.status;
    const priceNum = Number(o.price || 0);

    if (isWallet) {
      msg += `💰 **Nạp tiền vào ví**\n`;
      msg += `   ${statusText} · **+${priceNum.toLocaleString('vi-VN')}đ**\n`;
      msg += `   👉 [Xem giao dịch ví →](/dashboard?tab=wallet)\n\n`;
    } else {
      const icon = (o.product_name || '').toLowerCase().includes('capcut')
        ? '🎬'
        : (o.product_name || '').toLowerCase().includes('netflix') || (o.product_name || '').toLowerCase().includes('youtube')
        ? '🍿'
        : (o.product_name || '').toLowerCase().includes('canva') || (o.product_name || '').toLowerCase().includes('figma')
        ? '🎨'
        : (o.product_name || '').toLowerCase().includes('gpt') || (o.product_name || '').toLowerCase().includes('ai')
        ? '🤖'
        : '📦';

      const planText = o.plan_label ? `${o.plan_label} · ` : '';
      msg += `${icon} **${o.product_name}**\n`;
      msg += `   ${planText}${statusText} · **${priceNum.toLocaleString('vi-VN')}đ**\n`;
      msg += `   👉 [Xem chi tiết →](/dashboard?tab=orders&order_id=${o.id})\n\n`;
    }
  });

  if (remainingCount > 0 && !isFullRequest) {
    msg += `👉 [Xem thêm ${remainingCount} đơn hàng khác trong Quản lý Đơn](/dashboard?tab=orders)\n`;
  }

  const suggestions = isFullRequest
    ? ['💳 Số dư ví', '🛍️ Xem danh mục', '🛡️ Chính sách bảo hành']
    : ['📦 Xem tất cả đơn', '💳 Số dư ví', '🛡️ Chính sách bảo hành'];

  return { content: msg, suggestions };
}

/**
 * Xử lý tin nhắn của người dùng và điều phối Tool Execution
 */
export async function processAgentMessage(
  userText: string,
  context: AgentContext
): Promise<AgentMessage> {
  const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const timestamp = new Date().toISOString();
  const intent = classifyIntent(userText);

  // Observability Log
  console.log('[BOW Agent Execution]', {
    userInput: userText,
    classifiedIntent: intent,
    userRole: context.role,
    isAuthenticated: context.isAuthenticated,
  });

  // 1. STATE 1: CATALOG OVERVIEW (Chỉ hiển thị tổng quan danh mục, DỪNG FLOW)
  if (intent === 'GET_ALL_CATALOG') {
    const prodRes = await searchProducts({});
    const products = prodRes.data || [];
    const overview = await formatCatalogOverviewResponse(products);

    return {
      id,
      sender: 'agent',
      content: overview.content,
      timestamp,
      data: { type: 'catalog_overview', products },
      suggestions: overview.suggestions,
    };
  }

  // 2. STATE 2: CATEGORY DETAIL (Kiểm tra xem câu hỏi có match Category hay không)
  const categoryMatch = await resolveCategoryQuery(userText);
  if (categoryMatch.matched && categoryMatch.category) {
    const cat = categoryMatch.category;
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

  // 3. EXECUTE: GET_MY_ORDERS (Tối ưu hóa gọn gàng, hỗ trợ lọc và Deep-link)
  if (intent === 'GET_MY_ORDERS') {
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

    return {
      id,
      sender: 'agent',
      content: compactRes.content,
      timestamp,
      data: { type: 'orders', orders },
      suggestions: compactRes.suggestions,
    };
  }

  // 4. EXECUTE: GET_WALLET_BALANCE
  if (intent === 'GET_WALLET_BALANCE') {
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

    return {
      id,
      sender: 'agent',
      content: `💳 **Số dư ví hiện tại của bạn:** **${balStr}**\n\nBạn có thể dùng số dư ví để thanh toán tự động, mua tài khoản tức thì tại Shop of BOW! 🚀\n\n👉 [Nạp thêm tiền vào ví ngay](/dashboard?tab=wallet)`,
      timestamp,
      suggestions: ['Nạp tiền vào ví', '🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
    };
  }

  // 5. EXECUTE: GET_COUPONS
  if (intent === 'GET_COUPONS') {
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

    let msg = `🎉 **Danh sách Mã Giảm Giá đang áp dụng tại Shop of BOW:**\n\n`;
    coupons.forEach((c: any) => {
      const discountText = c.discount_type === 'percentage' ? `Giảm ${c.discount_value}%` : `Giảm ${Number(c.discount_value).toLocaleString('vi-VN')}đ`;
      msg += `🎟️ Mã: \`${c.code}\` — **${discountText}**\n`;
      if (c.name) msg += `   *${c.name}*\n`;
      if (c.minimum_order_amount && c.minimum_order_amount > 0) {
        msg += `   - Đơn tối thiểu: ${Number(c.minimum_order_amount).toLocaleString('vi-VN')}đ\n`;
      }
      msg += `\n`;
    });

    msg += `💡 *Nhập mã này tại bước thanh toán để được giảm giá tự động nhé!*`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'coupons', coupons },
      suggestions: ['🛍️ Xem danh mục', 'Kiểm tra bảo hành'],
    };
  }

  // 6. EXECUTE: CHECK_WARRANTY
  if (intent === 'CHECK_WARRANTY') {
    const res = await checkWarrantyPolicy({ productName: userText });
    const policy = res.data;

    let msg = `🛡️ **Chính Sách Bảo Hành Cao Cấp tại Shop of BOW:**\n\n`;
    msg += `✅ **Cam kết 1 ĐỔI 1 hoặc HOÀN TIỀN** tương ứng với thời gian chưa sử dụng nếu phát sinh bất kỳ lỗi kỹ thuật nào từ nhà cung cấp.\n`;
    msg += `⏱️ **Thời gian xử lý:** Từ 5 - 30 phút (Hỗ trợ 24/7).\n\n`;
    msg += `**Quy trình nhận bảo hành siêu nhanh:**\n`;
    policy.warrantySteps.forEach((s: string) => {
      msg += `${s}\n`;
    });
    msg += `\n💬 Cần hỗ trợ gấp? Nhắn ngay [Zalo Admin](https://zalo.me/0966821315)!`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: ['Xem đơn hàng của tôi', 'Gặp hỗ trợ viên', '🛍️ Xem danh mục'],
    };
  }

  // 7. EXECUTE: SEARCH_PROMPTS
  if (intent === 'SEARCH_PROMPTS') {
    const cleanKw = userText.replace(/prompt|câu lệnh|tìm|gợi ý|thư viện/gi, '').trim();
    const res = await searchPromptsLibrary({ query: cleanKw });
    const prompts = res.data || [];

    if (prompts.length > 0) {
      let msg = `⚡ **Thư viện Prompt AI chất lượng cao từ Shop of BOW:**\n\n`;
      prompts.slice(0, 4).forEach((p: any) => {
        msg += `✨ **${p.title}** (${p.category || 'AI'})\n`;
        if (p.description) msg += `   *${p.description}*\n`;
        msg += `   👉 [Xem & Sao chép Prompt](/prompts/${p.id})\n\n`;
      });
      msg += `Khám phá thêm hàng trăm prompt đỉnh cao tại [Kho Prompt AI](/prompts)!`;

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        data: { type: 'prompts', prompts },
        suggestions: ['Xem kho Prompt AI', 'Mã giảm giá hôm nay'],
      };
    }
  }

  // 8. EXECUTE: GET_SUPPORT
  if (intent === 'GET_SUPPORT') {
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

  // 9. EXECUTE: GET_FAQS
  if (intent === 'GET_FAQS') {
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

  // 10. STATE 3: DYNAMIC PRODUCT RESOLVER (Tra cứu Sản phẩm Động từ Database)
  const resolution = await resolveProductQuery(userText);

  // Case 10A: Ambiguous - Tìm thấy nhiều sản phẩm tương đương
  if (resolution.isAmbiguous && resolution.candidates.length > 1) {
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

  // Case 10B: Matched chính xác 1 sản phẩm (Product Detail)
  if (resolution.matched && resolution.candidate) {
    const content = formatSingleProductResponse(
      resolution.candidate,
      resolution.extractedParams.durationFilter,
      resolution.extractedParams.isCheapestQuery
    );

    return {
      id,
      sender: 'agent',
      content,
      timestamp,
      data: { type: 'product', product: resolution.candidate },
      suggestions: ['🛍️ ← Danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
    };
  }

  // Case 10C: Không tìm thấy sản phẩm cụ thể
  return {
    id,
    sender: 'agent',
    content: `🔎 **Mình chưa tìm thấy sản phẩm phù hợp với từ khóa "${userText}".**\n\nBạn có thể thử tìm kiếm các sản phẩm nổi bật:\n• **CapCut Pro**\n• **ChatGPT Plus**\n• **Canva Pro**\n• **Netflix Premium**\n\nHoặc bấm **"🛍️ Xem danh mục"** để xem toàn bộ danh mục sản phẩm nhé! ✨`,
    timestamp,
    suggestions: ['CapCut Pro', 'ChatGPT Plus', 'Canva Pro', '🛍️ Xem danh mục'],
  };
}
