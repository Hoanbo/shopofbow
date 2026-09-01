import { supabase } from '../../lib/supabase';
import type { AgentContext, ProductItemResult, PlanItemResult } from './types';
import { checkToolPermission } from './permissions';

const isDev = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV);

export type { ProductItemResult, PlanItemResult };
export type ProductPlanResult = PlanItemResult;

export interface ToolExecutionResult<T = any> {
  success: boolean;
  toolName: string;
  data?: T;
  message?: string;
}

/**
 * 1. Tool tra cứu danh mục & giá sản phẩm thực tế từ database
 */
export async function searchProducts(params: { keyword?: string; type?: string; categoryId?: string; productId?: string; limit?: number }): Promise<ToolExecutionResult<ProductItemResult[]>> {
  try {
    let query = supabase
      .from('products')
      .select(`
        id, name, slug, type, category_id, short_description, description, logo_url, badge, base_price, is_active, sort_order, search_aliases,
        categories (id, name, slug, icon),
        product_plans (id, name, duration, price, original_price, is_highlight, is_active, sort_order, short_description),
        product_features (feature, sort_order)
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (params.productId) {
      query = query.eq('id', params.productId);
    }

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.type) {
      query = query.eq('type', params.type as any);
    }

    if (params.keyword && params.keyword.trim().length > 0) {
      const kw = params.keyword.trim();
      query = query.or(`name.ilike.%${kw}%,slug.ilike.%${kw}%,short_description.ilike.%${kw}%`);
    }

    const { data, error } = await query.limit(params.limit || 50);
    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] searchProducts:', error);
      }
      throw error;
    }

    const formatted: ProductItemResult[] = (data || []).map((p: any) => {
      const activePlans = (p.product_plans || [])
        .filter((pl: any) => pl.is_active !== false)
        .sort((a: any, b: any) => a.sort_order - b.sort_order || a.price - b.price);

      const minPrice = activePlans.length > 0 ? activePlans[0].price : Number(p.base_price || 0);
      const features = (p.product_features || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((f: any) => f.feature);

      const catName = p.categories?.name || (p.type === 'ai-tool' ? 'Công cụ AI' : p.type === 'premium-app' ? 'Ứng dụng Bản quyền' : 'Sản phẩm khác');

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type || 'product',
        categoryId: p.category_id || null,
        categoryName: catName,
        badge: p.badge || null,
        tagline: p.short_description || null,
        description: p.description || p.short_description || null,
        logoUrl: p.logo_url || null,
        startingPrice: minPrice,
        plans: activePlans.map((pl: any) => ({
          id: pl.id,
          name: pl.name,
          duration: pl.duration || '',
          price: Number(pl.price || 0),
          originalPrice: pl.original_price != null ? Number(pl.original_price) : null,
          isHighlight: !!pl.is_highlight,
          shortDescription: pl.short_description || null,
        })),
        features: features.length > 0 ? features : undefined,
        warranty: 'Bảo hành 1 đổi 1 trọn thời gian sử dụng',
        searchAliases: Array.isArray(p.search_aliases) ? p.search_aliases : [],
      };
    });

    return {
      success: true,
      toolName: 'searchProducts',
      data: formatted,
    };
  } catch (err: any) {
    return { success: false, toolName: 'searchProducts', message: err.message || 'Lỗi truy vấn sản phẩm.' };
  }
}

/**
 * 2. Tool tra cứu đơn hàng của chính khách hàng hiện tại
 */
export async function getMyOrders(
  params: { paymentCode?: string; status?: string; productName?: string; limit?: number },
  context: AgentContext
): Promise<ToolExecutionResult<any[]>> {
  const perm = checkToolPermission('getMyOrders', context);
  if (!perm.allowed) {
    return { success: false, toolName: 'getMyOrders', message: perm.reason };
  }

  try {
    let query = supabase
      .from('orders')
      .select('id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes, account_details')
      .eq('user_id', context.userId!)
      .order('created_at', { ascending: false })
      .limit(params.limit || 12);

    if (params.paymentCode) {
      query = query.ilike('payment_code', `%${params.paymentCode.trim()}%`);
    }
    if (params.status) {
      query = query.eq('status', params.status as any);
    }
    if (params.productName) {
      query = query.ilike('product_name', `%${params.productName.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] getMyOrders:', error);
      }
      throw error;
    }

    return {
      success: true,
      toolName: 'getMyOrders',
      data: data || [],
    };
  } catch (err: any) {
    return { success: false, toolName: 'getMyOrders', message: err.message || 'Lỗi truy vấn đơn hàng.' };
  }
}

