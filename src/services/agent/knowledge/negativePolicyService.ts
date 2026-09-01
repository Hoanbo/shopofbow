// src/services/agent/knowledge/negativePolicyService.ts
// BOW Agent V3.3 Phase 6.6 — Reject & Remember Decision + Negative Policy Resolver + Loop Prevention

import { getActiveShopAdapter } from '../adapters/shopAdapter';
import { normalizeText } from '../intentResolver';
import { sanitizeQueryText } from '../monitoring/demandAggregator';
import { calculateQuestionSimilarity } from './knowledgeReviewService';
import type {
  NegativePolicy,
  PolicyScopeType,
  PolicyStatus,
} from '../monitoring/analyticsTypes';

let cachedPolicies: NegativePolicy[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute local TTL

/**
 * Xóa cache Negative Policies (Cache Invalidation Hook)
 */
export function clearNegativePolicyCache(): void {
  cachedPolicies = null;
  cacheTimestamp = 0;
}

/**
 * 1. Lấy danh sách toàn bộ Negative Policies (kết hợp audit events & in-memory cache)
 */
export async function getNegativePolicies(filters?: {
  status?: PolicyStatus | 'ALL';
  search?: string;
}): Promise<NegativePolicy[]> {
  try {
    const now = Date.now();
    if (cachedPolicies && now - cacheTimestamp < CACHE_TTL_MS && !filters?.search) {
      if (filters?.status && filters.status !== 'ALL') {
        return cachedPolicies.filter((p) => p.status === filters.status);
      }
      return cachedPolicies;
    }

    const events = await getActiveShopAdapter().storage!.getAgentEvents(
      undefined,
      1000,
      [
        'NEGATIVE_POLICY_CREATED',
        'NEGATIVE_POLICY_UPDATED',
        'NEGATIVE_POLICY_ACTIVATED',
        'NEGATIVE_POLICY_DEACTIVATED',
        'NEGATIVE_POLICY_MATCHED',
      ]
    );

    const policiesMap = new Map<string, NegativePolicy>();
    const usageMap = new Map<string, { count: number; lastUsed: string | null }>();

    for (const ev of events || []) {
      const type = ev.event_type;
      const meta = ev.metadata || {};
      const policyId = meta.policyId || ev.id;

      if (type === 'NEGATIVE_POLICY_CREATED') {
        policiesMap.set(policyId, {
          id: policyId,
          policyKey: meta.policyKey || `NEG-${meta.scopeType}-${meta.scopeValue}`.toUpperCase(),
          scopeType: meta.scopeType || 'GLOBAL',
          scopeValue: meta.scopeValue || 'general',
          questionPattern: meta.questionPattern || '',
          normalizedQuestion: meta.normalizedQuestion || normalizeText(meta.questionPattern || ''),
          answer: meta.answer || '',
          reason: meta.reason || ev.reason || '',
          status: 'ACTIVE',
          createdBy: ev.user_id,
          createdAt: ev.created_at || new Date().toISOString(),
          updatedAt: ev.created_at || new Date().toISOString(),
          usageCount: 0,
        });
      } else if (type === 'NEGATIVE_POLICY_UPDATED' && policiesMap.has(policyId)) {
        const existing = policiesMap.get(policyId)!;
        policiesMap.set(policyId, {
          ...existing,
          answer: meta.after?.answer ?? existing.answer,
          reason: meta.after?.reason ?? existing.reason,
          scopeValue: meta.after?.scopeValue ?? existing.scopeValue,
          updatedAt: ev.created_at || new Date().toISOString(),
        });
      } else if (type === 'NEGATIVE_POLICY_DEACTIVATED' && policiesMap.has(policyId)) {
        const existing = policiesMap.get(policyId)!;
        existing.status = 'INACTIVE';
        existing.updatedAt = ev.created_at || new Date().toISOString();
      } else if (type === 'NEGATIVE_POLICY_ACTIVATED' && policiesMap.has(policyId)) {
        const existing = policiesMap.get(policyId)!;
        existing.status = 'ACTIVE';
        existing.updatedAt = ev.created_at || new Date().toISOString();
      } else if (type === 'NEGATIVE_POLICY_MATCHED') {
        const pId = meta.policyId;
        if (pId) {
          const prev = usageMap.get(pId) || { count: 0, lastUsed: null };
          usageMap.set(pId, { count: prev.count + 1, lastUsed: ev.created_at });
        }
      }
    }

    // Gắn usage telemetry
    for (const [pId, usage] of usageMap.entries()) {
      if (policiesMap.has(pId)) {
        const pol = policiesMap.get(pId)!;
        pol.usageCount = usage.count;
        pol.lastUsedAt = usage.lastUsed;
      }
    }

    const allPolicies = Array.from(policiesMap.values()).reverse();
    cachedPolicies = allPolicies;
    cacheTimestamp = Date.now();

    let result = allPolicies;
    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((p) => p.status === filters.status);
    }
    if (filters?.search && filters.search.trim().length > 0) {
      const s = normalizeText(filters.search.trim());
      result = result.filter(
        (p) =>
          p.normalizedQuestion.includes(s) ||
          normalizeText(p.answer).includes(s) ||
          normalizeText(p.scopeValue).includes(s)
      );
    }

    return result;
  } catch (err) {
    console.warn('[NegativePolicyService] Error loading negative policies:', err);
    return [];
  }
}

