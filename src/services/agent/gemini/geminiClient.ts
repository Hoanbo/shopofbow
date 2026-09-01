// src/services/agent/gemini/geminiClient.ts
// BOW Agent V3 — Gemini Client & Orchestrator with Direct REST API & Safe Tool Calling

import type { AgentContext, AgentMessage, AgentAction } from '../types';
import { GEMINI_CONFIG, getGeminiApiKey, sanitizeLogOutput } from './config';
import { BOW_AGENT_SYSTEM_PROMPT } from './geminiPrompt';
import { geminiToolDeclarations, executeGeminiTool, type GeminiToolExecutionOutput } from './geminiTools';
import {
  planCheckoutAction,
  planMultipleCheckoutActions,
  planDepositAction,
  planOrderDetailAction,
  planApplyCouponAction,
  planTicketDetailAction,
  planSupportTicketAction,
  findRelevantWarrantyOrder,
} from '../actionPlanner';
import { agentAnalytics, normalizeUserDemand } from '../monitoring/agentAnalytics';
import { getSessionContext, rememberProductContext, rememberRecommendedCandidates } from '../sessionContext';
import { extractDuration, matchPlanByDuration, resolveMultiIntent } from '../intentResolver';

// In-memory conversation history for multi-turn dialogue context
interface ConversationTurn {
  role: 'user' | 'model';
  parts: Array<any>;
}

let conversationHistory: ConversationTurn[] = [];

/**
 * Reset lịch sử hội thoại khi người dùng làm mới phiên
 */
export function resetGeminiHistory(): void {
  conversationHistory = [];
}

/**
 * Xử lý tin nhắn người dùng bằng BOW Agent V3 (Gemini Brain)
 */
export async function processAgentMessageWithGemini(
  userText: string,
  context: AgentContext
): Promise<{ success: boolean; message?: AgentMessage; error?: any }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: new Error('GEMINI_API_KEY_MISSING') };
  }

  const sessionId = getSessionContext().updatedAt.toString();

  // Track GEMINI_REQUEST
  agentAnalytics.track({
    eventType: 'GEMINI_REQUEST',
    sessionId,
    userId: context.userId,
    metadata: {
      model: GEMINI_CONFIG.modelName,
      queryLength: userText.length,
    },
  });

  try {
    // Timeout guard chống treo vô hạn
    const timeoutPromise = new Promise<{ success: false; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), GEMINI_CONFIG.timeoutMs)
    );

    const executionPromise = (async (): Promise<{ success: boolean; message?: AgentMessage; error?: any }> => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.modelName}:generateContent?key=${apiKey}`;

      // Giới hạn số lượt lịch sử gần nhất theo config
      const recentHistory = conversationHistory.slice(-GEMINI_CONFIG.maxHistoryTurns * 2);
      const contents: any[] = [...recentHistory, { role: 'user', parts: [{ text: userText }] }];

      const collectedToolOutputs: GeminiToolExecutionOutput[] = [];
      let iteration = 0;
      const MAX_TOOL_ITERATIONS = 2;
      let responseText = '';

      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        const apiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: BOW_AGENT_SYSTEM_PROMPT }] },
            contents,
            tools: [{ functionDeclarations: geminiToolDeclarations }],
            generationConfig: {
              temperature: GEMINI_CONFIG.temperature,
            },
          }),
        });

        if (!apiRes.ok) {
          const errData = await apiRes.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Gemini API returned status ${apiRes.status}`);
        }

        const data = await apiRes.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Check if there are function calls
        const fnCallPart = parts.find((p: any) => p.functionCall);

        if (fnCallPart) {
          const fnCall = fnCallPart.functionCall;

          // Track TOOL_CALL
          agentAnalytics.track({
            eventType: 'TOOL_CALL',
            sessionId,
            userId: context.userId,
            metadata: {
              toolName: fnCall.name,
              args: sanitizeLogOutput(fnCall.args),
            },
          });

          // Thực thi Tool an toàn từ Business Logic hiện có của BOW
          const toolOutput = await executeGeminiTool(fnCall.name, fnCall.args || {}, context, userText);
          collectedToolOutputs.push(toolOutput);

          // Track TOOL_RESULT
          agentAnalytics.track({
            eventType: 'TOOL_RESULT',
            sessionId,
            userId: context.userId,
            metadata: {
              toolName: fnCall.name,
              success: toolOutput.success,
            },
          });

          // Thêm phản hồi của Model và kết quả Tool vào contents
          contents.push(candidate.content);
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: fnCall.name,
                  response: {
                    success: toolOutput.success,
                    data: toolOutput.data,
                    message: toolOutput.message,
                  },
                },
              },
            ],
          });
        } else {
          // Model đã hoàn tất suy luận và trả về văn bản tự nhiên
          const textPart = parts.find((p: any) => p.text);
          if (textPart) {
            responseText = textPart.text;
          }
          break;
        }
      }

      if (!responseText) {
        // Fallback nội dung nếu loop kết thúc
        responseText = 'Chào bạn! Mình có thể hỗ trợ gì cho bạn về các gói tài khoản hôm nay?';
      }

      // Cập nhật bộ nhớ hội thoại đa lượt an toàn (giới hạn tối đa 12 turns, loại bỏ chuỗi quá dài)
      const sanitizedUserText = userText.slice(0, 300);
      const sanitizedModelText = responseText.slice(0, 800);
      conversationHistory.push({ role: 'user', parts: [{ text: sanitizedUserText }] });
      conversationHistory.push({ role: 'model', parts: [{ text: sanitizedModelText }] });
      if (conversationHistory.length > 12) {
        conversationHistory = conversationHistory.slice(-12);
      }

      // Track GEMINI_RESPONSE
      agentAnalytics.track({
        eventType: 'GEMINI_RESPONSE',
        sessionId,
        userId: context.userId,
        metadata: {
          toolsInvokedCount: collectedToolOutputs.length,
          responseLength: responseText.length,
        },
      });

      // Tổng hợp Action Card và Suggestions an toàn từ kết quả Tool
      const { actions, suggestions, primaryAction, responseData } = synthesizeActionsAndSuggestions(
        collectedToolOutputs,
        context,
        userText,
        sessionId
      );

      // V3.3 Phase 4.7 Normalization: Tránh duplicate render cùng một Action Card
      const singleAction = actions.length === 1 ? actions[0] : (actions.length === 0 ? primaryAction : undefined);
      const multipleActions = actions.length > 1 ? actions : undefined;

      const agentMessage: AgentMessage = {
        id: 'gemini_' + Date.now(),
        sender: 'agent',
        content: responseText,
        timestamp: new Date().toISOString(),
        data: responseData,
        action: singleAction,
        actions: multipleActions,
        suggestions: suggestions.length > 0 ? suggestions : ['🛍️ Xem danh mục', 'Kiểm tra đơn hàng', 'Mã giảm giá'],
      };

      return { success: true, message: agentMessage };
    })();

    return await Promise.race([executionPromise, timeoutPromise as any]);
  } catch (err: any) {
    if (import.meta.env?.DEV) {
      console.warn('[BOW Agent V3.2 Gemini Warning] Fallback to V2 triggered:', err?.message || err);
    }
    return { success: false, error: err };
  }
}