/**
 * 3. Tool tra cứu chính sách bảo hành
 */
export async function checkWarrantyPolicy(params: { productName?: string }): Promise<ToolExecutionResult<any>> {
  return {
    success: true,
    toolName: 'checkWarrantyPolicy',
    data: {
      standardPolicy: 'Tất cả tài khoản & phần mềm tại Shop of BOW đều được BẢO HÀNH 1 ĐỔI 1 hoặc HOÀN TIỀN tương ứng với thời gian chưa sử dụng nếu phát sinh lỗi kỹ thuật từ nhà cung cấp.',
      responseTime: 'Hỗ trợ xử lý bảo hành trong vòng 5 - 30 phút (Hỗ trợ 24/7).',
      warrantySteps: [
        '1. Đăng nhập và truy cập trang Đơn hàng của tôi (dashboard)',
        '2. Chọn đơn hàng bị sự cố và xem thông tin tài khoản',
        '3. Bấm "Yêu cầu hỗ trợ" hoặc nhắn tin trực tiếp qua Zalo Admin kèm Mã thanh toán (VD: BOW-XXXXX)',
      ],
      productMentioned: params.productName || 'Tất cả sản phẩm',
    },
  };
}

/**
 * 4. Tool tra cứu thư viện Prompt AI
 */
export async function searchPromptsLibrary(params: { query?: string; category?: string }): Promise<ToolExecutionResult<any[]>> {
  try {
    let query = supabase
      .from('ai_prompts')
      .select('id, title, category, prompt_content, image_url, description, tags, copy_count')
      .order('created_at', { ascending: false })
      .limit(6);

    if (params.query && params.query.trim().length > 0) {
      query = query.or(`title.ilike.%${params.query.trim()}%,description.ilike.%${params.query.trim()}%,prompt_content.ilike.%${params.query.trim()}%`);
    }
    if (params.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;
    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] searchPromptsLibrary:', error);
      }
      throw error;
    }

    return {
      success: true,
      toolName: 'searchPromptsLibrary',
      data: data || [],
    };
  } catch (err: any) {
    return { success: false, toolName: 'searchPromptsLibrary', message: err.message || 'Lỗi truy vấn thư viện prompt.' };
  }
}

/**
 * 5. Tool tra cứu mã giảm giá đang kích hoạt
 */
export async function getActiveCoupons(): Promise<ToolExecutionResult<any[]>> {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('code, name, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount, is_active, expires_at')
      .eq('is_active', true)
      .limit(6);

    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] getActiveCoupons:', error);
      }
      throw error;
    }

    const now = new Date();
    const validCoupons = (data || []).filter((c: any) => {
      if (!c.expires_at) return true;
      return new Date(c.expires_at) > now;
    });

    return {
      success: true,
      toolName: 'getActiveCoupons',
      data: validCoupons,
    };
  } catch (err: any) {
    return { success: false, toolName: 'getActiveCoupons', message: err.message || 'Lỗi tra cứu mã giảm giá.' };
  }
}

/**
 * 6. Tool tra cứu số dư ví của khách hàng
 */
