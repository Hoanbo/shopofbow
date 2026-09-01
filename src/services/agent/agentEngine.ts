/**
 * @deprecated ARCHIVE/ROLLBACK-ONLY — PHASE 7.1 STEP 7
 * This file is the LOCAL AGENT ENGINE (BOW Agent V3 monolithic implementation).
 * STATUS: DEPRECATED as production runtime. Preserved as safety rollback path.
 * DO NOT import this file from UI components or production runtime code.
 * Production Agent requests must go through:
 *   src/services/agent/agentHostBridge.ts → @bow/agent
 */
import type { AgentContext, AgentMessage, AgentAction, PlanItemResult } from './types';

import { resolveMultiIntent, detectPluralDiscoveryIntent, extractDuration, matchPlanByDuration, isAmbiguousDemandQuery, normalizeText } from './intentResolver';
import { sanitizeQueryText } from './monitoring/demandAggregator';
import { resolveProductQuery } from './productResolver';
import { resolveCategoryQuery, getAllCategories } from './categoryResolver';
import {
  getSessionContext,
  rememberProductContext,
  rememberRecommendedCandidates,
  rememberOrderContext,
  rememberCategoryContext,
  rememberDeferredContext,
  clearDeferredContext,
  clearSessionContext,
} from './sessionContext';
import {
  planCheckoutAction,
  planRenewalAction,
  planSupportTicketAction,
  planTicketDetailAction,
  planCreateTicketAction,
  planApplyCouponAction,
  planDepositAction,
  planOrderDetailAction,
  planMultipleCheckoutActions,
  findRelevantWarrantyOrder,
} from './actionPlanner';
import {
  formatSingleProductResponse,
  formatCatalogOverviewResponse,
  formatCategoryDetailResponse,
  formatCompactOrdersResponse,
} from './responseFormatter';
import {
  searchProducts,
  getMyOrders,
  getMyTickets,
  checkWarrantyPolicy,
  getActiveCoupons,
  getMyWalletBalance,
  getFaqsAndGuides,
  getSupportChannels,
} from './tools';

import { agentAnalytics, normalizeUserDemand } from './monitoring/agentAnalytics';
import { processAgentMessageWithGemini, resetGeminiHistory } from './gemini/geminiClient';
import { isGeminiConfigured } from './gemini/config';
import {
  classifyKnowledgeGap,
  extractKnowledgeGapMetadata,
  normalizeKnowledgeQuestion,
  deduplicateKnowledgeGaps,
  isKnowledgeGapCandidate,
} from './knowledge/knowledgeGapDetector';
import { aggregateKnowledgeGapEvents } from './knowledge/knowledgeGapAggregator';
import { matchNegativePolicy } from './knowledge/negativePolicyService';
import type { ResponseSource } from './monitoring/analyticsTypes';
import { isCircuitOpen, recordExecutionSuccess, recordExecutionFailure } from './production/productionCircuitBreaker';
import { shouldRouteToV3, getRolloutState } from './production/productionRolloutService';
import { recordProductionMetric } from './production/productionTelemetryService';

export * from './types';
export { resetGeminiHistory };
export { validateAction, validateAgentAction } from './actionValidator';
export { extractDuration, matchPlanByDuration, resolveMultiIntent, resolveAgentIntent, isAmbiguousDemandQuery } from './intentResolver';
export { resetPlanContext } from './sessionContext';
export {
  classifyKnowledgeGap,
  extractKnowledgeGapMetadata,
  normalizeKnowledgeQuestion,
  deduplicateKnowledgeGaps,
  isKnowledgeGapCandidate,
  aggregateKnowledgeGapEvents,
};
function findPlanByDuration(plans: PlanItemResult[], requestedDuration: string): PlanItemResult | undefined {
  const normalize = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  const requested = normalize(requestedDuration);
  const equivalents: Record<string, string[]> = {
    '6 thang': ['6 thang', '180 ngay', 'nua nam'],
    '1 nam': ['1 nam', '12 thang', '365 ngay', 'ca nam'],
    '3 thang': ['3 thang', '90 ngay', '1 quy'],
    '1 thang': ['1 thang', '30 ngay'],
    '1 tuan': ['1 tuan', '7 ngay'],
  };
  const terms = equivalents[requested] || [requested];

  return plans.find((plan) => {
    const planText = normalize(`${plan.name} ${plan.duration}`);
    return terms.some((term) => planText.includes(term));
  });
}

/**
 * BOW AGENT V3 — Master Orchestrator
 * Pipeline:
 * 1. Try V3 Gemini Brain (NLU, Multi-turn context, Safe Tool Calling)
 * 2. If Gemini unavailable, rate-limited, or timed out -> Auto-fallback to V2 Deterministic Engine
 * 3. Asynchronously record per-turn observability and knowledge gap candidates
 */
