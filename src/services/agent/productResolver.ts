import { searchProducts, type ProductItemResult } from './tools';

// =========================================================================
// BOW Agent V2.2 — Product Resolver
// Pipeline: Exact → Alias → Slug → Prefix → Token → Fuzzy → Semantic
// =========================================================================

export interface ProductResolutionResult {
  matched: boolean;
  confidence: number;
  matchType: 'exact_name' | 'exact_alias' | 'exact_slug' | 'prefix' | 'token_match' | 'fuzzy' | 'semantic' | 'category' | 'none';
  candidate?: ProductItemResult;
  candidates: ProductItemResult[];
  isAmbiguous: boolean;
  ambiguityMessage?: string;
  // V2.2: semantic demand match — only populated when no exact/high-confidence match found
  semanticCandidates?: ProductItemResult[];
  semanticMatchQuery?: string;
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

import { extractDuration } from './intentResolver';

/**
 * Trích xuất parameter thời hạn và tiêu chí từ câu hỏi
 */
function extractQueryParameters(rawText: string) {
  const lower = rawText.toLowerCase();
  const durationFilter = extractDuration(rawText);

  const isCheapestQuery = lower.includes('rẻ nhất') || lower.includes('giá thấp nhất') || lower.includes('tiết kiệm') || lower.includes('cheapest');
  const isMostExpensiveQuery = lower.includes('đắt nhất') || lower.includes('giá cao nhất') || lower.includes('cao nhất') || lower.includes('most expensive');
  const isBestSellerQuery = lower.includes('bán chạy') || lower.includes('nhiều người mua') || lower.includes('phổ biến');
  const isOtherPlanQuery = lower.includes('gói khác') || lower.includes('lựa chọn khác') || lower.includes('tùy chọn khác') || lower.includes('option khác') || lower.includes('có gói nào khác') || lower.includes('còn gói nào khác');
  const isBuyNowQuery = lower.includes('mua luôn') || lower.includes('chốt') || lower.includes('lấy gói này') || lower.includes('thanh toán') || lower.includes('mua đi') || lower.includes('lấy luôn');

  return { durationFilter, isCheapestQuery, isBestSellerQuery, isMostExpensiveQuery, isOtherPlanQuery, isBuyNowQuery };
}

/**
 * Làm sạch câu hỏi loại bỏ stop-words tiếng Việt
 * Giữ lại: tên sản phẩm thực sự, keyword ngắn có nghĩa
 */
export function cleanQueryTokens(rawText: string): string {
  const cleaned = rawText
    .toLowerCase()
    .replace(
      /cho tôi xem|cho mình xem|cho xem|xem bảng giá|xem chi tiết|xem danh mục|xem giá|xem thông tin|bảng giá|báo giá|danh sách|tất cả sản phẩm|toàn bộ sản phẩm|1 sản phẩm|sản phẩm|các gói|gói cước|gói|tài khoản|ứng dụng|phần mềm|công cụ|dịch vụ|tool|app|mua bán|cần mua|cần tìm|cần dùng|tôi cần|mình cần|cần 1|muốn 1|tìm 1|\b1\b|cần|mua|bán|có bán không|có không|bạn đang có|bạn có|đang có|có những|có các|có gì|những gì|gì vậy|thế nào|thì sao|giá bao nhiêu|bao nhiêu tiền|hết bao nhiêu|bao nhiêu 1 tháng|bao nhiêu|cho tôi|cho mình|mình muốn|tôi muốn|tìm kiếm|tìm|hôm nay|bên mình có|bên shop có|bên bạn có|bên em có|bên mình|bên shop|bên bạn|bên em|shop|ad ơi|admin ơi|bạn ơi|bạn|tư vấn|kiểm tra thông tin|kiểm tra|chi tiết|chính hãng|bản quyền|show|coi|các|những|thế|nào|gì|ở đâu|đẻ|để|học tiếng anh|học ngoại ngữ|học tiếng|không|ko|\bk\b|ạ|dạ|nhỉ|hả|hử/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Plural markers are intent metadata, not semantic demand. Repeat the
  // cleanup on accent-stripped text so accented and unaccented Vietnamese
  // queries resolve identically.
  const noAccent = normalizeString(cleaned);
  const ignored = new Set([
    'co', 'nhung', 'cac', 'gi', 'nao', 'liet', 'ke', 'danh', 'sach',
    'thi', 'app', 'tool', 'phan', 'mem', 'cong', 'cu', 'dich', 'vu',
  ]);
  return noAccent.split(/\s+/).filter((token) => token && !ignored.has(token)).join(' ');
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

// =========================================================================
// V2.2 — Semantic Capability Matcher
// Scores a product based on how well its description/features/tagline/category
// match a set of demand tokens extracted from the user's natural language query.
// =========================================================================

/**
 * Tính semantic score cho một product dựa trên demand tokens.
 * Returns score 0-50. 0 = no match.
 * KHÔNG hard-code bất kỳ product name hoặc capability mapping.
 */
function scoreProductSemantics(
  product: ProductItemResult,
  demandTokens: string[]
): number {
  if (demandTokens.length === 0) return 0;

  // Build normalized search corpus from actual DB data
  const corpusParts: string[] = [];

  if (product.name) corpusParts.push(normalizeString(product.name));
  if (product.tagline) corpusParts.push(normalizeString(product.tagline));
  if (product.description) corpusParts.push(normalizeString(product.description));
  if (product.categoryName) corpusParts.push(normalizeString(product.categoryName));
  if (product.features && product.features.length > 0) {
    product.features.forEach((f) => corpusParts.push(normalizeString(f)));
  }
  // V3.3 Phase 4.2: Include searchAliases in semantic corpus
  // This allows enriched aliases (e.g. "xem phim" on Youku/TV360/YouTube) to participate in scoring
  if (product.searchAliases && product.searchAliases.length > 0) {
    product.searchAliases.forEach((a) => corpusParts.push(normalizeString(a)));
  }

  if (corpusParts.length === 0) return 0;


  const corpus = corpusParts.join(' ');
  const fullPhrase = normalizeString(demandTokens.join(' '));

  let matchedTokenCount = 0;
  let totalWeight = 0;

  for (const token of demandTokens) {
    const normToken = normalizeString(token);
    if (normToken.length < 2) continue;
    totalWeight++;

    // Use word-boundary match on corpus to avoid substring false positives
    const wordRegex = new RegExp(`\\b${normToken}\\b`, 'i');
    if (wordRegex.test(corpus)) {
      matchedTokenCount++;
    }
  }

  if (totalWeight === 0 || matchedTokenCount === 0) return 0;

  const ratio = matchedTokenCount / totalWeight;
  const hasFullPhrase = fullPhrase.length >= 4 && corpus.includes(fullPhrase);

  // Extract bigrams from demandTokens (e.g. "thoi tiet", "ha noi", "xem phim", "nghe nhac", "lam video", "tau vu tru")
  const bigrams: string[] = [];
  for (let i = 0; i < demandTokens.length - 1; i++) {
    const bg = normalizeString(`${demandTokens[i]} ${demandTokens[i + 1]}`);
    if (bg.length >= 4) bigrams.push(bg);
  }

  const genericBigrams = new Set(['quan ly', 'tim kiem', 'su dung', 'ho tro', 'dich vu', 'chuc nang', 'cai dat']);
  const matchedBigrams = bigrams.filter((bg) => corpus.includes(bg));
  const hasSpecificBigramMatch = matchedBigrams.some((bg) => !genericBigrams.has(bg));
  const hasBigramMatch = matchedBigrams.length > 0;

  // For multi-token queries with >= 3 tokens, require specific domain bigram or full phrase match
  if (totalWeight >= 3) {
    if (!hasFullPhrase && !hasSpecificBigramMatch) return 0;
    if (!hasFullPhrase && ratio < 0.5) return 0;
  }

  // For 2-token queries (e.g. "xem phim"), require both tokens or bigram/full phrase
  if (totalWeight === 2 && ratio < 1.0 && !hasBigramMatch && !hasFullPhrase) {
    return 0;
  }

  let score = Math.round(35 + ratio * 10);
  if (hasSpecificBigramMatch) score += 5;
  else if (hasBigramMatch) score += 2;
  if (hasFullPhrase) score += 5; // Bonus for exact phrase match

  return Math.min(50, score);
}

/**
 * Trích xuất demand tokens từ câu hỏi nhu cầu của user.
 * Đây là những từ mô tả công dụng/tính năng cần tìm.
 * Không hard-code capability mapping — chỉ tách từ có nghĩa từ câu nói tự nhiên.
 */
function extractDemandTokens(cleanedQuery: string): string[] {
  // Remove generic conversational noise that wasn't caught by cleanQueryTokens
  const noise = /\btôi cần\b|\btôi muốn\b|\bmình cần\b|\bmình muốn\b|\bcần một\b|\bcần cái\b|\bcó cái\b|\bcó app\b|\bcó tool\b|\bcó gì\b|\bgiúp mình\b|\bgiúp tôi\b|\bapp để\b|\btool để\b|\bcông cụ\b|\bphần mềm\b/gi;
  const cleaned = cleanedQuery.replace(noise, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned || cleaned.length < 2) return [];

  // Return individual meaningful tokens (length >= 2, not pure numbers)
  return cleaned
    .split(/\s+/)
    .filter(t => t.length >= 2 && !/^\d+$/.test(t));
}

// =========================================================================
// MAIN RESOLVER
// =========================================================================

/**
 * DYNAMIC PRODUCT RESOLVER V2.2
 * Pipeline: Exact → Alias → Slug → Prefix → Token → Fuzzy → Semantic Demand
 */
export async function resolveProductQuery(rawQuery: string): Promise<ProductResolutionResult> {
  const params = extractQueryParameters(rawQuery);
  const cleanTokens = cleanQueryTokens(rawQuery);
  const normClean = normalizeString(cleanTokens);
  const normRaw = normalizeString(rawQuery);

  // V2.2: Detect if this is a very short query (≤ 4 chars normalized)
  // Short queries must use strict matching only to avoid false positives
  const isShortQuery = normClean.length <= 4 && normClean.length > 0;

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

  // Chấm điểm từng sản phẩm — Layers 1-6 (Exact through Fuzzy)
  interface ScoredCandidate {
    product: ProductItemResult;
    score: number;
    matchType: ProductResolutionResult['matchType'];
  }

  const scored: ScoredCandidate[] = [];

  // Capability and demand terms that should participate in Layer 7 semantic scoring
  // but must NOT hijack Layers 1-6 as exact product brand aliases.
  const capabilityTerms = new Set([
    'xem phim', 'xem phim online', 'phim', 'phim bo', 'phim truc tuyen', 'phim trung quoc', 'phim hoa ngu',
    'nghe nhac', 'nhac', 'am nhac', 'podcast', 'giai tri', 'chinh anh', 'edit video', 'lam video', 'hoc tieng anh', 'dich thuat', 'streaming',
    'xem video', 'video', 'giai tri video', 'streaming video', 'truyen hinh truc tuyen', 'xem tv online',
    'drama', 'drama trung quoc', 'kenh truyen hinh',
  ]);

  for (const p of allProducts) {
    const normName = normalizeString(p.name);
    const normSlug = normalizeString(p.slug);
    const allAliases = (p.searchAliases || []).map((a) => normalizeString(a));
    // Brand aliases for Layers 1-6 (exclude generic capability phrases)
    const aliases = allAliases.filter((a) => !capabilityTerms.has(a));

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
    // 4. Word-boundary / Prefix Inclusion (Score: 80)
    else if (
      normRaw.includes(normName) ||
      (normClean.length >= 3 && normName.startsWith(normClean)) ||
      (normClean.length >= 3 && new RegExp(`\\b${normClean}\\b`, 'i').test(normName)) ||
      aliases.some((a) => normRaw.includes(a) || (normClean.length >= 3 && (normName.includes(normClean) || normSlug.includes(normClean)) && new RegExp(`\\b${normClean}\\b`, 'i').test(a)))
    ) {
      itemScore = 80;
      itemMatchType = 'prefix';
    }
    // 5. Token Match with Word Boundary (Score: 65)
    // V2.2: For multi-token queries, match full words only (no prefix on sub-tokens)
    // Minimum token length is 4 to prevent Vietnamese syllables from false matching.
    // Aliases in Layer 5 only match single-word aliases (e.g. yt, gpt) or exact alias to avoid generic keyword hijacking.
    else if (
      normClean.length >= 4 &&
      !isShortQuery &&
      normClean.split(' ').filter((t) => t.length >= 4).some((tok) => {
        const wordRegex = new RegExp(`\\b${tok}\\b`, 'i');
        return wordRegex.test(normName) || aliases.some((a) => !a.includes(' ') && wordRegex.test(a));
      })
    ) {
      itemScore = 65;
      itemMatchType = 'token_match';
    }

    // 5b. Short query: token match with strict word-boundary only (Score: 70)
    // For short queries allow token match but at higher confidence
    else if (isShortQuery && normClean.length >= 2) {
      const wordRegex = new RegExp(`\\b${normClean}\\b`, 'i');
      if (wordRegex.test(normName) || aliases.some(a => wordRegex.test(a))) {
        itemScore = 70;
        itemMatchType = 'token_match';
      }
    }
    // 6. Fuzzy / Typo Match (Score: 55-60)
    // V2.2: Check fuzzy against full name, individual words in name, and aliases
    else if (!isShortQuery && normClean.length >= 4) {
      const nameWords = normName.split(' ').filter((w) => w.length >= 4);
      const nameWordSims = nameWords.map((w) => calculateSimilarity(normClean, w));
      const nameSim = Math.max(calculateSimilarity(normClean, normName), ...nameWordSims, 0);

      const aliasSim = aliases.length > 0
        ? Math.max(
            ...aliases.map((a) => calculateSimilarity(normClean, a)),
            ...aliases.flatMap((a) => a.split(' ').filter((w) => w.length >= 4).map((w) => calculateSimilarity(normClean, w)))
          )
        : 0;

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

  // =========================================================================
  // RESULT ROUTING — Layers 1-6
  // =========================================================================

  if (scored.length > 0) {
    const top = scored[0];

    // V2.2: Short query ambiguity — only show ambiguous if top score is strong (≥ 70)
    // to prevent weak matches from becoming false-positive candidates
    const minAmbiguityScore = isShortQuery ? 70 : 65;

    // Kiểm tra Ambiguity (Nhiều candidate có điểm xấp xỉ nhau)
    const closeCandidates = scored.filter((s) => s.score >= top.score - 10 && s.score >= minAmbiguityScore);
    if (closeCandidates.length > 1 && top.score < 95) {
      const ambiguityMsg = `🔍 Mình tìm thấy **${closeCandidates.length} sản phẩm** phù hợp với tìm kiếm của bạn. Bạn muốn xem chi tiết sản phẩm nào?`;

      return {
        matched: true,
        confidence: top.score / 100,
        matchType: top.matchType,
        candidates: closeCandidates.map((c) => c.product),
        isAmbiguous: true,
        ambiguityMessage: ambiguityMsg,
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

  // =========================================================================
  // V2.2 — Layer 7: Semantic Capability Match
  // Only triggered when NO exact/high-confidence match found (Layers 1-6 empty)
  // Searches: description, features, tagline, categoryName from DB
  // DOES NOT hard-code any product name or capability mapping
  // =========================================================================

  // Skip semantic for short queries (e.g. "api", "vpn") — user intends product name, not demand
  if (!isShortQuery && cleanTokens.length > 0) {
    const demandTokens = extractDemandTokens(cleanTokens);

    if (demandTokens.length > 0) {
      interface SemanticScored {
        product: ProductItemResult;
        score: number;
      }

      const semanticScored: SemanticScored[] = [];

      for (const p of allProducts) {
        const score = scoreProductSemantics(p, demandTokens);
        if (score > 0) {
          semanticScored.push({ product: p, score });
        }
      }

      // Sort by score descending
      semanticScored.sort((a, b) => b.score - a.score);

      if (semanticScored.length > 0) {
        const topScore = semanticScored[0].score;
        const topCandidates = semanticScored
          .filter((s) => s.score >= topScore - 8)
          .map((s) => s.product);

        return {
          matched: false,
          confidence: topScore / 100,
          matchType: 'semantic',
          candidates: allProducts,
          isAmbiguous: false,
          // V2.2: semantic candidates for multi-product recommendation
          semanticCandidates: topCandidates,
          semanticMatchQuery: cleanTokens,
          extractedParams: params,
        };
      }
    }
  }

  // Layer 8: No match at all
  return {
    matched: false,
    confidence: 0,
    matchType: 'none',
    candidates: [],
    isAmbiguous: false,
    extractedParams: params,
  };
}
