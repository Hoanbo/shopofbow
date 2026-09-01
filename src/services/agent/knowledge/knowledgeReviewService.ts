// src/services/agent/knowledge/knowledgeReviewService.ts
// BOW Agent V3.3 Phase 6.2 — Knowledge Operations, Priority Scoring & FAQ Quality Control

import { getActiveShopAdapter } from '../adapters/shopAdapter';
import { normalizeText } from '../intentResolver';
import { sanitizeQueryText } from '../monitoring/demandAggregator';
import {
  deduplicateKnowledgeGaps,
  normalizeKnowledgeQuestion,
  type DeduplicatedKnowledgeGap,
  type KnowledgeGapCandidate,
} from './knowledgeGapDetector';
import { getGeminiApiKey, GEMINI_CONFIG } from '../gemini/config';
import type {
  KnowledgePriority,
  FaqStaleStatus,
  FaqQualityMetrics,
  FaqEditHistoryItem,
} from '../monitoring/analyticsTypes';

export type KnowledgeGapStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'merged';

export interface ReviewableKnowledgeGap extends Omit<DeduplicatedKnowledgeGap, 'status'> {
  id: string;
  status: KnowledgeGapStatus;
  priority: KnowledgePriority;
  priorityScore: number;
  priorityReasons: string[];
  reviewNotes?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  convertedFaqId?: string | null;
  mergedTargetId?: string | null;
}

export interface KnowledgeSuggestionOutput {
  question: string;
  answer: string;
  category: 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other';
  relatedQuestions: string[];
  confidence: 'high' | 'medium' | 'low';
  isFallback?: boolean;
}

export interface SimilarFaqMatch {
  faq: {
    id: string;
    question: string;
    answer: string;
    sort_order?: number;
    created_at?: string;
  };
  similarity: number; // 0 to 100%
}

/**
 * Tính toán độ tương đồng giữa hai câu hỏi bằng Jaccard Similarity trên tập từ chuẩn hóa
 */
export function calculateQuestionSimilarity(q1: string, q2: string): number {
  const n1 = normalizeText(q1);
  const n2 = normalizeText(q2);

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;
  if (n1.includes(n2) || n2.includes(n1)) return 85;

  const words1 = new Set(n1.split(/\s+/));
  const words2 = new Set(n2.split(/\s+/));

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  if (union === 0) return 0;

  return Math.round((intersection / union) * 100);
}

/**
 * 1. Tính toán Knowledge Gap Priority dựa trên tần suất, tính mới, danh mục và độ trễ
 */
export function calculateKnowledgeGapPriority(gap: {
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  category: string;
}): { priority: KnowledgePriority; priorityScore: number; priorityReasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // A. Tần suất (Occurrence Count)
  if (gap.occurrenceCount >= 10) {
    score += 45;
    reasons.push(`Tần suất cao (≥10 lượt hỏi: ${gap.occurrenceCount})`);
  } else if (gap.occurrenceCount >= 5) {
    score += 25;
    reasons.push(`Tần suất vừa (≥5 lượt hỏi: ${gap.occurrenceCount})`);
  } else if (gap.occurrenceCount >= 2) {
    score += 10;
  }

  // B. Danh mục quan trọng (Category Importance)
  if (gap.category === 'policy' || gap.category === 'technical') {
    score += 25;
    reasons.push(`Chuyên mục trọng yếu (${gap.category === 'policy' ? 'Chính sách' : 'Kỹ thuật'})`);
  } else if (gap.category === 'support' || gap.category === 'troubleshooting') {
    score += 15;
    reasons.push(`Chuyên mục hỗ trợ / xử lý lỗi`);
  }

  // C. Tính mới (Recency)
  const now = Date.now();
  const lastSeenTime = new Date(gap.lastSeenAt || gap.firstSeenAt).getTime();
  const daysSinceLastSeen = (now - lastSeenTime) / (1000 * 60 * 60 * 24);

  if (daysSinceLastSeen <= 3) {
    score += 20;
    reasons.push('Vừa được hỏi gần đây (≤ 3 ngày)');
  } else if (daysSinceLastSeen <= 7) {
    score += 10;
  }

  // D. Thời gian chưa giải quyết (Unresolved duration)
  const firstSeenTime = new Date(gap.firstSeenAt).getTime();
  const daysUnresolved = (now - firstSeenTime) / (1000 * 60 * 60 * 24);
  if (daysUnresolved >= 14 && gap.occurrenceCount >= 3) {
    score += 10;
    reasons.push('Tồn đọng trên 14 ngày');
  }

  // Phân bậc Priority
  let priority: KnowledgePriority = 'LOW';
  if (score >= 60) {
    priority = 'HIGH';
  } else if (score >= 30) {
    priority = 'MEDIUM';
  }

  return { priority, priorityScore: score, priorityReasons: reasons };
}

