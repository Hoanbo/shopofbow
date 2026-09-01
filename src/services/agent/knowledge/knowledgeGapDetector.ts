// src/services/agent/knowledge/knowledgeGapDetector.ts
// BOW Agent V3.3 Phase 6.0 — Production Observability & Knowledge Gap Detector

import type {
  KnowledgeGapClassification,
  KnowledgeGapMetadata,
  ResponseSource,
} from '../monitoring/analyticsTypes';
import { normalizeText, isAmbiguousDemandQuery } from '../intentResolver';
import { sanitizeQueryText } from '../monitoring/demandAggregator';

export type { KnowledgeGapClassification, KnowledgeGapMetadata, ResponseSource };

export interface KnowledgeGapCandidate {
  id?: string;
  originalQuestion: string;
  normalizedQuestion: string;
  category: 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other';
  classification: KnowledgeGapClassification;
  confidence: number;
  source: ResponseSource;
  timestamp: string;
  sessionId?: string;
  userId?: string | null;
  sampleQueries?: string[];
}

export interface DeduplicatedKnowledgeGap {
  normalizedQuestion: string;
  canonicalQuestion: string;
  category: 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other';
  classification: KnowledgeGapClassification;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: number;
  source: ResponseSource;
  sampleQueries: string[];
  status: 'PENDING' | 'REVIEWED' | 'CONVERTED_TO_FAQ' | 'DISMISSED';
}

/**
 * 1. Chuẩn hóa câu hỏi tri thức (Knowledge Question Normalization)
 * Tận dụng normalizeText để đảm bảo an toàn tuyệt đối trước mọi lỗi font/bảng mã NFD/NFC,
 * loại bỏ từ phụ trợ chào hỏi và dấu câu, tạo canonical key cho deduplication.
 */