export async function processAgentMessage(
  userText: string,
  context: AgentContext
): Promise<AgentMessage> {
  const startTime = Date.now();
  let responseSource: ResponseSource = 'DETERMINISTIC';
  let geminiUsed = false;
  let geminiFallback = false;
  let finalMessage: AgentMessage | undefined;

  // Check if Gemini is configured, circuit breaker is closed, and rollout permits V3
  const circuitOpen = isCircuitOpen();
  const allowV3 = shouldRouteToV3(context.userId || userText);

  if (isGeminiConfigured() && !circuitOpen && allowV3) {
    try {
      const v3Result = await processAgentMessageWithGemini(userText, context);
      if (v3Result.success && v3Result.message) {
        geminiUsed = true;
        responseSource = 'GEMINI';
        finalMessage = v3Result.message;
        recordExecutionSuccess();
      } else {
        // If V3 did not succeed, record fallback event and proceed to V2
        geminiFallback = true;
        responseSource = 'GEMINI_FALLBACK_V2';
        recordExecutionFailure(v3Result.error?.message || 'V3_UNAVAILABLE');
        agentAnalytics.track({
          eventType: 'GEMINI_FALLBACK',
          sessionId: getSessionContext().updatedAt.toString(),
          userId: context.userId,
          reason: v3Result.error?.message || String(v3Result.error || 'V3_UNAVAILABLE'),
        });
      }
    } catch (err: any) {
      geminiFallback = true;
      responseSource = 'GEMINI_FALLBACK_V2';
      recordExecutionFailure(err.message || 'V3_UNEXPECTED_ERROR');
      agentAnalytics.track({
        eventType: 'GEMINI_FALLBACK',
        sessionId: getSessionContext().updatedAt.toString(),
        userId: context.userId,
        reason: err.message || 'V3_UNEXPECTED_ERROR',
      });
    }
  }

  // Fallback to V2 Deterministic Engine
  if (!finalMessage) {
    finalMessage = await processAgentMessageV2(userText, context);
    if (!geminiFallback && finalMessage) {
      if (finalMessage.data?.type === 'faq') {
        responseSource = 'FAQ';
      } else if (finalMessage.data?.type === 'negative_policy') {
        responseSource = 'NEGATIVE_POLICY';
      } else {
        responseSource = 'DETERMINISTIC';
      }
    }
  }

  // Phase 6.0 & 6.6: Asynchronous Observability & Knowledge Gap Detection (Non-blocking)
  const latencyMs = Date.now() - startTime;
  const sessionId = getSessionContext().updatedAt.toString();

  Promise.resolve().then(() => {
    try {
      const isNegPolicy = responseSource === 'NEGATIVE_POLICY' || finalMessage?.data?.type === 'negative_policy';
      const classification = classifyKnowledgeGap(
        userText,
        finalMessage?.data?.type || null,
        finalMessage?.data?.candidates?.length || 0,
        responseSource === 'FAQ' ? 1 : 0,
        isNegPolicy
      );
      const isKnowledgeGap = classification === 'KNOWLEDGE_GAP';
      const isProductDemand = classification === 'PRODUCT_DEMAND';
      const isTransactional = classification === 'TRANSACTIONAL';
      const isSafe = classification !== 'SECURITY_SENSITIVE';

      // 1. Record Observability Metric
      agentAnalytics.track({
        eventType: 'OBSERVABILITY_RECORDED',
        sessionId,
        userId: context.userId,
        metadata: {
          intent: finalMessage?.data?.type || 'UNKNOWN',
          responseSource,
          latencyMs,
          geminiUsed,
          geminiFallback,
          faqHit: responseSource === 'FAQ',
          isKnowledgeGap,
          isProductDemand,
          isTransactional,
          isSafe,
          candidateCount: finalMessage?.data?.candidates?.length || 0,
          actionCount: (finalMessage?.action ? 1 : 0) + (finalMessage?.actions?.length || 0),
        },
      });

      // 2. Record Knowledge Gap Candidate if detected
      if (isKnowledgeGap && isSafe) {
        const gapMeta = extractKnowledgeGapMetadata(userText, finalMessage?.data?.type || null, responseSource);
        if (gapMeta) {
          agentAnalytics.track({
            eventType: 'KNOWLEDGE_GAP_DETECTED',
            sessionId,
            userId: context.userId,
            metadata: gapMeta as any,
          });
        }
      }

      // 3. Phase 6.2: Record FAQ_USED Feedback Event if official FAQ was served
      if (responseSource === 'FAQ' || finalMessage?.data?.type === 'faq' || classification === 'SUPPORTED_FAQ') {
        agentAnalytics.track({
          eventType: 'FAQ_USED',
          sessionId,
          userId: context.userId,
          metadata: {
            query: sanitizeQueryText(userText),
            normalizedQuery: normalizeText(userText),
            responseSource,
            latencyMs,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // 4. Phase 6.6: Record NEGATIVE_POLICY_MATCHED Feedback Event if negative policy was served
      if (isNegPolicy || classification === 'SUPPORTED_NEGATIVE_POLICY') {
        agentAnalytics.track({
          eventType: 'NEGATIVE_POLICY_MATCHED',
          sessionId,
          userId: context.userId,
          metadata: {
            policyId: (finalMessage?.data as any)?.policy?.id,
            query: sanitizeQueryText(userText),
            normalizedQuery: normalizeText(userText),
            responseSource,
            latencyMs,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // 5. Phase 7.0: Record Production Telemetry Metric (0ms synchronous cost)
      recordProductionMetric({
        route: responseSource,
        intent: finalMessage?.data?.type || 'GENERAL',
        latencyMs,
        success: !!finalMessage,
        errorType: geminiFallback ? 'V3_FALLBACK' : undefined,
        fallbackUsed: geminiFallback || responseSource === 'GEMINI_FALLBACK_V2',
        knowledgeHit: responseSource === 'FAQ' || classification === 'SUPPORTED_FAQ',
        negativePolicyHit: isNegPolicy || classification === 'SUPPORTED_NEGATIVE_POLICY',
        transactionBoundaryHit: isTransactional,
        warrantyBoundaryHit: finalMessage?.data?.type === 'warranty' || (finalMessage?.content || '').includes('Bảo hành'),
        productDemandHit: isProductDemand,
        rawQuery: userText,
        rolloutStage: getRolloutState().currentStage,
      });
    } catch {
      // Ignored intentionally to maintain fail-silent invariant
    }
  });

  return finalMessage;
}

/**
 * BOW AGENT V2 — Deterministic Engine (Tool Execution + Action Planning)
 */
export async function processAgentMessageV2(
  userText: string,
  context: AgentContext
): Promise<AgentMessage> {
  const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const timestamp = new Date().toISOString();
  let sessionCtx = getSessionContext();

  // --------------------------------------------------------------------------
  // 0. MESSAGE_RECEIVED
  // --------------------------------------------------------------------------
  agentAnalytics.track({
    eventType: 'MESSAGE_RECEIVED',
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
    metadata: { query: userText.slice(0, 200) }
  });

  const lowerText = userText.toLowerCase().trim();
  const resetKeywords = ['/reset', 'reset chat', 'reset phiên', 'xóa ngữ cảnh', 'bắt đầu lại từ đầu', 'làm mới phiên chat'];
  if (resetKeywords.some(kw => lowerText === kw || lowerText.includes(kw))) {
    clearSessionContext();
    resetGeminiHistory();
    sessionCtx = getSessionContext();

    agentAnalytics.track({
      eventType: 'SESSION_RESET',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });

    return {
      id,
      sender: 'agent',
      content: `🔄 Mình đã làm mới cuộc hội thoại.\n\nBạn cần hỗ trợ tìm sản phẩm, xem bảng giá hay tra cứu đơn hàng nào?`,
      timestamp,
      suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng'],
    };
  }

  // V3.3 Phase 4.5: Nhận diện nhu cầu mơ hồ (AMBIGUOUS Demand State) mạnh mẽ và toàn diện
  const isAmbiguousQuery = isAmbiguousDemandQuery(userText);

  if (isAmbiguousQuery) {
    const demandMeta = normalizeUserDemand(userText, [], true);
    agentAnalytics.track({
      eventType: 'CLARIFICATION_REQUESTED',
      intent: 'AMBIGUOUS_DEMAND',
      reason: 'AMBIGUOUS_QUERY',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
      metadata: demandMeta as any,
    });

    return {
      id,
      sender: 'agent',
      content: '❓ **Bạn muốn dùng AI để làm việc gì cụ thể?**\n\nVí dụ: Tạo ảnh, làm video, viết nội dung/code, dịch thuật hay học tập để mình tư vấn gói phù hợp nhất nhé!',
      timestamp,
      suggestions: ['🎬 Làm video AI', '🎨 Vẽ & Tạo ảnh', '💻 Lập trình & Code', '🎵 Nghe nhạc & Xem phim'],
    };
  }

  // 1. Phân loại Multi-Intent có hiểu ngữ cảnh
  const multiIntent = resolveMultiIntent(userText);
  let intent = multiIntent.primaryIntent;

  // V3.3 Phase 4.2 — Plural Discovery: detect if user wants a list of products
  // Must be computed from rawQuery before cleanQueryTokens strips plural markers
  const isPluralDiscovery = detectPluralDiscoveryIntent(userText);

  agentAnalytics.track({
    eventType: 'INTENT_RESOLVED',
    intent,
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
  });

  // Production-Safe Debug Logging (DEV Only - Zero exposure of userInput/role/session in prod)
  if (Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV)) {
    console.debug('[BOW Agent DEV]', {
      intent,
      secondary: multiIntent.secondaryIntents,
      hasDeferred: !!multiIntent.deferredContext,
      hasSavedDeferred: !!sessionCtx.deferredContext,
      isPluralDiscovery,
    });
  }

  // --------------------------------------------------------------------------
  // 0a. INTENT: GREETING (Chào hỏi tự nhiên)
  // --------------------------------------------------------------------------
  if (intent === 'GREETING') {
    const greetingName = context.fullName ? `, ${context.fullName}` : '';
    const prodRes = await searchProducts({ limit: 4 });
    const topProds = (prodRes.data || []).slice(0, 3);
    const prodSuggestions = topProds.map((p) => p.name);

    let msg = `👋 **Chào bạn${greetingName}!** Mình là Trợ lý Ảo Shop of BOW.\n\nMình có thể hỗ trợ bạn:\n`;
    msg += `• 🛍️ Tra cứu giá & mua tài khoản bản quyền (AI, Thiết kế, Giải trí, Học tập...)\n`;
    msg += `• 📦 Kiểm tra đơn hàng & thời hạn sử dụng\n`;
    msg += `• 💳 Tra cứu số dư & nạp ví tự động 1-Click\n`;
    msg += `• 🎫 Hỗ trợ kỹ thuật & bảo hành 24/7\n\n`;
    msg += `Bạn đang quan tâm đến gói dịch vụ nào hôm nay? ✨`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: prodSuggestions.length > 0 ? [...prodSuggestions, '🛍️ Xem danh mục'] : ['🛍️ Xem danh mục', '💳 Số dư ví', '🎟️ Mã giảm giá'],
    };
  }

  // --------------------------------------------------------------------------
  // 0b. INTENT: SMALL_TALK & CONTEXTUAL FOLLOW-UPS (Cảm ơn, Xác nhận "có", Hủy "thôi")
  // --------------------------------------------------------------------------
  if (intent === 'SMALL_TALK') {
    const cleanLower = userText.toLowerCase().trim();

    // 1. Nhánh HỦY / TỪ CHỐI ("thôi", "không mua nữa", "hủy")
    if (
      cleanLower === 'thôi' ||
      cleanLower === 'thôi không cần' ||
      cleanLower === 'không cần nữa' ||
      cleanLower === 'thôi không mua nữa' ||
      cleanLower === 'không mua nữa' ||
      cleanLower === 'hủy' ||
      cleanLower === 'bỏ qua' ||
      cleanLower.startsWith('thôi') ||
      cleanLower.startsWith('không cần')
    ) {
      if (sessionCtx.deferredContext) {
        clearDeferredContext();
      }
      return {
        id,
        sender: 'agent',
        content: `👌 **Đã ghi nhận!** Mình đã hủy yêu cầu vừa rồi. Bạn có muốn tra cứu thông tin hay sản phẩm gì khác không? ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '📦 Xem tất cả đơn', '💳 Số dư ví'],
      };
    }

    // 2. Nhánh TIẾP TỤC / ĐỒNG Ý ("có", "tiếp tục", "mua đi", "ừ", "ok") KHI CÓ DEFERRED BUY CONTEXT
    const isAffirmative =
      cleanLower === 'có' ||
      cleanLower === 'có chứ' ||
      cleanLower === 'tiếp tục' ||
      cleanLower === 'mua đi' ||
      cleanLower === 'mua luôn' ||
      cleanLower === 'mua luôn đi' ||
      cleanLower === 'chốt' ||
      cleanLower === 'chốt luôn' ||
      cleanLower === 'đồng ý' ||
      cleanLower === 'ừ' ||
      cleanLower === 'uhm' ||
      cleanLower === 'ok' ||
      cleanLower === 'oke' ||
      cleanLower === 'oki' ||
      cleanLower === 'được' ||
      cleanLower === 'được nhé' ||
      cleanLower.startsWith('có ');

    if (isAffirmative && sessionCtx.deferredContext && sessionCtx.deferredContext.intent === 'BUY') {
      const deferred = sessionCtx.deferredContext;
      clearDeferredContext();

      const prodName = deferred.productName || sessionCtx.lastMentionedProduct?.name;

      if (prodName) {
        const resolution = await resolveProductQuery(prodName);
        const productToBuy = resolution.candidate || sessionCtx.lastMentionedProduct;

        if (productToBuy) {
          const activePlans = productToBuy.plans || [];
          let targetPlan = undefined;

          if (deferred.duration) {
            targetPlan = findPlanByDuration(activePlans, deferred.duration);
          }

          if (!targetPlan && activePlans.length === 1) {
            targetPlan = activePlans[0];
          }

          if (targetPlan) {
            rememberProductContext(productToBuy, targetPlan);
            const action = planCheckoutAction(productToBuy, targetPlan, context);
            const msg = formatSingleProductResponse(productToBuy, targetPlan);

            return {
              id,
              sender: 'agent',
              content: msg,
              timestamp,
              data: { type: 'buy_checkout', product: productToBuy, plan: targetPlan },
              action: action || undefined,
              suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
            };
          } else if (activePlans.length > 0) {
            rememberProductContext(productToBuy, undefined);
            const multipleActions = planMultipleCheckoutActions(productToBuy, activePlans, context);
            const msg = formatSingleProductResponse(productToBuy, undefined);

            return {
              id,
              sender: 'agent',
              content: msg,
              timestamp,
              data: { type: 'buy_checkout_selection', product: productToBuy },
              actions: multipleActions,
              suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
            };
          }
        }
      }

      // Case: Có duration nhưng chưa biết product (Case 4: user hỏi "mua 6 tháng nhưng kiểm tra ví..." -> "có")
      const prodRes = await searchProducts({ limit: 4 });
      const sampleProducts = prodRes.data || [];
      const sampleNames = sampleProducts.map((p) => p.name);

      const durLabel = deferred.duration ? `gói **${deferred.duration}**` : 'gói dịch vụ này';
      return {
        id,
        sender: 'agent',
        content: `🤔 **Bạn muốn mua ${durLabel} của sản phẩm nào?**\n\nBạn hãy nhập tên sản phẩm hoặc chọn một trong các gợi ý bên dưới để mình mở giao diện mua ngay nhé:`,
        timestamp,
        suggestions: sampleNames.length > 0 ? [...sampleNames.slice(0, 3), '🛍️ Xem danh mục'] : ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }

    // 3. Các câu Cảm ơn
    if (cleanLower.includes('cảm ơn') || cleanLower.includes('thank') || cleanLower.includes('tks') || cleanLower.includes('cmon')) {
      return {
        id,
        sender: 'agent',
        content: `😊 **Rất vui được hỗ trợ bạn!**\n\nNếu bạn cần thêm thông tin về bất kỳ gói dịch vụ hay đơn hàng nào, cứ nhắn mình bất cứ lúc nào nhé! ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
      };
    }

    // 4. Các câu Xác nhận thông thường
    if (
      cleanLower.startsWith('ok') ||
      cleanLower.startsWith('oke') ||
      cleanLower.startsWith('oki') ||
      cleanLower.includes('được') ||
      cleanLower.includes('hiểu rồi') ||
      cleanLower.includes('vâng') ||
      cleanLower.includes('rồi nhé')
    ) {
      return {
        id,
        sender: 'agent',
        content: `👍 **Tuyệt vời!** Bạn muốn mình hỗ trợ thêm điều gì tiếp theo không?`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '💳 Số dư ví', '🎟️ Mã giảm giá'],
      };
    }

    // 5. Tạm biệt
    if (cleanLower.includes('tạm biệt') || cleanLower.includes('bye') || cleanLower.includes('hẹn gặp lại')) {
      return {
        id,
        sender: 'agent',
        content: `👋 **Tạm biệt bạn!** Chúc bạn một ngày làm việc và học tập thật hiệu quả. Khi nào cần mua hoặc bảo hành tài khoản, hãy quay lại Shop of BOW nhé! 🌟`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục'],
      };
    }

    // 6. Danh tính Bot
    if (cleanLower.includes('bạn là ai') || cleanLower.includes('bạn tên gì') || cleanLower.includes('bot là ai')) {
      return {
        id,
        sender: 'agent',
        content: `🤖 **Mình là Trợ lý Ảo AI của Shop of BOW!**\n\nNhiệm vụ của mình là giúp bạn tìm kiếm tài khoản, kiểm tra giá, mở thanh toán trực tiếp, theo dõi đơn hàng và hỗ trợ kỹ thuật nhanh chóng nhất.`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'bạn có thể làm gì?', 'Gặp hỗ trợ viên'],
      };
    }

    return {
      id,
      sender: 'agent',
      content: `Dạ vâng! Mình luôn ở đây sẵn sàng hỗ trợ bạn. Bạn cần tư vấn sản phẩm hay tra cứu đơn hàng nào không? ✨`,
      timestamp,
      suggestions: ['🛍️ Xem danh mục', '📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
    };
  }


  // --------------------------------------------------------------------------
  // 0c. INTENT: CAPABILITY_DISCOVERY (Khám phá năng lực của Agent)
  // --------------------------------------------------------------------------
  if (intent === 'CAPABILITY_DISCOVERY') {
    const prodRes = await searchProducts({ limit: 4 });
    const topProds = prodRes.data || [];
    const prodSuggestions = topProds.slice(0, 3).map((p) => p.name);

    let msg = `✨ **Các tiện ích mình có thể hỗ trợ bạn tại Shop of BOW:**\n\n`;
    msg += `1. 🛍️ **Tìm & Mua tài khoản:** Nhập tên app (VD: *"ChatGPT"*, *"Canva"*, *"YouTube"*) để xem bảng giá và mở thanh toán trực tiếp.\n`;
    msg += `2. 📦 **Quản lý đơn hàng:** Gõ *"kiểm tra đơn hàng"* để xem thông tin tài khoản đã mua.\n`;
    msg += `3. ⏳ **Nhắc gia hạn:** Gõ *"sản phẩm sắp hết hạn"* để kiểm tra và gia hạn tài khoản kịp thời.\n`;
    msg += `4. 💳 **Ví thanh toán:** Gõ *"số dư ví"* hoặc *"nạp 100k"* để nạp tiền tự động qua VietQR.\n`;
    msg += `5. 🎫 **Hỗ trợ & Bảo hành:** Gõ *"bảo hành"* hoặc *"ticket của tôi"* để gửi yêu cầu cho kỹ thuật viên.\n`;
    msg += `6. 🎟️ **Mã giảm giá:** Gõ *"mã giảm giá hôm nay"* để săn ưu đãi hot nhất.\n\n`;
    msg += `Bạn có thể bấm vào các gợi ý bên dưới hoặc gõ trực tiếp câu hỏi nhé! 👇`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: prodSuggestions.length > 0 ? [...prodSuggestions, '🛍️ Xem danh mục'] : ['🛍️ Xem danh mục', '💳 Số dư ví', '🎟️ Mã giảm giá'],
    };
  }

  // --------------------------------------------------------------------------
  // 1. INTENT: CATALOG (Xem tổng quan danh mục sản phẩm)
  // --------------------------------------------------------------------------
  if (intent === 'CATALOG') {
    // V3.3 Phase 4.3 Guard: PRODUCT_DISCOVERY ≠ SHOP_OVERVIEW
    // Nếu câu hỏi chứa năng lực (vd "có app nào xem phim không?", "nghe nhạc", "code") hoặc mang tính khám phá plural,
    // tuyệt đối không chuyển thành shop overview mà chuyển thẳng sang Product Discovery.
    const isCapabilityQuery =
      detectPluralDiscoveryIntent(userText) ||
      /(?:xem phim|nghe nhạc|dựng video|học tiếng anh|code|lập trình|thiết kế|đồ họa|ai|vpn|bản quyền|lưu trữ|văn phòng|tạo ảnh|làm video|dịch thuật|chụp ảnh|giải trí)/i.test(userText);

    if (!isCapabilityQuery) {
      const [prodRes, categories] = await Promise.all([
        searchProducts({}),
        getAllCategories(),
      ]);
      const products = prodRes.data || [];
      const overview = formatCatalogOverviewResponse(products, categories);

      return {
        id,
        sender: 'agent',
        content: overview.content,
        timestamp,
        data: { type: 'catalog_overview', products },
        suggestions: overview.suggestions,
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. INTENT: VIEW_CATEGORY (Xem chi tiết một danh mục cụ thể)
  // --------------------------------------------------------------------------
  if (intent === 'VIEW_CATEGORY') {
    const categoryMatch = await resolveCategoryQuery(userText);
    if (categoryMatch.matched && categoryMatch.category) {
      const cat = categoryMatch.category;
      rememberCategoryContext(cat);
      const prodRes = await searchProducts({ categoryId: cat.id });
      const products = prodRes.data || [];
      const formatted = formatCategoryDetailResponse(cat, products);

      return {
        id,
        sender: 'agent',
        content: formatted.content,
        timestamp,
        data: { type: 'category_detail', categoryId: cat.id, products },
        suggestions: formatted.suggestions,
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. INTENT: BUY (Mua hàng trực tiếp kèm Action Card)
  // --------------------------------------------------------------------------
  if (intent === 'BUY') {
    const resolution = await resolveProductQuery(userText);
    let productToBuy = resolution.candidate;
    let planToBuy = undefined;

    if (!productToBuy && sessionCtx.lastMentionedProduct) {
      productToBuy = sessionCtx.lastMentionedProduct;
    }

    if (productToBuy) {
      agentAnalytics.track({
        eventType: 'PRODUCT_RESOLVED',
        intent,
        productId: productToBuy.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      // Lấy danh sách các gói đang active
      let activePlans = productToBuy.plans || [];

      // Lọc gói khác nếu yêu cầu
      if (resolution.extractedParams.isOtherPlanQuery && sessionCtx.lastMentionedPlan) {
        activePlans = activePlans.filter(p => p.id !== sessionCtx.lastMentionedPlan!.id);
      }

      // Nhận diện Plan dựa trên từ khóa thời hạn (Regex bóc tách đa tháng: 6 tháng, 12 tháng, 1 năm...)
      // Nhận diện Plan dựa trên từ khóa thời hạn
      const requestedDuration =
        resolution.extractedParams.durationFilter ||
        extractDuration(userText) ||
        multiIntent.deferredContext?.duration;

      if (requestedDuration) {
        planToBuy = matchPlanByDuration(activePlans, requestedDuration, userText);
      }

      if (!planToBuy && resolution.extractedParams.isCheapestQuery && activePlans.length > 0) {
        planToBuy = [...activePlans].sort((a, b) => a.price - b.price)[0];
      }
      if (!planToBuy && resolution.extractedParams.isMostExpensiveQuery && activePlans.length > 0) {
        planToBuy = [...activePlans].sort((a, b) => b.price - a.price)[0];
      }

      if (!planToBuy && sessionCtx.lastMentionedPlan && !resolution.extractedParams.isOtherPlanQuery) {
        // Kiểm tra xem lastMentionedPlan có thuộc product này không và productSlug trùng khớp
        const isSameProduct = sessionCtx.productSlug ? sessionCtx.productSlug === productToBuy.slug : (sessionCtx.lastMentionedProduct?.id === productToBuy.id);
        if (isSameProduct && activePlans.some(p => p.id === sessionCtx.lastMentionedPlan!.id)) {
          planToBuy = sessionCtx.lastMentionedPlan;
        }
      }

      // Xử lý Global Rule PRODUCT != PLAN
      if (!planToBuy) {
        if (activePlans.length === 1) {
          planToBuy = activePlans[0];
        } else if (activePlans.length === 0) {
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Sản phẩm ${productToBuy.name} hiện tại chưa có gói dịch vụ nào khả dụng.**\n\nBạn vui lòng quay lại sau hoặc tham khảo các sản phẩm khác nhé!`,
            timestamp,
            suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
          };
        } else {
          // Có nhiều Plan -> Yêu cầu người dùng chọn
          agentAnalytics.track({
            eventType: 'PLAN_UNRESOLVED',
            intent,
            productId: productToBuy.id,
            reason: 'MULTIPLE_PLANS_AVAILABLE',
            sessionId: sessionCtx.updatedAt.toString(),
            userId: context.userId,
          });
          agentAnalytics.track({
            eventType: 'CLARIFICATION_REQUESTED',
            intent,
            productId: productToBuy.id,
            reason: 'MULTIPLE_PLANS_AVAILABLE',
            sessionId: sessionCtx.updatedAt.toString(),
            userId: context.userId,
          });

          rememberProductContext(productToBuy, undefined);
          const multipleActions = planMultipleCheckoutActions(productToBuy, activePlans, context);
          const msg = formatSingleProductResponse(productToBuy, undefined);

          return {
            id,
            sender: 'agent',
            content: msg,
            timestamp,
            data: { type: 'buy_checkout_selection', product: productToBuy },
            actions: multipleActions,
            suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
          };
        }
      }

      // Đã có Product và Plan -> Sinh Quick Buy duy nhất
      agentAnalytics.track({
        eventType: 'PLAN_RESOLVED',
        intent,
        productId: productToBuy.id,
        planId: planToBuy.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      rememberProductContext(productToBuy, planToBuy);
      const action = planCheckoutAction(productToBuy, planToBuy, context);
      const msg = formatSingleProductResponse(productToBuy, planToBuy);

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        data: { type: 'buy_checkout', product: productToBuy, plan: planToBuy },
        action: action || undefined,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
      };
    } else {
      // Intent BUY nhưng không có Product nào được xác định rõ
      agentAnalytics.track({
        eventType: 'PRODUCT_UNRESOLVED',
        intent,
        reason: 'PRODUCT_NOT_FOUND',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });

      const prodRes = await searchProducts({ limit: 4 });
      const sampleProducts = prodRes.data || [];
      const sampleNames = sampleProducts.map((p) => p.name);

      const durText = resolution.extractedParams.durationFilter;
      let askMsg = durText
        ? `🤔 **Bạn muốn mua gói ${durText} của sản phẩm nào?**\n\nBạn hãy nhập tên sản phẩm hoặc chọn một trong các gợi ý bên dưới để mình mở giao diện mua ngay nhé:`
        : `🤔 **Bạn muốn mua sản phẩm/gói nào?**\n\nBạn hãy nhập tên sản phẩm hoặc chọn từ danh mục bên dưới để mình kiểm tra giá nhé:`;

      return {
        id,
        sender: 'agent',
        content: askMsg,
        timestamp,
        suggestions: sampleNames.length > 0 ? [...sampleNames.slice(0, 3), '🛍️ Xem danh mục'] : ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3b. INTENT: EXPIRING_SOON (Tra cứu sản phẩm/gói của user sắp hết hạn)
  // --------------------------------------------------------------------------
  if (intent === 'EXPIRING_SOON') {
    if (multiIntent.deferredContext) {
      rememberDeferredContext(multiIntent.deferredContext);
    }

    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để kiểm tra thời hạn sản phẩm!**\n\nVui lòng [Đăng nhập](/login) để hệ thống kiểm tra các gói tài khoản bạn đang sở hữu nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục'],
      };
    }

    const res = await getMyOrders({ status: 'completed', limit: 50 }, context);
    if (!res.success) {
      return {
        id,
        sender: 'agent',
        content: `⚠️ **Hiện tại mình chưa thể kiểm tra thời hạn sản phẩm của bạn.**\n\nBạn vui lòng thử lại sau hoặc truy cập [Quản lý Đơn hàng](/dashboard?tab=orders) nhé!`,
        timestamp,
        suggestions: ['📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
      };
    }

    const orders = res.data || [];
    if (orders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `📦 **Hiện tại bạn chưa có sản phẩm hoặc gói tài khoản nào đang hoạt động.**`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
      };
    }

    const nowMs = Date.now();
    const expiringOrders: Array<{ order: any; diffDays: number; expiresAtMs: number; daysText: string }> = [];

    for (const order of orders) {
      if (order.status !== 'completed') continue;

      let durationDays = 30;
      const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${order.notes || ''}`.toLowerCase();
      const monthMatch = planStr.match(/(\d+)\s*(tháng|thang|month|months|m)/);
      if (monthMatch) {
        durationDays = parseInt(monthMatch[1], 10) * 30;
      } else {
        const yearMatch = planStr.match(/(\d+)\s*(năm|nam|year|years|y)/);
        if (yearMatch) {
          durationDays = parseInt(yearMatch[1], 10) * 365;
        } else {
          const dayMatch = planStr.match(/(\d+)\s*(ngày|ngay|day|days)/);
          if (dayMatch) {
            durationDays = parseInt(dayMatch[1], 10);
          }
        }
      }

      const createdAtMs = new Date(order.created_at).getTime();
      const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
      const diffMs = expiresAtMs - nowMs;
      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      // Quy tắc sắp hết hạn của BOW: còn từ 1 đến 7 ngày và chưa quá hạn
      if (diffMs > 0 && diffDays <= 7) {
        expiringOrders.push({
          order,
          diffDays,
          expiresAtMs,
          daysText: `Hết hạn: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
        });
      }
    }

    if (expiringOrders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `✅ **Hiện tại bạn không có sản phẩm nào sắp hết hạn.**\n\nTất cả các dịch vụ và gói tài khoản của bạn đều đang hoạt động ổn định.`,
        timestamp,
        data: { type: 'expiring_products', expiringOrders: [] },
        suggestions: ['📦 Xem tất cả đơn', '🛍️ Xem danh mục'],
      };
    }

    if (expiringOrders.length === 1) {
      const item = expiringOrders[0];
      rememberOrderContext(item.order);
      const action = planRenewalAction(item.order, context);

      let msg = `⏳ **Bạn có 1 sản phẩm sắp hết hạn:**\n\n`;
      msg += `• **${item.order.product_name}** (${item.order.plan_label})\n`;
      msg += `  Còn **${item.diffDays} ngày** · ${item.daysText}\n\n`;
      msg += `Bấm nút bên dưới để gia hạn ngay gói dịch vụ:`;

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        data: { type: 'expiring_products', expiringOrders: [item.order] },
        action: action || undefined,
        suggestions: ['📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
      };
    }

    // Nhiều sản phẩm sắp hết hạn
    const actions = expiringOrders
      .map((it) => planRenewalAction(it.order, context))
      .filter((a): a is AgentAction => a !== null);

    let msg = `⏳ **Bạn có ${expiringOrders.length} sản phẩm sắp hết hạn:**\n\n`;
    expiringOrders.forEach((it, idx) => {
      msg += `${idx + 1}. **${it.order.product_name}** (${it.order.plan_label})\n`;
      msg += `   Còn **${it.diffDays} ngày** · ${it.daysText}\n\n`;
    });
    msg += `Bạn có thể chọn gia hạn các gói bên dưới để không bị gián đoạn sử dụng:`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'expiring_products', expiringOrders: expiringOrders.map((it) => it.order) },
      actions: actions.length > 0 ? actions : undefined,
      suggestions: ['📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
    };
  }

  // --------------------------------------------------------------------------
  // 4. INTENT: RENEW (Gia hạn đơn hàng cũ)
  // --------------------------------------------------------------------------
  if (intent === 'RENEW') {
    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để gia hạn đơn hàng!**\n\nVui lòng [Đăng nhập](/login) để hệ thống kiểm tra các gói tài khoản đã mua của bạn nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục'],
      };
    }

    const res = await getMyOrders({ limit: 6 }, context);
    const orders = res.data || [];

    if (orders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `📦 **Bạn chưa có đơn hàng nào trước đây để gia hạn.**\n\nBạn có muốn mình tư vấn một số gói tài khoản hot đang có sẵn không? ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
      };
    }

    const targetOrder = sessionCtx.lastMentionedOrder || orders[0];
    rememberOrderContext(targetOrder);
    const action = planRenewalAction(targetOrder, context);

    let msg = `🔄 **Gia hạn đơn hàng: ${targetOrder.product_name} (${targetOrder.plan_label})**\n\n`;
    msg += `📦 Mã thanh toán: \`${targetOrder.payment_code}\`\n\n`;
    msg += `Bấm **"Gia hạn ngay"** bên dưới để mở giao diện xác nhận gia hạn nhé! 🚀`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'order_renewal', order: targetOrder },
      action: action || undefined,
      suggestions: ['📦 Xem tất cả đơn', '💳 Số dư ví', '🛍️ Xem danh mục'],
    };
  }

  // --------------------------------------------------------------------------
  // 5. INTENT: WARRANTY (Hỗ trợ lỗi / Bảo hành)
  // --------------------------------------------------------------------------
  if (intent === 'WARRANTY') {
    if (multiIntent.deferredContext) {
      rememberDeferredContext(multiIntent.deferredContext);
    }

    if (context.isAuthenticated) {
      const res = await getMyOrders({ limit: 12 }, context);
      const orders = res.data || [];

      // Trích xuất mã đơn hàng nếu người dùng chỉ định rõ (vd: "bảo hành đơn BOW-123456")
      const paymentCodeMatch = userText.match(/\b(BOW-[A-Z0-9_-]{4,25}|[A-Z0-9]{8,16})\b/i);
      const targetCode = paymentCodeMatch ? paymentCodeMatch[1].toUpperCase() : null;

      let relevantOrder = null;
      if (targetCode) {
        relevantOrder = orders.find((o) => o.payment_code?.toUpperCase() === targetCode);
        if (!relevantOrder) {
          // Mã đơn không tồn tại hoặc thuộc tài khoản khác
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Không tìm thấy đơn hàng mã \`${targetCode}\` trong tài khoản của bạn.**\n\nVui lòng kiểm tra lại mã đơn hàng trên trang cá nhân hoặc liên hệ [Zalo Admin](https://zalo.me/0966821315) để được kiểm tra trực tiếp.`,
            timestamp,
            suggestions: ['📦 Xem tất cả đơn', 'Chính sách bảo hành', 'Gặp hỗ trợ viên'],
          };
        }
      } else {
        // Tìm theo sản phẩm được nhắc tới trong câu hoặc đơn hàng gần nhất
        relevantOrder = findRelevantWarrantyOrder(orders, userText, sessionCtx.lastMentionedOrder);
      }

      if (relevantOrder) {
        // V3.3 Phase 4.3: Kiểm tra trạng thái thực tế của đơn hàng từ DB
        const status = relevantOrder.status;

        // 1. Đơn đã hủy -> KHÔNG bảo hành
        if (status === 'cancelled') {
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Đơn hàng ${relevantOrder.product_name} (\`${relevantOrder.payment_code}\`) đã bị hủy (cancelled) nên không thể tạo yêu cầu bảo hành.**\n\nNếu bạn cần hỗ trợ khôi phục hoặc đặt lại đơn hàng, vui lòng nhắn tin trực tiếp [Zalo Admin](https://zalo.me/0966821315) nhé!`,
            timestamp,
            data: { type: 'warranty_rejected', order: relevantOrder, reason: 'ORDER_CANCELLED' },
            suggestions: ['📦 Xem tất cả đơn', '🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
          };
        }

        // 2. Đơn đã hoàn tiền -> KHÔNG bảo hành
        if (status === 'refunded') {
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Đơn hàng ${relevantOrder.product_name} (\`${relevantOrder.payment_code}\`) đã được hoàn tiền (refunded) nên không còn trong phạm vi bảo hành.**\n\nBạn có thể tham khảo mua gói mới nếu vẫn có nhu cầu sử dụng dịch vụ!`,
            timestamp,
            data: { type: 'warranty_rejected', order: relevantOrder, reason: 'ORDER_REFUNDED' },
            suggestions: ['🛍️ Xem danh mục', '📦 Xem tất cả đơn', 'Gặp hỗ trợ viên'],
          };
        }

        // 3. Đơn chưa thanh toán -> Yêu cầu thanh toán trước
        if (status === 'pending_payment') {
          return {
            id,
            sender: 'agent',
            content: `⚠️ **Đơn hàng ${relevantOrder.product_name} (\`${relevantOrder.payment_code}\`) chưa hoàn tất thanh toán (pending_payment).**\n\nVui lòng hoàn tất thanh toán trước khi sử dụng dịch vụ và áp dụng chính sách bảo hành.`,
            timestamp,
            data: { type: 'warranty_rejected', order: relevantOrder, reason: 'PENDING_PAYMENT' },
            suggestions: ['📦 Xem tất cả đơn', '💳 Nạp tiền vào ví', 'Gặp hỗ trợ viên'],
          };
        }

        // 4. Đơn hợp lệ (completed, processing, pending_delivery)
        rememberOrderContext(relevantOrder);
        const action = planSupportTicketAction(relevantOrder, userText, context);

        let msg = `🛠️ **Hỗ trợ bảo hành dịch vụ ${relevantOrder.product_name}:**\n\n`;
        msg += `📦 Đơn hàng liên quan: **${relevantOrder.product_name}** (\`${relevantOrder.payment_code}\`)\n`;
        msg += `⏱️ **Thời gian xử lý:** Từ 5 - 30 phút (Kỹ thuật viên trực 24/7).\n\n`;
        msg += `Bạn có thể bấm **"Gửi yêu cầu bảo hành"** bên dưới để gửi phiếu hỗ trợ kỹ thuật trực tiếp:`;

        return {
          id,
          sender: 'agent',
          content: msg,
          timestamp,
          data: { type: 'warranty_ticket', order: relevantOrder },
          action: action || undefined,
          suggestions: ['Gặp hỗ trợ viên Zalo', '📦 Xem tất cả đơn', 'Chính sách bảo hành'],
        };
      }
    }

    // Khách chưa đăng nhập hoặc chưa có đơn: Hiển thị quy trình bảo hành
    const res = await checkWarrantyPolicy({ productName: userText });
    const policy = res.data;

    let msg = `🛡️ **Chính Sách Bảo Hành Cao Cấp tại Shop of BOW:**\n\n`;
    msg += `✅ **Cam kết 1 ĐỔI 1 hoặc HOÀN TIỀN** nếu phát sinh bất kỳ lỗi kỹ thuật nào từ nhà cung cấp.\n`;
    msg += `⏱️ **Thời gian xử lý:** Từ 5 - 30 phút (Hỗ trợ 24/7).\n\n`;
    msg += `**Quy trình nhận bảo hành:**\n`;
    policy.warrantySteps.forEach((s: string) => {
      msg += `${s}\n`;
    });
    msg += `\n💬 Nhắn ngay [Zalo Admin](https://zalo.me/0966821315) để được hỗ trợ tức thì!`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: ['Đăng nhập để bảo hành', 'Gặp hỗ trợ viên', '🛍️ Xem danh mục'],
    };
  }

  // --------------------------------------------------------------------------
  // 5b. INTENT: TICKET (Tra cứu & Quản lý Ticket hỗ trợ)
  // --------------------------------------------------------------------------
  if (intent === 'TICKET') {
    if (multiIntent.deferredContext) {
      rememberDeferredContext(multiIntent.deferredContext);
    }

    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để kiểm tra phiếu hỗ trợ (Ticket)!**\n\nVui lòng [Đăng nhập](/login) để theo dõi tiến độ xử lý và trao đổi với kỹ thuật viên nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', 'Gặp hỗ trợ viên', 'Chính sách bảo hành'],
      };
    }

    const res = await getMyTickets({ limit: 6 }, context);
    if (!res.success) {
      return {
        id,
        sender: 'agent',
        content: `⚠️ **Hiện tại mình chưa thể tải danh sách phiếu hỗ trợ của bạn.**\n\nBạn vui lòng truy cập [Trung tâm Hỗ trợ](/dashboard?tab=tickets) để theo dõi nhé!`,
        timestamp,
        suggestions: ['Gặp hỗ trợ viên', '📦 Xem tất cả đơn'],
      };
    }

    const tickets = res.data || [];
    if (tickets.length === 0) {
      const createAction = planCreateTicketAction(context);
      return {
        id,
        sender: 'agent',
        content: `🎫 **Bạn hiện chưa có phiếu hỗ trợ nào đang mở.**\n\nNếu tài khoản hoặc đơn hàng của bạn gặp sự cố, bạn có thể bấm nút bên dưới để tạo phiếu hỗ trợ kỹ thuật:`,
        timestamp,
        action: createAction || undefined,
        suggestions: ['📦 Xem tất cả đơn', 'Chính sách bảo hành', 'Gặp hỗ trợ viên Zalo'],
      };
    }

    const statusMap: Record<string, string> = {
      open: '🟢 Đang mở',
      in_progress: '⏳ Đang xử lý',
      pending: '🟡 Chờ phản hồi',
      resolved: '✅ Đã giải quyết',
      closed: '🔒 Đã đóng',
    };

    let msg = `🎫 **Danh sách phiếu hỗ trợ của bạn (${tickets.length} ticket):**\n\n`;
    tickets.forEach((t: any, idx: number) => {
      const st = statusMap[t.status] || t.status;
      const titleStr = t.subject || t.title || `Ticket #${t.ticket_number || idx + 1}`;
      const orderInfo = t.orders?.product_name ? ` · Đơn: **${t.orders.product_name}** (\`${t.orders.payment_code}\`)` : '';
      msg += `${idx + 1}. **${titleStr}**\n   Trạng thái: **${st}**${orderInfo}\n   Cập nhật: ${new Date(t.updated_at || t.created_at).toLocaleDateString('vi-VN')}\n\n`;
    });

    msg += `Bấm nút bên dưới để mở giao diện trao đổi trực tiếp:`;
    const topTicket = tickets[0];
    const ticketAction = planTicketDetailAction(topTicket, context);

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'tickets', tickets },
      action: ticketAction || undefined,
      suggestions: ['🎫 Tạo ticket mới', '📦 Xem tất cả đơn', 'Gặp hỗ trợ viên Zalo'],
    };
  }

  // --------------------------------------------------------------------------
  // 6. INTENT: ORDER_QUERY (Tra cứu đơn hàng)
  // --------------------------------------------------------------------------
  if (intent === 'ORDER_QUERY') {
    if (multiIntent.deferredContext) {
      rememberDeferredContext(multiIntent.deferredContext);
    }

    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `🔒 **Bạn cần đăng nhập để kiểm tra đơn hàng của mình!**\n\nĐể bảo mật thông tin tài khoản và mã bàn giao dịch vụ, bạn vui lòng [Đăng nhập](/login) trước nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục', 'Chính sách bảo hành'],
      };
    }

    const codeMatch = userText.match(/bow-[\w\d]+/i);
    const paymentCode = codeMatch ? codeMatch[0] : undefined;

    const res = await getMyOrders({ paymentCode, limit: 12 }, context);
    if (!res.success) {
      return {
        id,
        sender: 'agent',
        content: `⚠️ **Mình chưa thể tải lịch sử đơn hàng lúc này.**\n\nBạn vui lòng thử lại sau ít phút hoặc mở [Quản lý Đơn hàng](/dashboard?tab=orders) nhé!`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }

    const orders = res.data || [];
    if (orders.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `📦 **Bạn chưa có đơn hàng nào trong hệ thống.**\n\nBạn có thể [Xem danh mục sản phẩm](/products) để chọn gói tài khoản phù hợp nhé! ✨`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay'],
      };
    }

    const compactRes = formatCompactOrdersResponse(orders, userText);
    let orderAction = undefined;
    if (compactRes.topOrder) {
      rememberOrderContext(compactRes.topOrder);
      orderAction = planOrderDetailAction(compactRes.topOrder, context);
    }

    let extraPrompt = '';
    if (multiIntent.deferredContext?.productName) {
      extraPrompt = `\n\n💡 Bạn có muốn tiếp tục mua **${multiIntent.deferredContext.productName}** không?`;
    }

    return {
      id,
      sender: 'agent',
      content: compactRes.content + extraPrompt,
      timestamp,
      data: { type: 'orders', orders },
      action: orderAction || undefined,
      suggestions: multiIntent.deferredContext ? ['Có, tiếp tục mua', 'Thôi', ...compactRes.suggestions] : compactRes.suggestions,
    };
  }

  // --------------------------------------------------------------------------
  // 7. INTENT: WALLET (Số dư & Nạp tiền)
  // --------------------------------------------------------------------------
  if (intent === 'WALLET') {
    if (!context.isAuthenticated) {
      return {
        id,
        sender: 'agent',
        content: `💳 **Bạn cần đăng nhập để kiểm tra số dư ví!**\n\nVui lòng [Đăng nhập](/login) để xem số dư và nạp tiền tự động 1-Click nhé.`,
        timestamp,
        suggestions: ['Đăng nhập ngay', '🛍️ Xem danh mục'],
      };
    }

    const res = await getMyWalletBalance(context);
    const balStr = res.data?.formatted || '0đ';

    // XỬ LÝ MULTI-INTENT: Nếu câu hỏi có yêu cầu BUY đi kèm (VD: "tôi muốn mua 6 tháng nhưng kiểm tra ví giúp tôi")
    if (multiIntent.deferredContext && multiIntent.deferredContext.intent === 'BUY') {
      rememberDeferredContext(multiIntent.deferredContext);

      let prodNamePrompt = '';
      if (multiIntent.deferredContext.productName) {
        const prodMatch = await resolveProductQuery(multiIntent.deferredContext.productName);
        if (prodMatch.candidate) {
          rememberProductContext(prodMatch.candidate);
          prodNamePrompt = prodMatch.candidate.name;
        } else {
          prodNamePrompt = multiIntent.deferredContext.productName;
        }
      }

      let promptMsg = '';
      if (prodNamePrompt && multiIntent.deferredContext.duration) {
        promptMsg = `Bạn có muốn tiếp tục với gói **${prodNamePrompt} (${multiIntent.deferredContext.duration})** không?`;
      } else if (prodNamePrompt) {
        promptMsg = `Bạn có muốn tiếp tục xem bảng giá & mua **${prodNamePrompt}** không?`;
      } else if (multiIntent.deferredContext.duration) {
        promptMsg = `Bạn có muốn tiếp tục chọn mua gói **${multiIntent.deferredContext.duration}** không?`;
      } else {
        promptMsg = `Bạn có muốn tiếp tục chọn gói mua hàng không?`;
      }

      // WALLET-FIRST: Trả về thông tin số dư thực tế, KHÔNG tự ý chọn plan, KHÔNG tạo Action BUY, KHÔNG mở checkout
      return {
        id,
        sender: 'agent',
        content: `💳 **Số dư ví hiện tại của bạn:** **${balStr}**\n\n${promptMsg}`,
        timestamp,
        suggestions: ['Có, tiếp tục mua', 'Thôi không mua nữa', 'Nạp thêm tiền', '🛍️ Xem danh mục'],
      };
    }

    // Luồng nạp tiền: Trích xuất chính xác số tiền nếu user chỉ định (vd: "nạp 10k", "nạp 100.000đ", "50k")
    const amountMatch =
      userText.match(/(?:nạp|nap|topup|top up|\+)\s*(\d+(?:\.\d+)?)\s*(k|nghìn|ngàn|tr|triệu|đ|vnd)?/i) ||
      userText.match(/\b(\d+)\s*(k|nghìn|ngàn|tr|triệu)\b/i) ||
      userText.match(/\b(\d{4,9})\s*(?:đ|vnd)?\b/i);

    let specifiedAmount: number | undefined = undefined;
    if (amountMatch) {
      const num = parseFloat(amountMatch[1].replace(/\./g, ''));
      const unit = (amountMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
        specifiedAmount = Math.round(num * 1000);
      } else if (unit === 'tr' || unit === 'triệu') {
        specifiedAmount = Math.round(num * 1000000);
      } else if (num >= 10000) {
        specifiedAmount = Math.round(num);
      }
    }

    const action = planDepositAction(specifiedAmount, context);

    const depositMsg = specifiedAmount
      ? `💳 **Số dư ví hiện tại của bạn:** **${balStr}**\n\nBạn đang yêu cầu nạp **+${specifiedAmount.toLocaleString('vi-VN')}đ** vào ví. Bấm nút bên dưới để mở giao diện quét mã VietQR tự động:`
      : `💳 **Số dư ví hiện tại của bạn:** **${balStr}**\n\nBạn có thể nạp tiền tự động qua VietQR để thanh toán tức thì tại Shop of BOW! Bấm nút bên dưới hoặc chọn nhanh mệnh giá gợi ý để nạp tiền:`;

    const dynamicSuggestions = specifiedAmount
      ? ['Nạp 50.000đ', 'Nạp 100.000đ', 'Nạp 200.000đ', '🛍️ Xem danh mục']
      : ['Nạp 20.000đ', 'Nạp 50.000đ', 'Nạp 100.000đ', 'Nạp 200.000đ', '🛍️ Xem danh mục'];

    return {
      id,
      sender: 'agent',
      content: depositMsg,
      timestamp,
      action: action || undefined,
      suggestions: dynamicSuggestions,
    };
  }

  // --------------------------------------------------------------------------
  // 8. INTENT: COUPON (Mã giảm giá & Áp dụng)
  // --------------------------------------------------------------------------
  if (intent === 'COUPON') {
    const res = await getActiveCoupons();
    const coupons = res.data || [];

    if (coupons.length === 0) {
      return {
        id,
        sender: 'agent',
        content: `🎟️ **Mã giảm giá & Khuyến mãi:** Hiện tại hệ thống đang áp dụng **Mức giá ưu đãi trực tiếp** trên từng sản phẩm. Đừng quên theo dõi fanpage để cập nhật voucher sự kiện mới nhất nhé! 🎁`,
        timestamp,
        suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
      };
    }

    const topCoupon = coupons[0];
    const discountText = topCoupon.discount_type === 'percentage'
      ? `Giảm ${topCoupon.discount_value}%`
      : `Giảm ${Number(topCoupon.discount_value).toLocaleString('vi-VN')}đ`;

    const action = planApplyCouponAction(topCoupon.code, discountText, context);

    let msg = `🎉 **Danh sách Mã Giảm Giá đang áp dụng tại Shop of BOW:**\n\n`;
    coupons.forEach((c: any) => {
      const disc = c.discount_type === 'percentage' ? `Giảm ${c.discount_value}%` : `Giảm ${Number(c.discount_value).toLocaleString('vi-VN')}đ`;
      msg += `🎟️ Mã: \`${c.code}\` — **${disc}**\n`;
      if (c.name) msg += `   *${c.name}*\n`;
      if (c.minimum_order_amount && c.minimum_order_amount > 0) {
        msg += `   - Đơn tối thiểu: ${Number(c.minimum_order_amount).toLocaleString('vi-VN')}đ\n`;
      }
      msg += `\n`;
    });

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      data: { type: 'coupons', coupons },
      action: action || undefined,
      suggestions: ['🛍️ Xem danh mục', 'Kiểm tra bảo hành'],
    };
  }

  // --------------------------------------------------------------------------
  // 9. INTENT: FAQ (Câu hỏi & Hướng dẫn)
  // --------------------------------------------------------------------------
  if (intent === 'FAQ') {
    const res = await getFaqsAndGuides({ query: userText.replace(/hướng dẫn|cách dùng|kích hoạt|faq/gi, '').trim() });
    const faqs = res.data || [];

    if (faqs.length > 0) {
      let msg = `❓ **Câu hỏi & Hướng dẫn sử dụng tại Shop of BOW:**\n\n`;
      faqs.slice(0, 3).forEach((f: any) => {
        msg += `📌 **Q: ${f.question}**\n`;
        msg += `💡 A: ${f.answer}\n\n`;
      });

      return {
        id,
        sender: 'agent',
        content: msg,
        timestamp,
        data: { type: 'faq', faqs },
        suggestions: ['Gặp hỗ trợ viên', '🛍️ Xem danh mục', 'Chính sách bảo hành'],
      };
    }

    // Phase 6.6: Check Negative Policy if no positive FAQ found
    const negMatch = await matchNegativePolicy(userText);
    if (negMatch && negMatch.policy) {
      return {
        id,
        sender: 'agent',
        content: `ℹ️ **Thông báo chính sách Shop of BOW:**\n\n${negMatch.policy.answer}`,
        timestamp,
        data: { type: 'negative_policy', policy: negMatch.policy } as any,
        suggestions: ['🛍️ Xem danh mục', 'Chính sách bảo hành', 'Gặp hỗ trợ viên'],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 10. INTENT: GENERAL (Liên hệ hỗ trợ viên)
  // --------------------------------------------------------------------------
  if (intent === 'GENERAL') {
    const res = await getSupportChannels();
    const sc = res.data;

    let msg = `📞 **Kênh Hỗ Trợ Trực Tiếp của ${sc.brand}:**\n\n`;
    msg += `💬 **Zalo Hỗ Trợ:** [Nhắn Zalo Ngay](${sc.zalo}) (\`${sc.hotline}\`)\n`;
    msg += `📱 **Hotline:** \`${sc.hotline}\`\n`;
    msg += `🌐 **Fanpage Facebook:** [Bobowcon](${sc.facebook})\n`;
    msg += `⏰ **Thời gian hoạt động:** ${sc.hours}\n\n`;
    msg += `Đội ngũ kỹ thuật viên của BOW luôn sẵn sàng hỗ trợ bạn! ✨`;

    return {
      id,
      sender: 'agent',
      content: msg,
      timestamp,
      suggestions: ['🛍️ Xem danh mục', 'Kiểm tra đơn hàng', 'Mã giảm giá'],
    };
  }

  // --------------------------------------------------------------------------
  // 11. INTENT: PRODUCT_SEARCH (Tra cứu sản phẩm động từ Database)
  // --------------------------------------------------------------------------
  // V3.3 Phase 6.6: Check Negative Policy for support/installation inquiries
  const isSupportInquiry = /(?:ho\s+tro|cai|dat|remote|cai\s+dat|cai\s+qua)\b/i.test(normalizeText(userText));
  const isExplicitBuy = /^(?:mua|order|dat\s+hang|thanh\s+toan)\b/i.test(normalizeText(userText));
  if (isSupportInquiry && !isExplicitBuy) {
    const negMatch = await matchNegativePolicy(userText);
    if (negMatch && negMatch.policy) {
      return {
        id,
        sender: 'agent',
        content: `ℹ️ **Thông báo chính sách Shop of BOW:**\n\n${negMatch.policy.answer}`,
        timestamp,
        data: { type: 'negative_policy', policy: negMatch.policy } as any,
        suggestions: ['🛍️ Xem danh mục', 'Chính sách bảo hành', 'Gặp hỗ trợ viên'],
      };
    }
  }

  const resolution = await resolveProductQuery(userText);
  // An explicit plural request must not be downgraded to product detail just
  // because literal matching found one product first.
  let product = isPluralDiscovery ? undefined : resolution.candidate;

  // V3.2: Hỗ trợ tiếp nối câu hỏi đối chiếu nhóm đề xuất (Group Context Comparison)
  if (!product && sessionCtx.lastRecommendedCandidates && sessionCtx.lastRecommendedCandidates.length > 0) {
    const group = sessionCtx.lastRecommendedCandidates;
    if (lowerText.includes('cái đầu tiên') || lowerText.includes('thứ nhất') || lowerText.includes('cái 1') || lowerText.includes('sản phẩm 1')) {
      product = group[0];
    } else if (lowerText.includes('cái thứ hai') || lowerText.includes('cái thứ 2') || lowerText.includes('thứ 2') || lowerText.includes('cái 2') || lowerText.includes('sản phẩm 2')) {
      product = group[1] || group[0];
    } else if (lowerText.includes('cái thứ ba') || lowerText.includes('cái thứ 3') || lowerText.includes('thứ 3') || lowerText.includes('cái 3') || lowerText.includes('sản phẩm 3')) {
      product = group[2] || group[0];
    } else if (resolution.extractedParams.isCheapestQuery) {
      const sorted = [...group].filter((p) => p.startingPrice > 0).sort((a, b) => a.startingPrice - b.startingPrice);
      product = sorted[0] || group[0];
    } else if (resolution.extractedParams.isMostExpensiveQuery) {
      const sorted = [...group].filter((p) => p.startingPrice > 0).sort((a, b) => b.startingPrice - a.startingPrice);
      product = sorted[0] || group[0];
    }
  }

  // Hỗ trợ tiếp nối câu hỏi chọn gói (VD: sau khi hỏi "youtube", user gõ "6 tháng" hoặc "gói rẻ nhất")
  if (!product && sessionCtx.lastMentionedProduct && (resolution.extractedParams.durationFilter || resolution.extractedParams.isCheapestQuery || resolution.extractedParams.isMostExpensiveQuery)) {
    product = sessionCtx.lastMentionedProduct;
  }

  // Case 11A: Ambiguous - Tìm thấy nhiều sản phẩm tương đương
  if (resolution.isAmbiguous && resolution.candidates.length > 1 && !product) {
    agentAnalytics.track({
      eventType: 'CLARIFICATION_REQUESTED',
      intent,
      reason: 'MULTIPLE_CANDIDATES',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
      metadata: { candidatesCount: resolution.candidates.length },
    });

    const suggestions = resolution.candidates.slice(0, 4).map((p) => p.name);
    return {
      id,
      sender: 'agent',
      content: `Mình tìm thấy nhiều sản phẩm phù hợp. Bạn muốn tìm hiểu về sản phẩm nào?\n\n${resolution.candidates
        .slice(0, 4)
        .map((p) => `• **${p.name}**`)
        .join('\n')}`,
      timestamp,
      suggestions: [...suggestions, '🛍️ Xem tất cả sản phẩm'],
    };
  }

  // Case 11B: Matched chính xác 1 sản phẩm (Product Detail + Sinh Action Card)
  if (product) {
    agentAnalytics.track({
      eventType: 'PRODUCT_RESOLVED',
      intent,
      productId: product.id,
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
    });

    let selectedPlan = undefined;
    let activePlans = product.plans || [];

    // Lọc gói khác nếu yêu cầu
    if (resolution.extractedParams.isOtherPlanQuery && sessionCtx.lastMentionedPlan) {
      activePlans = activePlans.filter(p => p.id !== sessionCtx.lastMentionedPlan!.id);
    }

    const requestedDur =
      resolution.extractedParams.durationFilter ||
      extractDuration(userText) ||
      multiIntent.deferredContext?.duration;

    if (requestedDur) {
      selectedPlan = matchPlanByDuration(activePlans, requestedDur, userText) || findPlanByDuration(activePlans, requestedDur);
    } else if (resolution.extractedParams.isCheapestQuery && activePlans.length > 0) {
      selectedPlan = [...activePlans].sort((a, b) => a.price - b.price)[0];
    } else if (resolution.extractedParams.isMostExpensiveQuery && activePlans.length > 0) {
      selectedPlan = [...activePlans].sort((a, b) => b.price - a.price)[0];
    }

    // Nếu chỉ có 1 plan duy nhất, tự chọn
    if (!selectedPlan && activePlans.length === 1) {
      selectedPlan = activePlans[0];
    }

    rememberProductContext(product, selectedPlan);
    let singleAction = undefined;
    let multipleActions = undefined;

    // Nếu đã chốt plan, tạo 1 Action
    if (selectedPlan) {
      singleAction = planCheckoutAction(product, selectedPlan, context) || undefined;
      agentAnalytics.track({
        eventType: 'PLAN_RESOLVED',
        intent,
        productId: product.id,
        planId: selectedPlan.id,
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
    } else if (activePlans.length > 0) {
      // Nếu có nhiều plan, tạo nhiều Action Card
      multipleActions = planMultipleCheckoutActions(product, activePlans, context);
      agentAnalytics.track({
        eventType: 'PLAN_UNRESOLVED',
        intent,
        productId: product.id,
        reason: 'MULTIPLE_PLANS_AVAILABLE',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
      agentAnalytics.track({
        eventType: 'CLARIFICATION_REQUESTED',
        intent,
        productId: product.id,
        reason: 'MULTIPLE_PLANS_AVAILABLE',
        sessionId: sessionCtx.updatedAt.toString(),
        userId: context.userId,
      });
    }

    const content = formatSingleProductResponse(product, selectedPlan);

    return {
      id,
      sender: 'agent',
      content,
      timestamp,
      data: { type: 'product', product, plan: selectedPlan },
      action: singleAction,
      actions: multipleActions,
      suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
    };
  }

  // Case 11C: Kiểm tra Category fallback nếu không khớp sản phẩm
  const categoryMatch = await resolveCategoryQuery(userText);
  if (categoryMatch.matched && categoryMatch.category) {
    const cat = categoryMatch.category;
    rememberCategoryContext(cat);
    const prodRes = await searchProducts({ categoryId: cat.id });
    const products = prodRes.data || [];
    const formatted = formatCategoryDetailResponse(cat, products);

    return {
      id,
      sender: 'agent',
      content: formatted.content,
      timestamp,
      data: { type: 'category_detail', categoryId: cat.id, products },
      suggestions: formatted.suggestions,
    };
  }


  // Case 11D: V3.3 — Semantic Demand Match (SUPPORTED / NEAR_MATCH)
  // V3.3 Phase 4.2: Plural Discovery routing — when isPluralDiscovery=true and only 1 semantic
  // candidate exists, attempt category expansion to find additional relevant products.
  if (
    (resolution.semanticCandidates && resolution.semanticCandidates.length > 0) ||
    (isPluralDiscovery && resolution.matchType !== 'none' && resolution.candidates.length > 0)
  ) {
    let semCandidates = resolution.semanticCandidates && resolution.semanticCandidates.length > 0
      ? resolution.semanticCandidates
      : resolution.candidates;

    // -----------------------------------------------------------------------
    // V3.3 Phase 4.2 — PLURAL DISCOVERY EXPANSION
    // If user asked a plural query ("có những app xem phim gì") but semantic
    // scoring only returned 1 candidate, attempt to expand via:
    //   1. Fetch same-category products (bounded, relevance-filtered)
    //   2. Re-score them with the same demand tokens
    //   3. Keep only products with meaningful relevance score (threshold >= 30)
    //   4. Never expand to all-category dump — must pass quality gate
    // -----------------------------------------------------------------------
    if (isPluralDiscovery && semCandidates.length === 1) {
      const anchorProduct = semCandidates[0];
      if (anchorProduct.categoryId) {
        try {
          const catRes = await searchProducts({ categoryId: anchorProduct.categoryId });
          const catProducts = (catRes.data || []).filter(p => p.id !== anchorProduct.id);

          if (catProducts.length > 0) {
            // Re-score category products using the same demand tokens from resolver
            // We use the semantic scoring heuristic: require token presence in corpus
            const demandQuery = resolution.semanticMatchQuery || '';
            const demandTokens = demandQuery
              .split(/\s+/)
              .filter(t => t.length >= 2);

            const qualifiedExpansion = catProducts.filter(p => {
              if (demandTokens.length === 0) return false;
              const corpus = [
                p.name,
                p.tagline || '',
                p.description || '',
                p.categoryName || '',
                ...(p.features || []),
                ...(p.searchAliases || []),
              ].join(' ').toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd');

              // Require at least 1 demand token to match corpus
              const matchCount = demandTokens.filter(t => {
                const normT = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
                return normT.length >= 2 && new RegExp(`\\b${normT}\\b`, 'i').test(corpus);
              }).length;

              // Quality gate: token match ratio >= 0.5 (at least half the demand tokens must match)
              return matchCount > 0 && matchCount / demandTokens.length >= 0.5;
            });

            if (qualifiedExpansion.length > 0) {
              // Combine anchor (highest relevance) + qualified expansion
              semCandidates = [anchorProduct, ...qualifiedExpansion].slice(0, 6);
            }
          }
        } catch {
          // Expansion failed silently — fall back to original single candidate
        }
      }
    }

    const demandMeta = normalizeUserDemand(userText, semCandidates);

    agentAnalytics.track({
      eventType: 'DEMAND_MATCHED',
      intent,
      reason: 'SEMANTIC_CAPABILITY_MATCH',
      sessionId: sessionCtx.updatedAt.toString(),
      userId: context.userId,
      metadata: demandMeta as any,
    });

    // Route single-product only when:
    //   a) Genuinely 1 candidate AND user did NOT ask plural, OR
    //   b) Plural expansion was attempted but still returned 1 (catalog truly has only 1 match)
    if (semCandidates.length === 1 && !isPluralDiscovery) {
      // Single product detail view
      const product = semCandidates[0];
      rememberProductContext(product, undefined);
      const activePlans = product.plans || [];
      const selectedPlan = activePlans.length === 1 ? activePlans[0] : undefined;
      const multipleActions = !selectedPlan && activePlans.length > 0
        ? planMultipleCheckoutActions(product, activePlans, context)
        : undefined;
      const singleAction = selectedPlan
        ? (planCheckoutAction(product, selectedPlan, context) || undefined)
        : undefined;
      let content = formatSingleProductResponse(product, selectedPlan);
      if (demandMeta.demandState === 'NEAR_MATCH') {
        content = `🔎 **Shop hiện chưa có sản phẩm chuyên dụng 100% cho nhu cầu này, nhưng ${product.name} là lựa chọn gần phù hợp nhất:**\n\n` + content;
      }

      return {
        id,
        sender: 'agent',
        content,
        timestamp,
        data: { type: 'product', product, plan: selectedPlan },
        action: singleAction,
        actions: multipleActions,
        suggestions: ['🛍️ Xem danh mục', '🎟️ Mã giảm giá hôm nay', 'Chính sách bảo hành'],
      };
    }

    // Multi-product recommendation (plural discovery or multiple semantic candidates)
    // When isPluralDiscovery=true and expansion still gave only 1 → still show as single with
    // a note that this is the best match (catalog limitation, not engine limitation)
    if (semCandidates.length === 1 && isPluralDiscovery) {
      const product = semCandidates[0];
      rememberRecommendedCandidates([product]);
      const content = `🔎 **Shop hiện chỉ có 1 sản phẩm phù hợp với nhu cầu này:**\n\n` +
        `• **${product.name}**${product.tagline ? ` — *${product.tagline}*` : ''} — từ **${product.startingPrice.toLocaleString('vi-VN')}đ**\n\n` +
        `Bạn muốn xem chi tiết sản phẩm này không?`;
      return {
        id,
        sender: 'agent',
        content,
        timestamp,
        data: { type: 'semantic_candidates', candidates: [product] },
        suggestions: [product.name, '🛍️ Xem danh mục'],
      };
    }

    // Multiple candidates → Multi-product recommendation
    rememberRecommendedCandidates(semCandidates);
    const pluralIntro = isPluralDiscovery
      ? `📋 **Mình tìm thấy ${semCandidates.length} sản phẩm phù hợp trong Catalog:**\n\n`
      : (demandMeta.demandState === 'NEAR_MATCH'
        ? `🔎 **Hiện shop chưa có gói chuyên dụng 100% cho nhu cầu này, nhưng có ${semCandidates.length} công cụ gần phù hợp sau:**\n\n`
        : `🔎 **Mình tìm thấy ${semCandidates.length} sản phẩm có thể phù hợp với nhu cầu của bạn:**\n\n`);
    let semMsg = pluralIntro;

    semCandidates.forEach((p) => {
      const priceStr = p.startingPrice > 0
        ? `từ **${p.startingPrice.toLocaleString('vi-VN')}đ**`
        : 'Liên hệ';
      const taglineStr = p.tagline ? ` — *${p.tagline}*` : '';
      semMsg += `• **${p.name}**${taglineStr} — ${priceStr}\n`;
    });
    semMsg += `\nBạn muốn xem chi tiết sản phẩm nào?`;

    return {
      id,
      sender: 'agent',
      content: semMsg,
      timestamp,
      data: { type: 'semantic_candidates', candidates: semCandidates },
      suggestions: [
        ...semCandidates.slice(0, 3).map((p) => p.name),
        '🛍️ Xem danh mục',
      ],
    };
  }

  // Case 11E: V3.3 Phase 6.6 — Check Negative Policy before fallback to unsupported product demand
  const negMatch = await matchNegativePolicy(userText);
  if (negMatch && negMatch.policy) {
    return {
      id,
      sender: 'agent',
      content: `ℹ️ **Thông báo chính sách Shop of BOW:**\n\n${negMatch.policy.answer}`,
      timestamp,
      data: { type: 'negative_policy', policy: negMatch.policy } as any,
      suggestions: ['🛍️ Xem danh mục', 'Chính sách bảo hành', 'Gặp hỗ trợ viên'],
    };
  }

  // Case 11F: Không tìm thấy sản phẩm cụ thể (Dynamic Suggestions from DB)
  // V3.3: Log DEMAND_DISCOVERED with normalized demand metadata
  const unsupportedMeta = normalizeUserDemand(userText, []);
  agentAnalytics.track({
    eventType: 'DEMAND_DISCOVERED',
    intent,
    reason: 'PRODUCT_NOT_FOUND',
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
    metadata: unsupportedMeta as any,
  });
  agentAnalytics.track({
    eventType: 'PRODUCT_UNRESOLVED',
    intent,
    reason: 'PRODUCT_NOT_FOUND',
    sessionId: sessionCtx.updatedAt.toString(),
    userId: context.userId,
  });

  const prodRes = await searchProducts({ limit: 4 });
  const sampleProducts = (prodRes.data || []).slice(0, 4);
  const sampleNames = sampleProducts.map((p) => p.name);

  // Sanitize and truncate keyword display to prevent reflecting injection strings or tags
  const sanitizedDisplayQuery = userText
    .replace(/[<>{}\[\]`\\;]/g, '')
    .slice(0, 50)
    .trim();

  let notFoundMsg = sanitizedDisplayQuery.length > 0
    ? `🔎 **Mình chưa tìm thấy sản phẩm phù hợp với từ khóa "${sanitizedDisplayQuery}".**\n\n`
    : `🔎 **Mình chưa tìm thấy sản phẩm phù hợp với yêu cầu của bạn.**\n\n`;
  if (sampleProducts.length > 0) {
    notFoundMsg += `Bạn có thể tham khảo một số sản phẩm nổi bật:\n`;
    sampleProducts.forEach((p) => {
      const priceText = p.startingPrice > 0 ? `từ **${p.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
      notFoundMsg += `• **${p.name}** — ${priceText}\n`;
    });
  }
  notFoundMsg += `\nHoặc bấm **"🛍️ Xem danh mục"** để xem toàn bộ danh mục sản phẩm nhé! ✨`;

  const dynamicSuggestions = sampleNames.length > 0 ? [...sampleNames.slice(0, 3), '🛍️ Xem danh mục'] : ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'];

  return {
    id,
    sender: 'agent',
    content: notFoundMsg,
    timestamp,
    suggestions: dynamicSuggestions,
  };
}