/**
 * 2. Tìm các FAQ tương tự đã tồn tại trong Catalog để chống trùng lặp
 */
export async function findSimilarFaqs(
  question: string,
  providedFaqs?: Array<{ id: string; question: string; answer: string; created_at?: string; sort_order?: number }>
): Promise<SimilarFaqMatch[]> {
  try {
    let faqs = providedFaqs;
    if (!faqs) {
      const dbFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: true });
      faqs = (dbFaqs as any) || [];
    }

    const matches: SimilarFaqMatch[] = [];

    for (const f of faqs || []) {
      const sim = calculateQuestionSimilarity(question, f.question);
      if (sim >= 40) {
        matches.push({
          faq: f,
          similarity: sim,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  } catch (err) {
    console.warn('[KnowledgeReview] Error finding similar FAQs:', err);
    return [];
  }
}

/**
 * 3. Lấy danh sách Knowledge Gaps phục vụ Admin Hub (Tích hợp Priority & Lifecycle)
 */
export async function getKnowledgeGaps(filters?: {
  status?: KnowledgeGapStatus | 'all';
  priority?: KnowledgePriority | 'all';
  category?: string;
  search?: string;
  sortBy?: 'frequency' | 'priority' | 'newest' | 'oldest' | 'updated';
}): Promise<ReviewableKnowledgeGap[]> {
  try {
    const rawEvents = await getActiveShopAdapter().storage!.getAgentEvents(
      undefined,
      1000,
      [
        'KNOWLEDGE_GAP_DETECTED',
        'KNOWLEDGE_GAP_REVIEWED',
        'KNOWLEDGE_GAP_REJECTED',
        'KNOWLEDGE_GAP_MERGED',
        'KNOWLEDGE_GAP_APPROVED',
      ]
    );

    const events = rawEvents || [];

    const candidates: KnowledgeGapCandidate[] = [];
    const statusMap = new Map<
      string,
      {
        status: KnowledgeGapStatus;
        reviewNotes?: string;
        reviewedBy?: string | null;
        reviewedAt?: string | null;
        convertedFaqId?: string | null;
        mergedTargetId?: string | null;
      }
    >();

    for (const ev of events) {
      const meta = ev.metadata || {};
      const gapId = meta.gapId || meta.normalizedQuestion;

      if (
        ev.event_type === 'KNOWLEDGE_GAP_REVIEWED' ||
        ev.event_type === 'KNOWLEDGE_GAP_REJECTED' ||
        ev.event_type === 'KNOWLEDGE_GAP_MERGED' ||
        ev.event_type === 'KNOWLEDGE_GAP_APPROVED'
      ) {
        if (gapId && !statusMap.has(gapId)) {
          let status: KnowledgeGapStatus = 'new';
          if (ev.event_type === 'KNOWLEDGE_GAP_REVIEWED') status = 'reviewing';
          if (ev.event_type === 'KNOWLEDGE_GAP_REJECTED') status = 'rejected';
          if (ev.event_type === 'KNOWLEDGE_GAP_MERGED') status = 'merged';
          if (ev.event_type === 'KNOWLEDGE_GAP_APPROVED') status = 'approved';

          statusMap.set(gapId, {
            status,
            reviewNotes: meta.reason || meta.reviewNotes,
            reviewedBy: ev.user_id,
            reviewedAt: ev.created_at,
            convertedFaqId: meta.faqId,
            mergedTargetId: meta.targetId,
          });
        }
      } else if (ev.event_type === 'KNOWLEDGE_GAP_DETECTED') {
        candidates.push({
          id: ev.id,
          originalQuestion: meta.originalQuestion || meta.rawQuery || 'Câu hỏi',
          normalizedQuestion: meta.normalizedQuestion || normalizeKnowledgeQuestion(meta.originalQuestion || ''),
          category: meta.category || 'general',
          classification: 'KNOWLEDGE_GAP',
          confidence: meta.confidence || 0.85,
          source: meta.source || 'DETERMINISTIC',
          timestamp: ev.created_at || new Date().toISOString(),
          sessionId: ev.session_id,
          userId: ev.user_id,
        });
      }
    }

    const deduped = deduplicateKnowledgeGaps(candidates);

    const reviewableList: ReviewableKnowledgeGap[] = deduped.map((d) => {
      const lifecycle = statusMap.get(d.normalizedQuestion);
      const priorityInfo = calculateKnowledgeGapPriority({
        occurrenceCount: d.occurrenceCount,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt,
        category: d.category,
      });

      return {
        ...d,
        id: d.normalizedQuestion,
        status: lifecycle?.status || 'new',
        priority: priorityInfo.priority,
        priorityScore: priorityInfo.priorityScore,
        priorityReasons: priorityInfo.priorityReasons,
        reviewNotes: lifecycle?.reviewNotes,
        reviewedBy: lifecycle?.reviewedBy,
        reviewedAt: lifecycle?.reviewedAt,
        convertedFaqId: lifecycle?.convertedFaqId,
        mergedTargetId: lifecycle?.mergedTargetId,
      };
    });

    let result = reviewableList;

    if (filters?.status && filters.status !== 'all') {
      result = result.filter((r) => r.status === filters.status);
    }

    if (filters?.priority && filters.priority !== 'all') {
      result = result.filter((r) => r.priority === filters.priority);
    }

    if (filters?.category && filters.category !== 'all') {
      result = result.filter((r) => r.category === filters.category);
    }

    if (filters?.search && filters.search.trim()) {
      const q = normalizeText(filters.search);
      result = result.filter(
        (r) =>
          normalizeText(r.canonicalQuestion).includes(q) ||
          r.sampleQueries.some((sq) => normalizeText(sq).includes(q))
      );
    }

    // Sắp xếp
    if (filters?.sortBy === 'priority') {
      result.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (filters?.sortBy === 'newest') {
      result.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    } else if (filters?.sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime());
    } else if (filters?.sortBy === 'updated') {
      result.sort(
        (a, b) =>
          new Date(b.reviewedAt || b.lastSeenAt).getTime() - new Date(a.reviewedAt || a.lastSeenAt).getTime()
      );
    } else {
      // Mặc định: frequency DESC
      result.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
    }

    return result;
  } catch (err) {
    console.warn('[KnowledgeReview] Error loading knowledge gaps:', err);
    return [];
  }
}

/**
 * 4. Đánh dấu Knowledge Gap chuyển sang trạng thái "reviewing"
 */
export async function markKnowledgeGapReviewing(
  gapId: string,
  adminUserId: string
): Promise<boolean> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');

  try {
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'KNOWLEDGE_GAP_REVIEWED',
        user_id: adminUserId,
        intent: 'KNOWLEDGE_GAP_REVIEW',
        metadata: {
          gapId,
          status: 'reviewing',
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return true;
  } catch (err) {
    console.error('[KnowledgeReview] Exception in markKnowledgeGapReviewing:', err);
    return false;
  }
}

/**
 * 5. Từ chối Knowledge Gap (Chuyển sang "rejected")
 */
export async function rejectKnowledgeGap(
  gapId: string,
  reason: string,
  adminUserId: string
): Promise<boolean> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');

  try {
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'KNOWLEDGE_GAP_REJECTED',
        user_id: adminUserId,
        intent: 'KNOWLEDGE_GAP_REJECT',
        reason: sanitizeQueryText(reason),
        metadata: {
          gapId,
          status: 'rejected',
          reason: sanitizeQueryText(reason),
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return true;
  } catch (err) {
    console.error('[KnowledgeReview] Exception in rejectKnowledgeGap:', err);
    return false;
  }
}

/**
 * 6. Smart Merge Knowledge Gaps (Gộp các biến thể câu hỏi vào Gap chính)
 */
export async function smartMergeKnowledgeGaps(
  targetGapId: string,
  sourceGapIds: string[],
  adminUserId: string,
  reason?: string
): Promise<{ success: boolean; mergedCount: number; error?: string }> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');
  if (!targetGapId || !sourceGapIds || sourceGapIds.length === 0) {
    return { success: false, mergedCount: 0, error: 'Thiếu thông tin Target hoặc Source Gaps' };
  }

  try {
    const rows = sourceGapIds.map((srcId) => ({
      event_type: 'KNOWLEDGE_GAP_MERGED',
      user_id: adminUserId,
      intent: 'KNOWLEDGE_GAP_MERGE',
      metadata: {
        gapId: srcId,
        targetId: targetGapId,
        status: 'merged',
        reason: reason ? sanitizeQueryText(reason) : 'Gộp câu hỏi tương tự',
        timestamp: new Date().toISOString(),
      },
    }));

    await getActiveShopAdapter().storage!.insertAnalyticsEvents!(rows);

    return {
      success: true,
      mergedCount: sourceGapIds.length,
    };
  } catch (err: any) {
    console.error('[KnowledgeReview] Exception in smartMergeKnowledgeGaps:', err);
    return {
      success: false,
      mergedCount: 0,
      error: err.message || 'Lỗi khi gộp Knowledge Gaps',
    };
  }
}

/**
 * Alias tương thích ngược với mergeKnowledgeGaps
 */
export async function mergeKnowledgeGaps(
  targetId: string,
  sourceIds: string[],
  adminUserId: string
): Promise<boolean> {
  const res = await smartMergeKnowledgeGaps(targetId, sourceIds, adminUserId);
  return res.success;
}

/**
 * 7. AI Knowledge Suggestion (Đề xuất tiêu đề & câu trả lời an toàn, trung lập, 0 hallucinate)
 */
export async function generateKnowledgeSuggestion(gap: {
  originalQuestion: string;
  normalizedQuestion: string;
  category?: 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other';
}): Promise<KnowledgeSuggestionOutput> {
  const category = gap.category || 'general';
  const apiKey = getGeminiApiKey();

  const fallbackTemplate: KnowledgeSuggestionOutput = {
    question: sanitizeQueryText(gap.originalQuestion),
    answer: `Shop of BOW hỗ trợ giải đáp và xử lý các vấn đề liên quan đến ${gap.originalQuestion}. Bạn có thể liên hệ trực tiếp đội ngũ kỹ thuật viên qua kênh Zalo hoặc Hotline để được hỗ trợ nhanh nhất.`,
    category,
    relatedQuestions: [
      `Hướng dẫn liên quan đến ${gap.originalQuestion}`,
      `Thời gian và kênh hỗ trợ về ${gap.originalQuestion}`,
    ],
    confidence: 'low',
    isFallback: true,
  };

  if (!apiKey) {
    return fallbackTemplate;
  }

  try {
    const prompt = `Bạn là trợ lý Knowledge Base của ShopOfBow (Shop phần mềm và tài khoản bản quyền).
Nhiệm vụ: Hãy phân tích câu hỏi của khách hàng dưới đây và đề xuất bản thảo FAQ chính thức cho Admin duyệt.

Câu hỏi của khách: "${gap.originalQuestion}"
Chuyên mục: "${category}"

Quy tắc bắt buộc:
1. Trả lời bằng Tiếng Việt chuẩn mực, lịch sự, rõ ràng, súc tích.
2. TUYỆT ĐỐI KHÔNG tự bịa đặt giá tiền, cam kết bảo hành cụ thể hay chính sách chưa có.
3. Nếu là câu hỏi cài đặt (UltraViewer, AnyDesk), hướng dẫn khách liên hệ nhân viên kỹ thuật qua Zalo/Ticket.
4. Trả về đúng định dạng JSON:
{
  "question": "Câu hỏi chuẩn hóa hiển thị FAQ",
  "answer": "Nội dung câu trả lời hoàn chỉnh",
  "category": "policy|technical|support|troubleshooting|general|other",
  "relatedQuestions": ["Câu hỏi liên quan 1", "Câu hỏi liên quan 2"],
  "confidence": "high|medium|low"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.modelName}:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      return fallbackTemplate;
    }

    const data = await res.json();
    const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) return fallbackTemplate;

    const parsed = JSON.parse(textOut);
    return {
      question: parsed.question || gap.originalQuestion,
      answer: parsed.answer || fallbackTemplate.answer,
      category: parsed.category || category,
      relatedQuestions: Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions : [],
      confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'medium',
      isFallback: false,
    };
  } catch (err) {
    console.warn('[KnowledgeReview] Gemini suggestion exception, using deterministic fallback:', err);
    return fallbackTemplate;
  }
}

/**
 * 8. Phê duyệt Knowledge Gap và tạo FAQ chính thức trong public.faqs
 */
export async function approveKnowledgeGap(
  gapId: string,
  faqData: {
    question: string;
    answer: string;
    category?: string;
  },
  adminUserId: string
): Promise<{
  success: boolean;
  faqId?: string;
  error?: string;
  isDuplicate?: boolean;
}> {
  if (!adminUserId) {
    throw new Error('UNAUTHORIZED: Admin user ID required');
  }

  const cleanQuestion = sanitizeQueryText(faqData.question).trim();
  const cleanAnswer = faqData.answer.trim();

  if (!cleanQuestion) {
    return { success: false, error: 'Câu hỏi không được để trống' };
  }
  if (!cleanAnswer) {
    return { success: false, error: 'Câu trả lời không được để trống' };
  }

  try {
    const existingFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: false });

    const normTarget = normalizeText(cleanQuestion);
    const duplicate = (existingFaqs || []).find((f) => normalizeText(f.question) === normTarget);

    if (duplicate) {
      return {
        success: false,
        isDuplicate: true,
        faqId: duplicate.id,
        error: 'Câu hỏi này đã tồn tại trong danh mục FAQ chính thức.',
      };
    }

    const nextSortOrder = (existingFaqs?.length || 0) + 1;

    const insertedFaq = await getActiveShopAdapter().storage!.insertFaq!({
      product_id: null,
      question: cleanQuestion,
      answer: cleanAnswer,
      sort_order: nextSortOrder,
    });

    const createdFaqId = insertedFaq?.id;

    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'KNOWLEDGE_GAP_APPROVED',
        user_id: adminUserId,
        intent: 'KNOWLEDGE_GAP_APPROVE',
        metadata: {
          gapId,
          faqId: createdFaqId,
          question: cleanQuestion,
          category: faqData.category || 'general',
          timestamp: new Date().toISOString(),
        },
      },
      {
        event_type: 'FAQ_CREATED_FROM_KNOWLEDGE_GAP',
        user_id: adminUserId,
        intent: 'FAQ_CREATE',
        metadata: {
          gapId,
          faqId: createdFaqId,
          question: cleanQuestion,
          sort_order: nextSortOrder,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return {
      success: true,
      faqId: createdFaqId,
    };
  } catch (err: any) {
    console.error('[KnowledgeReview] Exception in approveKnowledgeGap:', err);
    return {
      success: false,
      error: err.message || 'Lỗi khi phê duyệt FAQ',
    };
  }
}

/**
 * 9. Đánh giá chất lượng FAQ & Phát hiện FAQ lỗi thời (Quality Score & Stale Detection)
 */
export async function calculateFaqQualityAndStaleMetrics(
  providedFaqs?: Array<{ id: string; question: string; answer: string; sort_order?: number; created_at?: string }>,
  providedEvents?: any[],
  providedGaps?: ReviewableKnowledgeGap[]
): Promise<FaqQualityMetrics[]> {
  try {
    let faqs = providedFaqs;
    if (!faqs) {
      const dbFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: false });
      faqs = (dbFaqs as any) || [];
    }

    let events = providedEvents;
    if (!events) {
      events = await getActiveShopAdapter().storage!.getAgentEvents(
        undefined,
        1000,
        ['FAQ_USED', 'KNOWLEDGE_GAP_DETECTED']
      );
    }

    const gaps = providedGaps || [];

    // Map usage
    const usageCountMap = new Map<string, { count: number; lastUsedAt: string | null }>();
    for (const ev of events || []) {
      if (ev.event_type === 'FAQ_USED') {
        const fId = ev.metadata?.faqId;
        const normQ = ev.metadata?.normalizedQuery;
        if (fId) {
          const prev = usageCountMap.get(fId) || { count: 0, lastUsedAt: null };
          usageCountMap.set(fId, {
            count: prev.count + 1,
            lastUsedAt: ev.created_at || prev.lastUsedAt,
          });
        } else if (normQ) {
          // Match by question
          const matchFaq = (faqs || []).find((f) => normalizeText(f.question) === normQ);
          if (matchFaq) {
            const prev = usageCountMap.get(matchFaq.id) || { count: 0, lastUsedAt: null };
            usageCountMap.set(matchFaq.id, {
              count: prev.count + 1,
              lastUsedAt: ev.created_at || prev.lastUsedAt,
            });
          }
        }
      }
    }

    const metricsList: FaqQualityMetrics[] = [];

    for (const f of faqs || []) {
      const usageInfo = usageCountMap.get(f.id) || { count: 0, lastUsedAt: null };
      const usageCount = usageInfo.count;
      const lastUsedAt = usageInfo.lastUsedAt;

      // 1. Quality Score (0-100)
      let score = 30; // Base score

      // Answer depth
      if (f.answer && f.answer.length >= 50) {
        score += 25;
      } else if (f.answer && f.answer.length >= 20) {
        score += 15;
      }

      // Usage
      if (usageCount >= 10) {
        score += 25;
      } else if (usageCount >= 1) {
        score += 15;
      }

      // Freshness
      const createdAtTime = f.created_at ? new Date(f.created_at).getTime() : Date.now();
      const daysOld = (Date.now() - createdAtTime) / (1000 * 60 * 60 * 24);
      if (daysOld <= 30) {
        score += 20;
      } else if (daysOld <= 90) {
        score += 10;
      }

      // 2. Stale Detection & Similar Gap Count
      let similarGapCount = 0;
      for (const g of gaps) {
        if (g.status !== 'approved' && g.status !== 'rejected') {
          const sim = calculateQuestionSimilarity(f.question, g.canonicalQuestion);
          if (sim >= 70) {
            similarGapCount += g.occurrenceCount;
          }
        }
      }

      let staleStatus: FaqStaleStatus = 'CURRENT';
      let staleReason: string | undefined;

      if (similarGapCount >= 10) {
        staleStatus = 'NEEDS_REVIEW';
        staleReason = `Có ${similarGapCount} câu hỏi người dùng tương tự chưa khớp FAQ này (nội dung có thể cần bổ sung).`;
      } else if (daysOld > 90 && usageCount === 0) {
        staleStatus = 'STALE';
        staleReason = 'Đã tạo hơn 90 ngày nhưng chưa có lượt hỏi nào.';
      } else if (f.answer.length < 20) {
        staleStatus = 'NEEDS_REVIEW';
        staleReason = 'Nội dung câu trả lời quá ngắn (< 20 ký tự).';
      }

      metricsList.push({
        faqId: f.id,
        question: f.question,
        answer: f.answer,
        category: 'general',
        usageCount,
        lastUsedAt,
        qualityScore: Math.min(100, Math.max(0, score)),
        staleStatus,
        staleReason,
        similarGapCount,
      });
    }

    return metricsList;
  } catch (err) {
    console.warn('[KnowledgeReview] Error calculating FAQ quality metrics:', err);
    return [];
  }
}

/**
 * 10. Chỉnh sửa FAQ có lưu vết lịch sử (FAQ Edit With Version History)
 */
export async function editFaqWithVersionHistory(
  faqId: string,
  patch: { question: string; answer: string; sort_order?: number },
  reason: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');
  if (!patch.question.trim() || !patch.answer.trim()) {
    return { success: false, error: 'Câu hỏi và câu trả lời không được để trống' };
  }

  try {
    // 1. Lấy dữ liệu FAQ trước khi sửa
    const allFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: false });
    const beforeFaq = (allFaqs || []).find((f) => f.id === faqId);

    if (!beforeFaq) {
      return { success: false, error: 'Không tìm thấy FAQ cần sửa' };
    }

    // 2. Cập nhật vào public.faqs
    const updateOk = await getActiveShopAdapter().storage!.updateFaq!(faqId, {
      question: sanitizeQueryText(patch.question).trim(),
      answer: patch.answer.trim(),
      sort_order: patch.sort_order ?? (beforeFaq as any).sort_order,
    });

    if (!updateOk) throw new Error('Cập nhật FAQ thất bại');

    // 3. Ghi vết lịch sử vào agent_analytics_events
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'FAQ_EDITED',
        user_id: adminUserId,
        intent: 'FAQ_EDIT',
        reason: sanitizeQueryText(reason),
        metadata: {
          faqId,
          adminUserId,
          before: { question: beforeFaq.question, answer: beforeFaq.answer },
          after: { question: patch.question.trim(), answer: patch.answer.trim() },
          reason: sanitizeQueryText(reason),
          timestamp: new Date().toISOString(),
        },
      },
      {
        event_type: 'FAQ_VERSION_CREATED',
        user_id: adminUserId,
        intent: 'FAQ_VERSION',
        metadata: {
          faqId,
          snapshot: { question: patch.question.trim(), answer: patch.answer.trim() },
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return { success: true };
  } catch (err: any) {
    console.error('[KnowledgeReview] Exception in editFaqWithVersionHistory:', err);
    return { success: false, error: err.message || 'Lỗi khi cập nhật FAQ' };
  }
}

/**
 * 11. Lấy lịch sử chỉnh sửa FAQ
 */
export async function getFaqEditHistory(faqId?: string): Promise<FaqEditHistoryItem[]> {
  try {
    const data = await getActiveShopAdapter().storage!.getAgentEvents(
      undefined,
      1000,
      ['FAQ_EDITED']
    );

    const items: FaqEditHistoryItem[] = (data || []).map((ev: any) => ({
      id: ev.id,
      faqId: ev.metadata?.faqId,
      adminUserId: ev.user_id,
      before: ev.metadata?.before || { question: '', answer: '' },
      after: ev.metadata?.after || { question: '', answer: '' },
      reason: ev.reason || ev.metadata?.reason,
      timestamp: ev.created_at,
    }));

    if (faqId) {
      return items.filter((it) => it.faqId === faqId);
    }

    return items;
  } catch (err) {
    console.warn('[KnowledgeReview] Error fetching FAQ edit history:', err);
    return [];
  }
}