export function normalizeKnowledgeQuestion(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  const clean = sanitizeQueryText(rawText);
  let norm = normalizeText(clean);

  // Loại bỏ các tiền tố / hậu tố hội thoại thông thường
  norm = norm
    .replace(/^(?:cho\s+(?:minh|toi|em)\s+hoi|ad\s+cho\s+hoi|shop\s+cho\s+hoi|cho\s+hoi|xin\s+hoi|lam\s+on\s+cho\s+hoi|ad\s+oi|shop\s+oi|bot\s+oi)\s+/g, '')
    .replace(/^(?:shop\s+co\s+|ben\s+shop\s+co\s+|ben\s+minh\s+co\s+|co\s+the\s+)/g, '')
    .replace(/\s+(?:khong\s+a|khong\s+shop|khong\s+ad|khong\s+vay|khong|duoc\s+khong|the\s+nao|nhu\s+the\s+nao|ra\s+sao|a|nhe|vay\s+shop)\??$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return norm || normalizeText(clean);
}

/**
 * 2. Phân loại câu hỏi tri thức (Knowledge Gap Classification)
 * Phân tách rõ ràng giữa KNOWLEDGE_GAP, PRODUCT_DEMAND, TRANSACTIONAL, GREETING, SUPPORTED_FAQ, UNSUPPORTED, SECURITY_SENSITIVE.
 */
export function classifyKnowledgeGap(
  rawText: string,
  intent?: string | null,
  searchResultsCount = 0,
  faqResultsCount = 0,
  hasNegativePolicyMatch = false
): KnowledgeGapClassification {
  if (!rawText || rawText.trim().length === 0) return 'GREETING';

  const clean = rawText.toLowerCase().trim();
  const norm = normalizeText(clean);

  // --------------------------------------------------------------------------
  // A. SECURITY_SENSITIVE GUARD:
  // Ngăn chặn prompt injection, yêu cầu PII, API key, hoặc bypass nghiệp vụ
  // --------------------------------------------------------------------------
  const isSecuritySensitive =
    /(?:ignore\s+previous|system\s+prompt|api\s*key|access\s*token|admin\s+password|secret\s+key|fake\s+admin|sk-[a-zA-Z0-9_\-]{8,}|bearer\s+[a-zA-Z0-9._-]{10,}|(?:tao|luu|them|ghi|approve|save).*?faq)/i.test(
      clean
    ) ||
    /^(?:toi\s+la\s+admin|i\s+am\s+admin|system\s+override)\b/i.test(norm);

  if (isSecuritySensitive) {
    return 'SECURITY_SENSITIVE';
  }

  // --------------------------------------------------------------------------
  // B. GREETING GUARD:
  // Chào hỏi, cảm ơn, reset phiên chat
  // --------------------------------------------------------------------------
  const isGreeting =
    /^(?:(?:xin\s+)?ch[aà]o|hello|hi|hey|alo|good\s+morning|good\s+afternoon|c[aả]m\s+[oơ]n|thank\s*you|thanks|reset|b[aắ]t\s+[đd][aà]u\s+l[aạ]i|l[aà]m\s+m[oớ]i)(?:\s+(?:shop|b[aạ]n|ad|admin|bot|em|anh|nh[eé]|nh[aà]))*[\s!.?]*$/i.test(
      clean
    ) ||
    norm === 'chao' ||
    norm === 'xin chao' ||
    norm === 'chao shop' ||
    norm === 'xin chao shop' ||
    norm === 'cam on' ||
    norm === 'cam on shop' ||
    norm === 'reset';

  if (isGreeting || intent === 'GREETING') {
    return 'GREETING';
  }

  // --------------------------------------------------------------------------
  // C. SUPPORTED NEGATIVE POLICY & FAQ:
  // Khi hệ thống đã tìm thấy Negative Policy hoặc FAQ có sẵn
  // --------------------------------------------------------------------------
  if (hasNegativePolicyMatch) {
    return 'SUPPORTED_NEGATIVE_POLICY';
  }

  if (faqResultsCount > 0) {
    return 'SUPPORTED_FAQ';
  }

  // --------------------------------------------------------------------------
  // D. TRANSACTIONAL GUARD:
  // Mua hàng, nạp tiền, bảo hành, kiểm tra đơn, áp mã giảm giá
  // --------------------------------------------------------------------------
  const isPriceInquiry =
    /(?:gia\s+bao\s+nhieu|bao\s+nhieu\s+tien|gia\s+sao|bn\s+tien|gia\s+nhieu|nhieu\s+tien|bao\s+nhieu|gia)\b/i.test(
      norm
    ) && /(?:thang|nam|goi|slot|youtube|netflix|spotify|canva|6th|12th|1th)\b/i.test(norm);

  const isExplicitTransactional =
    /^(?:mua|order|dat\s+hang|thanh\s+toan|check\s*out|nap\s+tien|nap\s+vi|topup|kiem\s+tra\s+don|tra\s+cuu\s+don|xem\s+don|doi\s+mat\s+khau|gia\s+bao\s+nhieu|bao\s+nhieu\s+tien|bao\s+hanh\s+don)\b/i.test(
      norm
    ) ||
    isPriceInquiry ||
    intent === 'BUY' ||
    intent === 'CHECKOUT' ||
    intent === 'ORDER_STATUS' ||
    intent === 'MY_ORDERS' ||
    intent === 'WARRANTY' ||
    intent === 'DEPOSIT' ||
    intent === 'WALLET' ||
    intent === 'COUPON';

  if (isExplicitTransactional && !norm.includes('chinh sach') && !norm.includes('huong dan')) {
    return 'TRANSACTIONAL';
  }

  // --------------------------------------------------------------------------
  // E. UNSUPPORTED CAPABILITY:
  // Các nhu cầu hoàn toàn phi lý / ngoài phạm vi phần mềm & dịch vụ số
  // --------------------------------------------------------------------------
  const isUnsupported =
    /(?:tau\s+vu\s+tru|ten\s+lua|sao\s+hoa|ve\s+may\s+bay|tra\s+sua|dat\s+xe|khach\s+san|tap\s+gym|o\s+to|hack\s+ngan\s+hang)/i.test(
      norm
    );

  if (isUnsupported) {
    return 'UNSUPPORTED';
  }

  // --------------------------------------------------------------------------
  // F. PRODUCT DEMAND (Catalog & App Searches):
  // Hỏi về các app, phần mềm, công cụ cụ thể hoặc các lĩnh vực sản phẩm số
  // --------------------------------------------------------------------------
  const isProductDemandQuery =
    /\b(netflix|spotify|youtube|canva|chatgpt|gemini|cursor|notion|adobe|figma|duolingo|memrise|capcut|meitu|xingtu|proton|office|word|excel|icloud|tv360|youku|kling|elevenlabs|claude|veo|grok|perplexity)\b/i.test(
      norm
    ) ||
    /\b(?:app|tool|phan\s*mem|cong\s*cu|tai\s*khoan|goi|ban\s+quyen)\s+(?:xem\s+phim|nghe\s+nhac|chinh\s+anh|ve\s+anh|tao\s+video|viet\s+code|hoc\s+tieng\s+anh|vpn|cloud)\b/i.test(
      norm
    ) ||
    /\b(?:co\s+ban|co\s+ban\s+khong|co\s+goi|co\s+san\s+pham)\b/i.test(norm) ||
    searchResultsCount > 0 ||
    intent === 'PRODUCT_SEARCH' ||
    intent === 'VIEW_CATEGORY' ||
    intent === 'CATALOG';

  // Nếu là câu hỏi tìm sản phẩm thông thường mà không phải câu hỏi chính sách/kỹ thuật
  const isPureProductDemand =
    isProductDemandQuery &&
    !/(?:ho\s+tro\s+cai|cai\s+dat|ultraview|anydesk|teamviewer|loi\s+dang\s+nhap|quen\s+mat\s+khau|chinh\s+sach|thoi\s+gian\s+lam\s+viec|lien\s+he|kenh\s+ho\s+tro)/i.test(
      norm
    );

  if (isPureProductDemand) {
    return 'PRODUCT_DEMAND';
  }

  // --------------------------------------------------------------------------
  // G. KNOWLEDGE GAP CANDIDATE:
  // Các câu hỏi về chính sách cửa hàng, hỗ trợ kỹ thuật qua Ultraview, thời gian hỗ trợ,
  // xử lý lỗi khi đăng nhập, các kênh liên hệ chưa có trong FAQ.
  // --------------------------------------------------------------------------
  const hasKnowledgeKeywords =
    /(?:ho\s+tro\s+cai|cai\s+dat|cai\s+qua|ultraview|ultraviewer|anydesk|teamviewer|thoi\s+gian\s+ho\s+tro|gio\s+lam\s+viec|lien\s+he|kenh\s+ho\s+tro|loi\s+dang\s+nhap|khong\s+dang\s+nhap\s+duoc|bi\s+loi|chinh\s+sach\s+hoan\s+tien|quy\s+dinh|doi\s+tra|huong\s+dan\s+cai)/i.test(
      norm
    ) ||
    norm.includes('ultraview') ||
    norm.includes('anydesk') ||
    norm.includes('teamviewer') ||
    norm.includes('gio lam viec') ||
    norm.includes('loi dang nhap') ||
    norm.includes('thoi gian ho tro') ||
    norm.includes('chinh sach');

  if (hasKnowledgeKeywords || intent === 'FAQ' || intent === 'GENERAL') {
    return 'KNOWLEDGE_GAP';
  }

  // Nếu là câu hỏi mơ hồ
  if (isAmbiguousDemandQuery(rawText)) {
    return 'PRODUCT_DEMAND';
  }

  // Mặc định các câu hỏi thông tin không khớp sản phẩm -> KNOWLEDGE_GAP
  return 'KNOWLEDGE_GAP';
}

/**
 * 3. Kiểm tra xem câu hỏi có phải là ứng viên Knowledge Gap không
 */
export function isKnowledgeGapCandidate(
  rawText: string,
  intent?: string | null,
  searchResultsCount = 0,
  faqResultsCount = 0
): boolean {
  return classifyKnowledgeGap(rawText, intent, searchResultsCount, faqResultsCount) === 'KNOWLEDGE_GAP';
}

/**
 * 4. Trích xuất Category chi tiết của Knowledge Gap
 */
export function inferKnowledgeGapCategory(
  normalizedText: string
): 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other' {
  if (/(?:chinh\s+sach|hoan\s+tien|quy\s+dinh|dieu\s+khoan|bao\s+hanh|doi\s+tra)/i.test(normalizedText)) {
    return 'policy';
  }
  if (/(?:cai\s+dat|cai\s+qua|ultraview|anydesk|teamviewer|setup|cai\s+app)/i.test(normalizedText)) {
    return 'technical';
  }
  if (/(?:loi|khong\s+vao\s+duoc|khong\s+dang\s+nhap|bi\s+khoa|quen\s+mat\s+khau|error)/i.test(normalizedText)) {
    return 'troubleshooting';
  }
  if (/(?:lien\s+he|hotline|zalo|facebook|fanpage|gio\s+lam\s+viec|thoi\s+gian\s+ho\s+tro)/i.test(normalizedText)) {
    return 'support';
  }
  return 'general';
}

