import { supabase } from '../lib/supabase';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount_amount?: number | null;
  usage_limit?: number | null;
  used_count: number;
  per_user_limit: number;
  first_order_only: boolean;
  start_at: string;
  expires_at?: string | null;
  is_active: boolean;
  applies_to_all_products?: boolean;
  product_ids?: string[];
  coupon_products?: {
    product_id: string;
    products?: {
      id: string;
      name: string;
      slug: string;
      logo_url?: string;
    };
  }[];
  created_at: string;
  updated_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  user_id: string;
  order_id?: string | null;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  created_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
  orders?: {
    payment_code?: string;
    product_name?: string;
  };
}

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon_id?: string;
  code?: string;
  name?: string;
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  discount_amount?: number;
  original_amount?: number;
  final_amount?: number;
  applies_to_all_products?: boolean;
}

/**
 * Validate a coupon code server-side against an order amount, optional user id and optional product id
 */
export async function validateCouponCode(
  code: string,
  orderAmount: number,
  userId?: string,
  productId?: string
): Promise<CouponValidationResult> {
  try {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, message: 'Vui lòng nhập mã giảm giá.' };
    }

    const { data, error } = await (supabase as any).rpc('validate_coupon', {
      p_code: cleanCode,
      p_order_amount: orderAmount,
      p_user_id: userId || undefined,
      p_product_id: productId && productId.length === 36 ? productId : undefined,
    });

    if (error) {
      console.error('[validateCouponCode] RPC error:', error);
      return { valid: false, message: error.message || 'Lỗi kiểm tra mã giảm giá.' };
    }

    return data as CouponValidationResult;
  } catch (err: any) {
    console.error('[validateCouponCode] Exception:', err);
    return { valid: false, message: err?.message || 'Không thể kiểm tra mã giảm giá.' };
  }
}

/**
 * Check if the user is eligible for first order coupon (server-driven)
 */
export async function checkFirstOrderEligibility(userId: string): Promise<boolean> {
  try {
    const { count, error } = await (supabase.from('orders') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending_delivery', 'processing', 'completed']);

    if (error) {
      console.error('[checkFirstOrderEligibility] Error:', error);
      return false;
    }

    return (count ?? 0) === 0;
  } catch {
    return false;
  }
}

/**
 * Fetch active public coupons for auto-suggestion (e.g. WELCOME20)
 */
export async function fetchPublicSuggestedCoupons(): Promise<Coupon[]> {
  try {
    const { data, error } = await (supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return (data || []) as Coupon[];
  } catch (e) {
    console.error('Error fetching public coupons:', e);
    return [];
  }
}
