import type { ProductItemResult, CategoryInfo } from './types';

/**
 * Format thông tin chi tiết sản phẩm và các plan
 */
export function formatSingleProductResponse(
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

  msg += `🛡️ **Chính sách:** ${product.warranty || 'Bảo hành 1 đổi 1 trọn thời gian sử dụng'}\n`;
  return msg;
}

/**
 * Format Catalog Overview
 */
export function formatCatalogOverviewResponse(
  products: ProductItemResult[],
  categories: CategoryInfo[]
): { content: string; suggestions: string[] } {
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
  msg += `Hiện tại shop đang cung cấp **${products.length} sản phẩm** phân bổ trong **${categories.length} danh mục**:\n\n`;

  const suggestions: string[] = [];

  categories.forEach((cat) => {
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
 * Format Category Detail
 */
export function formatCategoryDetailResponse(
  category: CategoryInfo,
  products: ProductItemResult[]
): { content: string; suggestions: string[] } {
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
 * Format Compact Orders Response
 */
export function formatCompactOrdersResponse(
  rawOrders: any[],
  queryText: string
): { content: string; suggestions: string[]; topOrder?: any } {
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

  return { content: msg, suggestions, topOrder: displayOrders[0] };
}
