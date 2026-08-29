import { searchProducts, type ProductItemResult } from './tools';

export interface ProductResolutionResult {
  matched: boolean;
  confidence: number;
  matchType: 'exact_name' | 'exact_alias' | 'exact_slug' | 'prefix' | 'token_match' | 'fuzzy' | 'category' | 'none';
  candidate?: ProductItemResult;
  candidates: ProductItemResult[];
  isAmbiguous: boolean;
  ambiguityMessage?: string;
  extractedParams: {
    durationFilter?: string;
    isCheapestQuery?: boolean;
    isBestSellerQuery?: boolean;
    isMostExpensiveQuery?: boolean;
    isOtherPlanQuery?: boolean;
    isBuyNowQuery?: boolean;
    categoryFilter?: string;
  };
}

/**
 * Chuẩn hóa chuỗi tìm kiếm (xóa dấu câu, lowercase, trim)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[?!.,;:_/\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trích xuất parameter thời hạn và tiêu chí từ câu hỏi
 */
function extractQueryParameters(rawText: string) {
  const lower = rawText.toLowerCase();
  let durationFilter: string | undefined = undefined;

  if (lower.includes('1 năm') || lower.includes('12 tháng') || lower.includes('năm')) {
    durationFilter = '1 năm';
  } else if (lower.includes('6 tháng') || lower.includes('nửa năm')) {
    durationFilter = '6 tháng';
  } else if (lower.includes('3 tháng')) {
    durationFilter = '3 tháng';
  } else if (lower.includes('1 tháng') || lower.includes('30 ngày')) {
    durationFilter = '1 tháng';
  } else if (lower.includes('1 tuần') || lower.includes('7 ngày') || lower.includes('tuần')) {
    durationFilter = '1 tuần';
  } else if (lower.includes('vĩnh viễn') || lower.includes('lifetime')) {
    durationFilter = 'vĩnh viễn';
  } else if (lower.includes('tháng')) {
    durationFilter = '1 tháng';
  }

  const isCheapestQuery = lower.includes('rẻ nhất') || lower.includes('giá thấp nhất') || lower.includes('tiết kiệm') || lower.includes('cheapest');
  const isMostExpensiveQuery = lower.includes('đắt nhất') || lower.includes('giá cao nhất') || lower.includes('cao nhất') || lower.includes('most expensive');
  const isBestSellerQuery = lower.includes('bán chạy') || lower.includes('nhiều người mua') || lower.includes('phổ biến');
  const isOtherPlanQuery = lower.includes('gói khác') || lower.includes('lựa chọn khác') || lower.includes('tùy chọn khác') || lower.includes('option khác') || lower.includes('có gói nào khác') || lower.includes('còn gói nào khác');
  const isBuyNowQuery = lower.includes('mua luôn') || lower.includes('chốt') || lower.includes('lấy gói này') || lower.includes('thanh toán') || lower.includes('mua đi') || lower.includes('lấy luôn');

  return { durationFilter, isCheapestQuery, isBestSellerQuery, isMostExpensiveQuery, isOtherPlanQuery, isBuyNowQuery };
}

/**
 * Làm sạch câu hỏi loại bỏ stop-words tiếng Việt
 */