export async function getMyWalletBalance(context: AgentContext): Promise<ToolExecutionResult<{ balance: number; formatted: string }>> {
  const perm = checkToolPermission('getMyWalletBalance', context);
  if (!perm.allowed) {
    return { success: false, toolName: 'getMyWalletBalance', message: perm.reason };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', context.userId!)
      .single();

    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] getMyWalletBalance:', error);
      }
      throw error;
    }

    const bal = Number(data?.balance || 0);
    return {
      success: true,
      toolName: 'getMyWalletBalance',
      data: {
        balance: bal,
        formatted: `${bal.toLocaleString('vi-VN')}đ`,
      },
    };
  } catch (err: any) {
    return { success: false, toolName: 'getMyWalletBalance', message: err.message || 'Lỗi tra cứu số dư ví.' };
  }
}

/**
 * 7. Tool tra cứu FAQs & Hướng dẫn sử dụng
 */
export async function getFaqsAndGuides(params: { query?: string }): Promise<ToolExecutionResult<any[]>> {
  try {
    let query = supabase.from('faqs').select('id, question, answer, sort_order').order('sort_order', { ascending: true }).limit(6);
    if (params.query && params.query.trim().length > 0) {
      query = query.or(`question.ilike.%${params.query.trim()}%,answer.ilike.%${params.query.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] getFaqsAndGuides:', error);
      }
      throw error;
    }

    return {
      success: true,
      toolName: 'getFaqsAndGuides',
      data: data || [],
    };
  } catch (err: any) {
    return { success: false, toolName: 'getFaqsAndGuides', message: err.message || 'Lỗi tra cứu FAQ.' };
  }
}

/**
 * 8. Tool tra cứu thông tin hỗ trợ trực tiếp
 */
export async function getSupportChannels(): Promise<ToolExecutionResult<any>> {
  try {
    const { data } = await supabase
      .from('contact_settings')
      .select('facebook_url, zalo_url, support_phone, support_email')
      .limit(1)
      .maybeSingle();

    const hotline = data?.support_phone || '0966 821 315';
    const zalo = data?.zalo_url || 'https://zalo.me/0966821315';
    const fb = data?.facebook_url || 'https://www.facebook.com/Bobowcon';

    return {
      success: true,
      toolName: 'getSupportChannels',
      data: {
        brand: 'Shop of BOW',
        hotline,
        zalo,
        facebook: fb,
        hours: 'Hỗ trợ 24/7 (Phản hồi nhanh nhất: 8h00 - 23h30 hàng ngày)',
      },
    };
  } catch {
    return {
      success: true,
      toolName: 'getSupportChannels',
      data: {
        brand: 'Shop of BOW',
        hotline: '0966 821 315',
        zalo: 'https://zalo.me/0966821315',
        facebook: 'https://www.facebook.com/Bobowcon',
        hours: 'Hỗ trợ 24/7 (Phản hồi nhanh nhất: 8h00 - 23h30 hàng ngày)',
      },
    };
  }
}

/**
 * 9. Tool tra cứu Phiếu hỗ trợ (Ticket) của khách hàng
 */
export async function getMyTickets(
  params: { status?: string; limit?: number },
  context: AgentContext
): Promise<ToolExecutionResult<any[]>> {
  const perm = checkToolPermission('getMyTickets', context);
  if (!perm.allowed) {
    return { success: false, toolName: 'getMyTickets', message: perm.reason };
  }

  try {
    let query = (supabase as any)
      .from('support_tickets')
      .select('id, ticket_number, subject, status, priority, created_at, updated_at, order_id, orders:orders(product_name, plan_label, payment_code)')
      .eq('user_id', context.userId!)
      .order('updated_at', { ascending: false })
      .limit(params.limit || 6);

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) {
      if (isDev) {
        console.error('[BOW Agent Tool Error] getMyTickets:', error);
      }
      throw error;
    }

    return {
      success: true,
      toolName: 'getMyTickets',
      data: data || [],
    };
  } catch (err: any) {
    return { success: false, toolName: 'getMyTickets', message: err.message || 'Lỗi tra cứu ticket hỗ trợ.' };
  }
}