/**
 * 5. Tạo Metadata hoàn chỉnh cho Knowledge Gap
 */
export function extractKnowledgeGapMetadata(
  rawText: string,
  intent?: string | null,
  source: ResponseSource = 'DETERMINISTIC',
  searchResultsCount = 0,
  faqResultsCount = 0
): KnowledgeGapMetadata | null {
  const classification = classifyKnowledgeGap(rawText, intent, searchResultsCount, faqResultsCount);
  if (classification !== 'KNOWLEDGE_GAP') {
    return null;
  }

  const normalized = normalizeKnowledgeQuestion(rawText);
  const category = inferKnowledgeGapCategory(normalized);

  return {
    originalQuestion: sanitizeQueryText(rawText),
    normalizedQuestion: normalized,
    category,
    classification,
    confidence: 0.85,
    source,
    contextIntent: intent || 'UNKNOWN',
  };
}

/**
 * 6. Thuật toán Deduplication thuần nhất cho Knowledge Gap
 * Gom nhóm 100 câu hỏi cùng nội dung thành 1 Knowledge Gap record duy nhất
 * với occurrenceCount = 100 và danh sách sampleQueries.
 */
export function deduplicateKnowledgeGaps(
  candidates: KnowledgeGapCandidate[]
): DeduplicatedKnowledgeGap[] {
  const map = new Map<string, DeduplicatedKnowledgeGap>();

  for (const c of candidates) {
    if (c.classification !== 'KNOWLEDGE_GAP') continue;

    const normKey = c.normalizedQuestion || normalizeKnowledgeQuestion(c.originalQuestion);
    if (!normKey) continue;

    const existing = map.get(normKey);
    const ts = c.timestamp || new Date().toISOString();

    if (!existing) {
      map.set(normKey, {
        normalizedQuestion: normKey,
        canonicalQuestion: c.originalQuestion,
        category: c.category,
        classification: c.classification,
        occurrenceCount: 1,
        firstSeenAt: ts,
        lastSeenAt: ts,
        confidence: c.confidence || 0.85,
        source: c.source,
        sampleQueries: [c.originalQuestion],
        status: 'PENDING',
      });
    } else {
      existing.occurrenceCount += 1;
      if (new Date(ts) > new Date(existing.lastSeenAt)) {
        existing.lastSeenAt = ts;
      }
      if (new Date(ts) < new Date(existing.firstSeenAt)) {
        existing.firstSeenAt = ts;
      }
      if (existing.sampleQueries.length < 5 && !existing.sampleQueries.includes(c.originalQuestion)) {
        existing.sampleQueries.push(c.originalQuestion);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}