export function cleanQueryTokens(rawText: string): string {
  return rawText
    .toLowerCase()
    .replace(
      /xem bảng giá|bảng giá|báo giá|danh sách|tất cả sản phẩm|toàn bộ sản phẩm|sản phẩm|các gói|gói cước|gói|tài khoản|app|ứng dụng|mua bán|mua|bán|có bán không|có không|giá bao nhiêu|bao nhiêu tiền|hết bao nhiêu|bao nhiêu 1 tháng|bao nhiêu|cho tôi|mình muốn|tìm kiếm|tìm|hôm nay|shop|ad ơi|admin ơi|bạn ơi|tư vấn|kiểm tra thông tin|kiểm tra|chi tiết|chính hãng|bản quyền/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính khoảng cách Levenshtein đơn giản cho Typo Tolerance
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length < s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;

  const editDistance = (a: string, b: string): number => {
    const costs: number[] = [];
    for (let i = 0; i <= a.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= b.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (a.charAt(i - 1) !== b.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[b.length] = lastValue;
    }
    return costs[b.length];
  };

  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

/**
 * DYNAMIC PRODUCT RESOLVER: Phân giải ý định sản phẩm từ Database
 */
export async function resolveProductQuery(rawQuery: string): Promise<ProductResolutionResult> {
  const params = extractQueryParameters(rawQuery);
  const cleanTokens = cleanQueryTokens(rawQuery);
  const normClean = normalizeString(cleanTokens);
  const normRaw = normalizeString(rawQuery);

  // Lấy danh sách toàn bộ sản phẩm active từ DB
  const res = await searchProducts({});
  const allProducts = res.data || [];

  if (allProducts.length === 0 || (!normClean && !normRaw)) {
    return {
      matched: false,
      confidence: 0,
      matchType: 'none',
      candidates: allProducts,
      isAmbiguous: false,
      extractedParams: params,
    };
  }

  // Chấm điểm từng sản phẩm
  interface ScoredCandidate {
    product: ProductItemResult;
    score: number;
    matchType: ProductResolutionResult['matchType'];
  }

  const scored: ScoredCandidate[] = [];

  for (const p of allProducts) {
    const normName = normalizeString(p.name);
    const normSlug = normalizeString(p.slug);
    const aliases = (p.searchAliases || []).map((a) => normalizeString(a));

    let itemScore = 0;
    let itemMatchType: ProductResolutionResult['matchType'] = 'none';

    // 1. Exact Name Match (Score: 100)
    if (normClean === normName || normRaw === normName) {
      itemScore = 100;
      itemMatchType = 'exact_name';
    }
    // 2. Exact Alias Match (Score: 95)
    else if (aliases.some((a) => a === normClean || a === normRaw)) {
      itemScore = 95;
      itemMatchType = 'exact_alias';
    }
    // 3. Exact Slug Match (Score: 90)
    else if (normClean === normSlug || normRaw === normSlug) {
      itemScore = 90;
      itemMatchType = 'exact_slug';
    }
    // 4. Word-boundary / Prefix Inclusion (Score: 80-85)
    else if (
      normRaw.includes(normName) ||
      normName.includes(normClean) ||
      aliases.some((a) => normRaw.includes(a) || a.includes(normClean))
    ) {
      itemScore = 80;
      itemMatchType = 'prefix';
    }
    // 5. Token Match (Score: 65)
    else if (
      normClean.split(' ').some((tok) => tok.length >= 3 && (normName.includes(tok) || aliases.some((a) => a.includes(tok))))
    ) {
      itemScore = 65;
      itemMatchType = 'token_match';
    }
    // 6. Fuzzy / Typo Match (Score: 55-60)
    else if (normClean.length >= 4) {
      const nameSim = calculateSimilarity(normClean, normName);
      const aliasSim = aliases.length > 0 ? Math.max(...aliases.map((a) => calculateSimilarity(normClean, a))) : 0;
      const maxSim = Math.max(nameSim, aliasSim);

      if (maxSim >= 0.75) {
        itemScore = Math.round(maxSim * 70);
        itemMatchType = 'fuzzy';
      }
    }

    if (itemScore > 0) {
      scored.push({ product: p, score: itemScore, matchType: itemMatchType });
    }
  }

  // Sắp xếp điểm giảm dần
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      matched: false,
      confidence: 0,
      matchType: 'none',
      candidates: allProducts,
      isAmbiguous: false,
      extractedParams: params,
    };
  }

  const top = scored[0];

  // Kiểm tra Ambiguity (Nhiều candidate có điểm xấp xỉ nhau, vd: Canva Pro vs Canva Edu)
  const closeCandidates = scored.filter((s) => s.score >= top.score - 10 && s.score >= 65);
  if (closeCandidates.length > 1 && top.score < 95) {
    return {
      matched: true,
      confidence: top.score / 100,
      matchType: top.matchType,
      candidates: closeCandidates.map((c) => c.product),
      isAmbiguous: true,
      ambiguityMessage: `Mình tìm thấy nhiều gói liên quan đến **"${rawQuery}"**. Bạn muốn xem chi tiết gói nào?`,
      extractedParams: params,
    };
  }

  // Đã match chính xác 1 sản phẩm hàng đầu
  return {
    matched: true,
    confidence: top.score / 100,
    matchType: top.matchType,
    candidate: top.product,
    candidates: [top.product],
    isAmbiguous: false,
    extractedParams: params,
  };
}