/**
 * Tổng hợp UI Action Card & Gợi ý từ kết quả thực thi Tool an toàn
 */
export function synthesizeActionsAndSuggestions(
  toolOutputs: GeminiToolExecutionOutput[],
  context: AgentContext,
  userText: string,
  sessionId: string
): {
  actions: AgentAction[];
  primaryAction?: AgentAction;
  suggestions: string[];
  responseData?: any;
} {
  const actions: AgentAction[] = [];
  const suggestions: string[] = [];
  let responseData: any = null;

  for (const out of toolOutputs) {
    if (!out.actionData) continue;

    switch (out.actionData.type) {
      case 'product_detail': {
        const p = out.actionData.product;
        if (p) {
          const duration = extractDuration(userText);
          let matchedPlan = p.plans ? matchPlanByDuration(p.plans, duration || userText, userText) : undefined;
          if (!matchedPlan && p.plans && p.plans.length === 1) {
            matchedPlan = p.plans[0];
          }

          rememberProductContext(p, matchedPlan);
          responseData = { type: 'product', product: p, plan: matchedPlan };

          if (matchedPlan) {
            const singleAct = planCheckoutAction(p, matchedPlan, context);
            if (singleAct) actions.push(singleAct);
            suggestions.push('🛍️ Xem danh mục', '🎟️ Mã giảm giá');
          } else if (p.plans && p.plans.length > 0) {
            const checkoutActions = planMultipleCheckoutActions(p, p.plans, context);
            actions.push(...checkoutActions);
            suggestions.push(...p.plans.slice(0, 3).map((pl) => pl.name));
          }
        }
        break;
      }

      case 'products_list': {
        const products = out.actionData.products || [];
        const demandMeta = normalizeUserDemand(userText, products);

        if (products.length > 0) {
          rememberRecommendedCandidates(products);
          responseData = { type: 'semantic_candidates', candidates: products };
          suggestions.push(...products.slice(0, 3).map((p) => p.name));

          // Log DEMAND_MATCHED với DemandState (SUPPORTED hoặc NEAR_MATCH)
          agentAnalytics.track({
            eventType: 'DEMAND_MATCHED',
            sessionId,
            userId: context.userId,
            metadata: demandMeta as any,
          });
        } else {
          // Log DEMAND_DISCOVERED khi nhu cầu không có sản phẩm nào trong Catalog (UNSUPPORTED)
          agentAnalytics.track({
            eventType: 'DEMAND_DISCOVERED',
            sessionId,
            userId: context.userId,
            metadata: demandMeta as any,
          });
        }
        break;
      }

      case 'wallet': {
        const bal = out.actionData.balance ?? 0;
        const depositAction = planDepositAction(undefined, context);
        if (depositAction) actions.push(depositAction);
        suggestions.push('Nạp thêm tiền', '🛍️ Xem danh mục', 'Mã giảm giá');
        responseData = { type: 'wallet', balance: bal };
        break;
      }

      case 'orders': {
        const orders = out.actionData.orders || [];
        const isWarrantyIntent = resolveMultiIntent(userText).primaryIntent === 'WARRANTY';

        if (isWarrantyIntent) {
          // Gemini warranty parity: Khi user có ý định bảo hành, áp dụng đúng quy tắc bảo hành
          const relevantOrder = findRelevantWarrantyOrder(orders, userText);
          if (relevantOrder) {
            const action = planSupportTicketAction(relevantOrder, userText, context);
            if (action) {
              actions.push(action);
              suggestions.push('Gặp hỗ trợ viên Zalo', '📦 Xem tất cả đơn', 'Chính sách bảo hành');
              responseData = { type: 'warranty_ticket', order: relevantOrder };
            } else {
              // Đơn không đủ điều kiện (cancelled, refunded, pending_payment)
              suggestions.push('📦 Xem tất cả đơn', '🛍️ Xem danh mục', 'Gặp hỗ trợ viên');
              responseData = { type: 'warranty_rejected', order: relevantOrder, reason: relevantOrder.status };
            }
          }
        } else if (orders.length > 0) {
          const firstOrder = orders[0];
          const orderAction = planOrderDetailAction(firstOrder, context);
          if (orderAction) actions.push(orderAction);
          suggestions.push('Yêu cầu hỗ trợ', '🛍️ Mua thêm sản phẩm');
          responseData = { type: 'orders', orders };
        }
        break;
      }

      case 'warranty_ticket': {
        const order = out.actionData.order;
        if (order) {
          const action = planSupportTicketAction(order, userText, context);
          if (action) actions.push(action);
          suggestions.push('Gặp hỗ trợ viên Zalo', '📦 Xem tất cả đơn', 'Chính sách bảo hành');
          responseData = { type: 'warranty_ticket', order };
        }
        break;
      }

      case 'warranty_rejected': {
        suggestions.push('📦 Xem tất cả đơn', '🛍️ Xem danh mục', 'Gặp hỗ trợ viên');
        responseData = { type: 'warranty_rejected', order: out.actionData.order, reason: out.actionData.reason };
        break;
      }

      case 'vouchers': {
        const vouchers = out.actionData.vouchers || [];
        if (vouchers.length > 0) {
          for (const v of vouchers.slice(0, 2)) {
            const couponAct = planApplyCouponAction(v.code, `${v.discount_value}%`, context);
            if (couponAct) actions.push(couponAct);
          }
          suggestions.push('🛍️ Dùng mã ngay', 'Xem tất cả sản phẩm');
        }
        responseData = { type: 'coupons', vouchers };
        break;
      }

      case 'tickets': {
        const tickets = out.actionData.tickets || [];
        if (tickets.length > 0) {
          const tAction = planTicketDetailAction(tickets[0], context);
          if (tAction) actions.push(tAction);
        }
        suggestions.push('Gặp hỗ trợ viên', 'Kiểm tra đơn hàng');
        break;
      }

      case 'support': {
        suggestions.push('Zalo hỗ trợ: 0966 821 315', 'Facebook Admin');
        break;
      }
    }
  }

  return {
    actions,
    primaryAction: actions.length > 0 ? actions[0] : undefined,
    suggestions: Array.from(new Set(suggestions)).slice(0, 4),
    responseData,
  };
}
