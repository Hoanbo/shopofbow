import type { ProductItemResult, CategoryInfo } from './types';

/**
 * Format thông tin chi tiết sản phẩm và các plan
 */
export function formatSingleProductResponse(
  product: ProductItemResult,
  selectedPlan?: any
): string {
  const badgeText = product.badge ? ` \`[${product.badge}]\`` : '';
  let msg = `🛍️ **${product.name}**${badgeText}\n\n`;

  if (product.tagline) {
    msg += `${product.tagline}\n\n`;
  } else if (product.description) {
    const cleanDesc = product.description.replace(/\n+/g, ' ').slice(0, 140);
    msg += `${cleanDesc}...\n\n`;
  }

  if (selectedPlan) {
    const originalText = selectedPlan.originalPrice && selectedPlan.originalPrice > selectedPlan.price
      ? ` (Giá gốc: ~${selectedPlan.originalPrice.toLocaleString('vi-VN')}đ~)`
      : '';
    msg += `Bạn đang chọn: **${selectedPlan.name}** (${selectedPlan.duration}) — **${selectedPlan.price.toLocaleString('vi-VN')}đ**${originalText}\n\n`;
    msg += `Bấm nút **"Mua ngay"** bên dưới để mở giao diện thanh toán:`;
  } else if (product.plans && product.plans.length > 0) {
    msg += `📋 **Các gói cước hiện có:**\n`;
    product.plans.forEach((p) => {
      const orig = p.originalPrice && p.originalPrice > p.price ? ` ~(Gốc: ${p.originalPrice.toLocaleString('vi-VN')}đ)~` : '';
      msg += `• **${p.name || p.duration}** (${p.duration}) — **${p.price.toLocaleString('vi-VN')}đ**${orig}\n`;
    });
    msg += `\nChọn một trong các thẻ bên dưới để mua ngay nhé! 👇`;
  } else {
    const priceStr = product.startingPrice > 0 ? `từ **${product.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
    msg += `Giá: ${priceStr}\n`;
  }

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

  let msg = `🛍️ **Shop of BOW hiện đang có ${products.length} sản phẩm bản quyền:**\n\n`;

  // 1. Phân loại theo danh mục
  if (categories.length > 0) {
    msg += `📂 **Danh mục sản phẩm:**\n`;
    categories.forEach((cat) => {
      const count = catCountMap.get(cat.id) || 0;
      const icon = cat.slug === 'ai-tools' ? '🤖' : cat.slug === 'premium-apps' ? '🎨' : '⭐';
      msg += `• ${icon} **${cat.name}** (${count} sản phẩm)\n`;
    });
    msg += `\n`;
  }

  // 2. Danh sách sản phẩm tiêu biểu từ Database
  const displayProducts = products.filter((p) => p.startingPrice > 0).slice(0, 8);
  if (displayProducts.length > 0) {
    msg += `✨ **Một số sản phẩm tiêu biểu:**\n`;
    displayProducts.forEach((p) => {
      msg += `• **${p.name}** — từ ${p.startingPrice.toLocaleString('vi-VN')}đ\n`;
    });
  }

  if (products.length > displayProducts.length) {
    msg += `\n*...cùng nhiều gói tài khoản bản quyền khác.*\n`;
  }

  msg += `\nBạn muốn xem chi tiết sản phẩm nào hoặc chọn danh mục bên dưới nhé! 👇`;

  const suggestions = categories.map((c) => c.name).slice(0, 3);
  if (!suggestions.includes('🎟️ Mã giảm giá')) {
    suggestions.push('🎟️ Mã giảm giá');
  }

  return {
    content: msg,
    suggestions,
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

  const categoryDisplayName =
    category.slug === 'products' || category.name === 'Featured Products'
      ? 'Sản phẩm Nổi bật & Bán chạy nhất'
      : category.name;

  let msg = `${icon} **${categoryDisplayName}**\n\n`;
  msg += `Danh sách **${products.length} sản phẩm** nổi bật trong nhóm này:\n\n`;

  topProducts.forEach((p) => {
    const priceStr = p.startingPrice > 0 ? `từ **${p.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
    msg += `• **${p.name}** — ${priceStr}\n`;
  });

  if (remainingCount > 0) {
    msg += `\n[Xem tất cả ${products.length} sản phẩm trên website](/products?category=${category.slug})\n`;
  }

  msg += `\n*Gõ tên sản phẩm để xem bảng giá chi tiết từng gói nhé!*`;

  const suggestions = topProducts.slice(0, 3).map((p) => p.name);
  suggestions.push('Xem danh mục');

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
    // Dynamic matching dựa trên tên sản phẩm thực tế trong các đơn hàng
    const matchingOrder = rawOrders.find((o) => {
      const prodName = (o.product_name || '').toLowerCase();
      if (!prodName) return false;
      if (lower.includes(prodName)) return true;
      const tokens = prodName.split(/\s+/).filter((t: string) => t.length > 2);
      return tokens.some((t: string) => lower.includes(t));
    });

    if (matchingOrder) {
      const targetName = matchingOrder.product_name;
      filtered = filtered.filter((o) => (o.product_name || '').toLowerCase().includes(targetName.toLowerCase()));
      title = `📦 **Đơn hàng ${targetName} gần đây:**`;
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