/**
 * 2. Quyết định từ chối & ghi nhớ (Reject & Remember Decision)
 */
export async function rejectAndRememberDecision(params: {
  gapId?: string;
  originalQuestion: string;
  scopeType: PolicyScopeType;
  scopeValue: string;
  answer: string;
  reason?: string;
  adminUserId: string;
}): Promise<{ success: boolean; policy?: NegativePolicy; error?: string; conflictWarning?: string }> {
  if (!params.adminUserId) {
    throw new Error('UNAUTHORIZED: Admin user ID required to remember rejection policy');
  }

  try {
    const cleanQ = sanitizeQueryText(params.originalQuestion).trim();
    const cleanA = sanitizeQueryText(params.answer).trim();
    const cleanScope = sanitizeQueryText(params.scopeValue).toLowerCase().trim();

    if (!cleanQ || !cleanA || !cleanScope) {
      return { success: false, error: 'Vui lòng điền đầy đủ câu hỏi, câu trả lời và phạm vi đối tượng.' };
    }

    // 1. Kiểm tra conflict với Positive FAQs trong public.faqs
    const conflict = await detectPolicyConflict(cleanQ);

    // 2. Kiểm tra trùng lặp policy đã tồn tại (Idempotency)
    const existing = await getNegativePolicies();
    const dup = existing.find(
      (p) =>
        p.status === 'ACTIVE' &&
        p.scopeType === params.scopeType &&
        p.scopeValue === cleanScope &&
        calculateQuestionSimilarity(cleanQ, p.questionPattern) >= 70
    );

    if (dup) {
      return {
        success: false,
        error: `Đã tồn tại Negative Policy tương tự cho scope "${cleanScope}". Bạn có thể chỉnh sửa Policy [${dup.policyKey}] thay vì tạo mới.`,
      };
    }

    const policyId = `neg-pol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const policyKey = `NEG-${params.scopeType}-${cleanScope.replace(/[^a-z0-9]/gi, '_')}`.toUpperCase();
    const normQ = normalizeText(cleanQ);

    const newPolicy: NegativePolicy = {
      id: policyId,
      policyKey,
      scopeType: params.scopeType,
      scopeValue: cleanScope,
      questionPattern: cleanQ,
      normalizedQuestion: normQ,
      answer: cleanA,
      reason: params.reason ? sanitizeQueryText(params.reason).trim() : '',
      status: 'ACTIVE',
      createdBy: params.adminUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    // 3. Ghi audit event
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'NEGATIVE_POLICY_CREATED',
        user_id: params.adminUserId,
        intent: 'NEGATIVE_POLICY_CREATE',
        reason: params.reason || 'Admin rejected and remembered unsupported scope',
        metadata: {
          policyId,
          policyKey,
          gapId: params.gapId,
          scopeType: params.scopeType,
          scopeValue: cleanScope,
          questionPattern: cleanQ,
          normalizedQuestion: normQ,
          answer: cleanA,
          reason: params.reason,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    clearNegativePolicyCache();

    return {
      success: true,
      policy: newPolicy,
      conflictWarning: conflict.hasConflict ? `⚠️ Cảnh báo xung đột: Phát hiện FAQ có sẵn "${conflict.conflictingFaq}" có thể mâu thuẫn với chính sách từ chối này.` : undefined,
    };
  } catch (err: any) {
    console.error('[NegativePolicyService] Exception in rejectAndRememberDecision:', err);
    return { success: false, error: err.message || 'Lỗi khi tạo Negative Policy' };
  }
}

/**
 * 3. Khớp truy vấn người dùng với Negative Policy (Negative Policy Runtime Resolver)
 * Khớp semantic variations, Unicode NFC/NFD, unaccented, prefixes, typos
 */
export async function matchNegativePolicy(
  query: string,
  providedPolicies?: NegativePolicy[]
): Promise<{ policy: NegativePolicy; confidence: number; matchReason: string } | null> {
  try {
    const rawClean = query.toLowerCase().trim();
    const normQuery = normalizeText(rawClean);

    const policies = providedPolicies || (await getNegativePolicies({ status: 'ACTIVE' }));
    const activePolicies = policies.filter((p) => p.status === 'ACTIVE');

    if (activePolicies.length === 0) return null;

    let bestMatch: { policy: NegativePolicy; confidence: number; matchReason: string } | null = null;
    let highestScore = 0;

    for (const policy of activePolicies) {
      const scopeVal = normalizeText(policy.scopeValue);

      // A. Scope Match & Target Keyword Match
      const hasScopeKeyword =
        scopeVal.length > 1 &&
        (normQuery.includes(scopeVal) ||
          rawClean.includes(policy.scopeValue.toLowerCase()) ||
          normQuery.split(' ').includes(scopeVal));

      // B. Phrasing Similarity
      const similarity = calculateQuestionSimilarity(query, policy.questionPattern);

      // C. Contextual Keyword & Intent Match
      const isSupportInquiry =
        normQuery.includes('ho tro') ||
        normQuery.includes('cai') ||
        normQuery.includes('nhan') ||
        normQuery.includes('dung duoc') ||
        normQuery.includes('su dung') ||
        normQuery.includes('co duoc') ||
        normQuery.includes('remote') ||
        normQuery.includes('giup') ||
        normQuery.includes('lam') ||
        normQuery.includes('cho hoi') ||
        normQuery.includes('hoi ve');

      let confidence = 0;
      let reason = '';

      if (hasScopeKeyword && isSupportInquiry) {
        confidence = Math.max(similarity, 85);
        reason = `Matched scope "${policy.scopeValue}" with support intent`;
      } else if (hasScopeKeyword && similarity >= 30) {
        confidence = Math.max(similarity, 75);
        reason = `Matched scope "${policy.scopeValue}" with ${similarity}% similarity`;
      } else if (similarity >= 65) {
        confidence = similarity;
        reason = `High similarity (${similarity}%) with pattern "${policy.questionPattern}"`;
      }

      // Specific Policy Priority (e.g. APP/SERVICE > GLOBAL)
      if (policy.scopeType !== 'GLOBAL') {
        confidence += 5;
      }

      if (confidence >= 65 && confidence > highestScore) {
        highestScore = confidence;
        bestMatch = {
          policy,
          confidence: Math.min(confidence, 100),
          matchReason: reason,
        };
      }
    }

    return bestMatch;
  } catch (err) {
    console.warn('[NegativePolicyService] Error matching negative policy:', err);
    return null;
  }
}

/**
 * 4. Chỉnh sửa Negative Policy (Update with version diff)
 */
export async function updateNegativePolicy(
  policyId: string,
  patch: { answer?: string; reason?: string; scopeValue?: string },
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');

  try {
    const policies = await getNegativePolicies();
    const existing = policies.find((p) => p.id === policyId);
    if (!existing) return { success: false, error: 'Không tìm thấy Negative Policy cần sửa.' };

    const before = { answer: existing.answer, reason: existing.reason, scopeValue: existing.scopeValue };
    const after = {
      answer: patch.answer ? sanitizeQueryText(patch.answer).trim() : existing.answer,
      reason: patch.reason ? sanitizeQueryText(patch.reason).trim() : existing.reason,
      scopeValue: patch.scopeValue ? sanitizeQueryText(patch.scopeValue).toLowerCase().trim() : existing.scopeValue,
    };

    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'NEGATIVE_POLICY_UPDATED',
        user_id: adminUserId,
        intent: 'NEGATIVE_POLICY_UPDATE',
        metadata: {
          policyId,
          adminUserId,
          before,
          after,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    clearNegativePolicyCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi khi cập nhật Negative Policy' };
  }
}

/**
 * 5. Kích hoạt lại Negative Policy (Reactivate)
 */
export async function activateNegativePolicy(policyId: string, adminUserId: string): Promise<boolean> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');
  try {
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'NEGATIVE_POLICY_ACTIVATED',
        user_id: adminUserId,
        metadata: { policyId, timestamp: new Date().toISOString() },
      },
    ]);
    clearNegativePolicyCache();
    return true;
  } catch (err) {
    console.error('[NegativePolicyService] Error activating policy:', err);
    return false;
  }
}

/**
 * 6. Vô hiệu hóa Negative Policy (Deactivate)
 */
export async function deactivateNegativePolicy(policyId: string, adminUserId: string): Promise<boolean> {
  if (!adminUserId) throw new Error('UNAUTHORIZED: Admin user ID required');
  try {
    await getActiveShopAdapter().storage!.insertAnalyticsEvents!([
      {
        event_type: 'NEGATIVE_POLICY_DEACTIVATED',
        user_id: adminUserId,
        metadata: { policyId, timestamp: new Date().toISOString() },
      },
    ]);
    clearNegativePolicyCache();
    return true;
  } catch (err) {
    console.error('[NegativePolicyService] Error deactivating policy:', err);
    return false;
  }
}

/**
 * 7. Phát hiện xung đột giữa Positive FAQ và Negative Policy (Conflict Detection)
 */
export async function detectPolicyConflict(
  questionOrScope: string,
  providedFaqs?: Array<{ question: string }>
): Promise<{ hasConflict: boolean; conflictingFaq?: string }> {
  try {
    let faqs = providedFaqs;
    if (!faqs) {
      const allFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: true });
      faqs = allFaqs || [];
    }

    const normQ = normalizeText(questionOrScope);

    for (const faq of faqs || []) {
      const sim = calculateQuestionSimilarity(questionOrScope, faq.question);
      if (sim >= 80 || (normQ.length > 5 && normalizeText(faq.question) === normQ)) {
        return { hasConflict: true, conflictingFaq: faq.question };
      }
    }

    return { hasConflict: false };
  } catch (err) {
    console.warn('[NegativePolicyService] Error detecting conflict:', err);
    return { hasConflict: false };
  }
}

/**
 * 8. Thống kê Analytics Negative Policy & Số lượng câu hỏi đã ngăn chặn thành công
 */
export async function getNegativePolicyAnalytics(): Promise<{
  totalPolicies: number;
  activeCount: number;
  inactiveCount: number;
  totalQueriesPrevented: number;
  mostUsed: NegativePolicy[];
}> {
  const all = await getNegativePolicies();
  const activeCount = all.filter((p) => p.status === 'ACTIVE').length;
  const inactiveCount = all.filter((p) => p.status === 'INACTIVE').length;
  const totalQueriesPrevented = all.reduce((sum, p) => sum + (p.usageCount || 0), 0);

  const mostUsed = [...all].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5);

  return {
    totalPolicies: all.length,
    activeCount,
    inactiveCount,
    totalQueriesPrevented,
    mostUsed,
  };
}
