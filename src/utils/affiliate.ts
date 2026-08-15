/**
 * src/utils/affiliate.ts — Tiện ích quản lý Tiếp thị liên kết & Phân cấp Giá Sỉ CTV
 */

const REF_STORAGE_KEY = 'bow_referral_code';
const REF_EXPIRY_KEY = 'bow_referral_expiry';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Lưu mã giới thiệu vào localStorage với thời hạn 30 ngày */
export function storeReferralCode(code: string): void {
  if (!code || typeof code !== 'string') return;
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 3 || cleanCode.length > 30) return;

  try {
    localStorage.setItem(REF_STORAGE_KEY, cleanCode);
    localStorage.setItem(REF_EXPIRY_KEY, String(Date.now() + THIRTY_DAYS_MS));
  } catch (err) {
    console.warn('[affiliate] Could not save referral code:', err);
  }
}

/** Lấy mã giới thiệu đang lưu (nếu còn hạn 30 ngày) */
export function getStoredReferralCode(): string | null {
  try {
    const code = localStorage.getItem(REF_STORAGE_KEY);
    const expiry = localStorage.getItem(REF_EXPIRY_KEY);
    if (!code || !expiry) return null;

    if (Date.now() > Number(expiry)) {
      localStorage.removeItem(REF_STORAGE_KEY);
      localStorage.removeItem(REF_EXPIRY_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/** Xóa mã giới thiệu đã lưu */
export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REF_STORAGE_KEY);
    localStorage.removeItem(REF_EXPIRY_KEY);
  } catch {}
}

/** Tự động quét tham số ?ref=... hoặc ?r=... từ URL hiện tại */
export function captureReferralFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('r');
    if (ref) {
      storeReferralCode(ref);
      return ref.trim().toUpperCase();
    }
  } catch {}
  return getStoredReferralCode();
}

/** Tạo đường dẫn chia sẻ có gắn mã giới thiệu */
export function generateReferralLink(referralCode: string, pathname = '/'): string {
  const origin = window.location.origin;
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${cleanPath}?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Lấy đơn giá thực tế của sản phẩm tùy theo Role của người dùng (Khách lẻ hoặc CTV Sỉ)
 */
export function getEffectivePrice(
  retailPrice: number,
  ctvPrice: number | null | undefined,
  userRole?: string
): number {
  if (userRole === 'ctv' && ctvPrice != null && ctvPrice > 0) {
    return Number(ctvPrice);
  }
  return Number(retailPrice);
}

/**
 * Tính số tiền giảm giá chào mừng cho đơn hàng đầu tiên
 */
export function calculateFirstOrderDiscount(
  product: {
    affiliate_enabled?: boolean;
    affiliateEnabled?: boolean;
    affiliate_type?: string;
    affiliateType?: string;
    affiliate_discount?: number;
    affiliateDiscount?: number;
  },
  basePrice: number,
  isFirstOrder = true
): number {
  if (!isFirstOrder) return 0;
  const isEnabled = product.affiliate_enabled ?? product.affiliateEnabled ?? true;
  if (isEnabled === false) return 0;
  const discountVal = Number(product.affiliate_discount ?? product.affiliateDiscount) || 0;
  if (discountVal <= 0) return 0;

  const type = product.affiliate_type ?? product.affiliateType ?? 'fixed';
  if (type === 'percent') {
    return Math.min(Math.round(basePrice * (discountVal / 100)), basePrice);
  }
  return Math.min(discountVal, basePrice);
}

/**
 * Tính số tiền hoa hồng mà người giới thiệu sẽ nhận được
 * (Khóa không tính hoa hồng nếu đơn hàng mua bằng Giá Sỉ CTV hoặc không có người giới thiệu)
 */
export function calculateAffiliateReward(
  product: {
    affiliate_enabled?: boolean;
    affiliateEnabled?: boolean;
    affiliate_type?: string;
    affiliateType?: string;
    affiliate_reward?: number;
    affiliateReward?: number;
  },
  finalPrice: number,
  isCtvPurchase = false,
  hasReferrer = true
): number {
  if (isCtvPurchase) return 0; // CTV mua sỉ -> Không tính hoa hồng
  if (!hasReferrer) return 0; // Không có người giới thiệu
  const isEnabled = product.affiliate_enabled ?? product.affiliateEnabled ?? true;
  if (isEnabled === false) return 0;

  const rewardVal = Number(product.affiliate_reward ?? product.affiliateReward) || 0;
  if (rewardVal <= 0) return 0;

  const type = product.affiliate_type ?? product.affiliateType ?? 'fixed';
  if (type === 'percent') {
    return Math.round(finalPrice * (rewardVal / 100));
  }
  return rewardVal;
}
