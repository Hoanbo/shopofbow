// src/services/agent/gemini/geminiTools.ts
// Tool declarations and deterministic execution bridge for BOW Agent V3

import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import type { AgentContext, ProductItemResult } from '../types';
import {
  searchProducts,
  getMyWalletBalance,
  getMyOrders,
  getActiveCoupons,
  checkWarrantyPolicy,
  getSupportChannels,
  getFaqsAndGuides,
  getMyTickets,
} from '../tools';

import { resolveProductQuery } from '../productResolver';
import { detectPluralDiscoveryIntent } from '../intentResolver';
import { findRelevantWarrantyOrder } from '../actionPlanner';
import { rememberOrderContext } from '../sessionContext';

/**
 * 1. Khai báo Function Declarations (Tools) cho Gemini
 */
export const geminiToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'Tìm kiếm sản phẩm trong kho của Shop of BOW theo từ khóa, nhu cầu sử dụng, hoặc danh mục.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: {
          type: SchemaType.STRING,
          description: 'Từ khóa tên sản phẩm (vd: "netflix", "canva", "chatgpt") hoặc nhu cầu (vd: "nghe nhạc", "xem phim", "dựng video", "học tiếng anh", "code").',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Loại sản phẩm nếu có: "ai-tool", "premium-app", hoặc "product".',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Số lượng sản phẩm tối đa cần lấy (mặc định 6).',
        },
      },
    },
  },
  {
    name: 'get_product_detail',
    description: 'Lấy chi tiết bảng giá, tất cả các gói cước (plans), tính năng và chính sách bảo hành của một sản phẩm cụ thể.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productIdOrSlug: {
          type: SchemaType.STRING,
          description: 'ID hoặc Slug hoặc Tên của sản phẩm (vd: "spotify-premium", "netflix-premium", "chatgpt-plus", "super-duolingo").',
        },
      },
      required: ['productIdOrSlug'],
    },
  },
  {
    name: 'get_user_wallet',
    description: 'Kiểm tra số dư thực tế trong ví của người dùng hiện tại trên hệ thống.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_user_orders',
    description: 'Tra cứu danh sách đơn hàng đã mua, mã thanh toán, trạng thái đơn, và tài khoản cấp của người dùng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        paymentCode: {
          type: SchemaType.STRING,
          description: 'Mã đơn hàng hoặc mã thanh toán cần tra cứu (vd: "BOW-XXXXX").',
        },
        productName: {
          type: SchemaType.STRING,
          description: 'Tên sản phẩm trong đơn hàng cần lọc.',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Trạng thái đơn: "completed", "pending", "processing", "expired".',
        },
      },
    },
  },
  {
    name: 'get_active_vouchers',
    description: 'Lấy danh sách các mã giảm giá (voucher / coupon) đang kích hoạt và còn hạn trên Shop of BOW.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_warranty_policy',
    description: 'Tra cứu cam kết chính sách bảo hành 1 đổi 1 và quy trình hỗ trợ kỹ thuật chung của shop.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productName: {
          type: SchemaType.STRING,
          description: 'Tên sản phẩm muốn hỏi chính sách bảo hành (tùy chọn).',
        },
      },
    },
  },
  {
    name: 'request_order_warranty',
    description: 'Kiểm tra và gửi yêu cầu bảo hành hoặc hỗ trợ lỗi cho đơn hàng khi khách hàng báo lỗi, hỏng tài khoản, không đăng nhập được, hoặc yêu cầu bảo hành.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        paymentCode: {
          type: SchemaType.STRING,
          description: 'Mã đơn hàng cần bảo hành nếu khách hàng cung cấp (vd: "BOW-XXXXX").',
        },
        productName: {
          type: SchemaType.STRING,
          description: 'Tên sản phẩm cần bảo hành nếu khách hàng nhắc đến (vd: "youtube", "netflix").',
        },
        issueDescription: {
          type: SchemaType.STRING,
          description: 'Mô tả sự cố hoặc lỗi cần hỗ trợ.',
        },
      },
    },
  },
  {
    name: 'get_support_channels',
    description: 'Lấy thông tin liên hệ trực tiếp với bộ phận chăm sóc khách hàng: Hotline, Zalo Admin, Facebook Fanpage.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_faqs',
    description: 'Tra cứu câu hỏi thường gặp, hướng dẫn đăng nhập, bảo hành, và hướng dẫn thanh toán.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Chủ đề hoặc câu hỏi cần tra cứu.',
        },
      },
    },
  },
  {
    name: 'get_my_tickets',
    description: 'Tra cứu các phiếu yêu cầu hỗ trợ hoặc khiếu nại bảo hành của người dùng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: 'Trạng thái ticket: "open", "in_progress", "resolved", "closed", hoặc "all".',
        },
      },
    },
  },
];

/**
 * Interface kết quả thực thi Tool dành cho V3 Orchestrator
 */
export interface GeminiToolExecutionOutput {
  toolName: string;
  success: boolean;
  data: any;
  message?: string;
  // Dữ liệu có cấu trúc để sinh Action Card tương ứng
  actionData?: {
    type: 'product_detail' | 'products_list' | 'wallet' | 'orders' | 'vouchers' | 'tickets' | 'support' | 'warranty_ticket' | 'warranty_rejected';
    product?: ProductItemResult;
    products?: ProductItemResult[];
    balance?: number;
    orders?: any[];
    vouchers?: any[];
    tickets?: any[];
    order?: any;
    reason?: string;
  };
}

/**
 * 2. Cầu nối thực thi Tool an toàn (Deterministic Safe Execution)
 */
export async function executeGeminiTool(
  toolName: string,
  rawArgs: Record<string, any> | undefined | null,
  context: AgentContext,
  requestText?: string
): Promise<GeminiToolExecutionOutput> {
  // Chuẩn hóa và làm sạch tham số đầu vào (Argument Sanitization & Hardening)
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};

  try {
    switch (toolName) {
      case 'search_products': {
        const kw = typeof args.keyword === 'string' ? args.keyword.slice(0, 150).trim() : '';
        const prodType = typeof args.type === 'string' && ['ai-tool', 'premium-app', 'product'].includes(args.type)
          ? args.type
          : undefined;
        const limit = typeof args.limit === 'number' && args.limit > 0 && args.limit <= 20 ? args.limit : 8;

        // V3.3 Phase 4.2 — RC-3: detect plural intent from original user context
        // context.userText holds the original query if available, otherwise derive from kw
        const originalQuery = requestText || kw;
        const isPluralQuery = detectPluralDiscoveryIntent(originalQuery);

        let res = await searchProducts({
          keyword: kw,
          type: prodType,
          limit,
        });

        let products = res.data || [];

        // Nếu tìm theo từ khóa literal chưa ra, kích hoạt bộ phân giải ngữ cảnh sản phẩm (7 tầng)
        if ((isPluralQuery || products.length === 0) && originalQuery.length > 0) {
          const resolved = await resolveProductQuery(originalQuery);
          if (resolved.candidate && !isPluralQuery) {
            products = [resolved.candidate];
          }
          if (resolved.semanticCandidates && resolved.semanticCandidates.length > 0) {
            products = resolved.semanticCandidates;
          } else if (!isPluralQuery && resolved.candidates && resolved.candidates.length > 0) {
            products = resolved.candidates;
          }
        }

        // V3.3 Phase 4.2 — RC-3: Plural expansion at tool level
        // If plural discovery and only 1 product found, try category expansion
        if (isPluralQuery && products.length === 1 && products[0].categoryId) {
          try {
            const catRes = await searchProducts({ categoryId: products[0].categoryId, limit: 10 });
            const catProducts = (catRes.data || []).filter(p => p.id !== products[0].id);

            if (catProducts.length > 0) {
              // Filter by keyword relevance — require kw substring in name/tagline/aliases
              const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
              const kwTokens = kwNorm.split(/\s+/).filter(t => t.length >= 2);

              const qualifiedExpansion = catProducts.filter(p => {
                if (kwTokens.length === 0) return false;
                const corpus = [
                  p.name,
                  p.tagline || '',
                  ...(p.searchAliases || []),
                ].join(' ').toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/đ/g, 'd');

                const matchCount = kwTokens.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(corpus)).length;
                return matchCount > 0 && matchCount / kwTokens.length >= 0.5;
              });

              if (qualifiedExpansion.length > 0) {
                products = [products[0], ...qualifiedExpansion].slice(0, 6);
              }
            }
          } catch {
            // Expansion failed silently
          }
        }

        return {
          toolName,
          success: res.success,
          data: products.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            categoryName: p.categoryName,
            startingPrice: p.startingPrice,
            tagline: p.tagline,
            plans: p.plans.map((pl) => ({ id: pl.id, name: pl.name, duration: pl.duration, price: pl.price })),
          })),
          actionData: {
            // V3.3 Phase 4.2 — RC-3: type depends on BOTH product count AND user intent
            type: (isPluralQuery || products.length > 1) ? 'products_list' : 'product_detail',
            product: (!isPluralQuery && products.length === 1) ? products[0] : undefined,
            products,
          },
        };
      }

      case 'get_product_detail': {
        const query = typeof args.productIdOrSlug === 'string' ? args.productIdOrSlug.slice(0, 100).trim() : '';
        if (!query) {
          return {
            toolName,
            success: false,
            data: null,
            message: 'Thiếu tên hoặc ID sản phẩm cần xem chi tiết.',
          };
        }

        const res = await searchProducts({ keyword: query, limit: 3 });
        let products = res.data || [];

        if (products.length === 0) {
          const resolved = await resolveProductQuery(query);
          if (resolved.candidate) {
            products = [resolved.candidate];
          } else if (resolved.semanticCandidates && resolved.semanticCandidates.length > 0) {
            products = resolved.semanticCandidates;
          }
        }

        const matched = products.find(
          (p) =>
            p.id === query ||
            p.slug.toLowerCase() === query.toLowerCase() ||
            p.name.toLowerCase().includes(query.toLowerCase())
        ) || products[0];

        if (matched) {
          return {
            toolName,
            success: true,
            data: {
              id: matched.id,
              name: matched.name,
              slug: matched.slug,
              categoryName: matched.categoryName,
              tagline: matched.tagline,
              startingPrice: matched.startingPrice,
              plans: matched.plans.map((pl) => ({
                id: pl.id,
                name: pl.name,
                duration: pl.duration,
                price: pl.price,
                isHighlight: pl.isHighlight,
              })),
              features: matched.features,
              warranty: matched.warranty,
            },
            actionData: {
              type: 'product_detail',
              product: matched,
            },
          };
        }

        return {
          toolName,
          success: false,
          data: null,
          message: `Không tìm thấy sản phẩm "${query}" trong hệ thống Shop of BOW.`,
        };
      }

      case 'get_user_wallet': {
        // Strict Authorization: Chỉ dùng context.userId đã xác thực
        if (!context.isAuthenticated || !context.userId) {
          return {
            toolName,
            success: false,
            data: {
              balance: 0,
              formatted: '0đ',
              isAuthenticated: false,
            },
            message: 'Khách hàng chưa đăng nhập. Vui lòng đăng nhập để kiểm tra số dư ví.',
          };
        }

        const res = await getMyWalletBalance(context);
        const bal = res.data?.balance || 0;
        return {
          toolName,
          success: res.success,
          data: {
            balance: bal,
            formatted: `${bal.toLocaleString('vi-VN')}đ`,
            isAuthenticated: true,
          },
          actionData: {
            type: 'wallet',
            balance: bal,
          },
        };
      }

      case 'get_user_orders': {
        // Strict Authorization: Chỉ dùng context.userId đã xác thực
        if (!context.isAuthenticated || !context.userId) {
          return {
            toolName,
            success: false,
            data: [],
            message: 'Khách hàng chưa đăng nhập. Vui lòng đăng nhập để tra cứu lịch sử đơn hàng.',
          };
        }

        const paymentCode = typeof args.paymentCode === 'string' ? args.paymentCode.slice(0, 50).trim() : undefined;
        const productName = typeof args.productName === 'string' ? args.productName.slice(0, 100).trim() : undefined;
        const status = typeof args.status === 'string' ? args.status.slice(0, 30).trim() : undefined;

        const res = await getMyOrders(
          {
            paymentCode,
            status,
            productName,
            limit: 6,
          },
          context
        );

        const orders = res.data || [];
        return {
          toolName,
          success: res.success,
          data: orders.map((o) => ({
            id: o.id,
            paymentCode: o.payment_code,
            productName: o.product_name,
            planLabel: o.plan_label,
            price: o.price,
            status: o.status,
            createdAt: o.created_at,
            expiresAt: o.expires_at,
          })),
          actionData: {
            type: 'orders',
            orders,
          },
        };
      }

      case 'get_active_vouchers': {
        const res = await getActiveCoupons();
        const coupons = res.data || [];
        return {
          toolName,
          success: res.success,
          data: coupons.map((c) => ({
            code: c.code,
            name: c.name,
            description: c.description,
            discountValue: c.discount_value,
            discountType: c.discount_type,
            minOrder: c.minimum_order_amount,
          })),
          actionData: {
            type: 'vouchers',
            vouchers: coupons,
          },
        };
      }

      case 'get_warranty_policy': {
        const productName = typeof args.productName === 'string' ? args.productName.slice(0, 100).trim() : undefined;
        const res = await checkWarrantyPolicy({ productName });
        return {
          toolName,
          success: res.success,
          data: res.data,
        };
      }

      case 'request_order_warranty': {
        if (!context.isAuthenticated || !context.userId) {
          return {
            toolName,
            success: false,
            data: { eligible: false, isAuthenticated: false },
            message: 'Khách hàng chưa đăng nhập. Vui lòng đăng nhập để yêu cầu bảo hành đơn hàng.',
          };
        }

        const res = await getMyOrders({ limit: 12 }, context);
        const orders = res.data || [];
        const queryText = [args.paymentCode, args.productName, args.issueDescription, requestText].filter(Boolean).join(' ');
        const relevantOrder = findRelevantWarrantyOrder(orders, queryText);

        if (!relevantOrder) {
          return {
            toolName,
            success: false,
            data: { eligible: false, orderFound: false },
            message: args.paymentCode
              ? `Không tìm thấy đơn hàng mã "${args.paymentCode}" trong tài khoản của bạn.`
              : 'Không tìm thấy đơn hàng phù hợp trong tài khoản của bạn để bảo hành.',
          };
        }

        const status = relevantOrder.status;
        if (status === 'cancelled') {
          return {
            toolName,
            success: false,
            data: { eligible: false, status: 'cancelled', order: relevantOrder },
            message: `Đơn hàng ${relevantOrder.product_name} (${relevantOrder.payment_code}) đã bị hủy (cancelled) nên không thể tạo yêu cầu bảo hành.`,
            actionData: {
              type: 'warranty_rejected',
              order: relevantOrder,
              reason: 'ORDER_CANCELLED',
            },
          };
        }

        if (status === 'refunded') {
          return {
            toolName,
            success: false,
            data: { eligible: false, status: 'refunded', order: relevantOrder },
            message: `Đơn hàng ${relevantOrder.product_name} (${relevantOrder.payment_code}) đã được hoàn tiền (refunded) nên không còn trong phạm vi bảo hành.`,
            actionData: {
              type: 'warranty_rejected',
              order: relevantOrder,
              reason: 'ORDER_REFUNDED',
            },
          };
        }

        if (status === 'pending_payment') {
          return {
            toolName,
            success: false,
            data: { eligible: false, status: 'pending_payment', order: relevantOrder },
            message: `Đơn hàng ${relevantOrder.product_name} (${relevantOrder.payment_code}) chưa hoàn tất thanh toán (pending_payment).`,
            actionData: {
              type: 'warranty_rejected',
              order: relevantOrder,
              reason: 'PENDING_PAYMENT',
            },
          };
        }

        // Đơn hàng hợp lệ (completed, processing, pending_delivery)
        rememberOrderContext(relevantOrder);
        return {
          toolName,
          success: true,
          data: {
            eligible: true,
            order: {
              id: relevantOrder.id,
              paymentCode: relevantOrder.payment_code,
              productName: relevantOrder.product_name,
              planLabel: relevantOrder.plan_label,
              status: relevantOrder.status,
            },
            message: `Đơn hàng ${relevantOrder.product_name} (${relevantOrder.payment_code}) hợp lệ để gửi yêu cầu bảo hành.`,
          },
          actionData: {
            type: 'warranty_ticket',
            order: relevantOrder,
          },
        };
      }

      case 'get_support_channels': {
        const res = await getSupportChannels();
        return {
          toolName,
          success: res.success,
          data: res.data,
          actionData: {
            type: 'support',
          },
        };
      }

      case 'get_faqs': {
        const query = typeof args.query === 'string' ? args.query.slice(0, 150).trim() : undefined;
        const res = await getFaqsAndGuides({ query });
        return {
          toolName,
          success: res.success,
          data: res.data,
        };
      }

      case 'get_my_tickets': {
        // Strict Authorization: Chỉ dùng context.userId đã xác thực
        if (!context.isAuthenticated || !context.userId) {
          return {
            toolName,
            success: false,
            data: [],
            message: 'Khách hàng chưa đăng nhập. Vui lòng đăng nhập để xem ticket hỗ trợ.',
          };
        }

        const status = typeof args.status === 'string' ? args.status.slice(0, 30).trim() : undefined;
        const res = await getMyTickets({ status, limit: 6 }, context);
        const tickets = res.data || [];
        return {
          toolName,
          success: res.success,
          data: tickets.map((t) => ({
            id: t.id,
            ticketNumber: t.ticket_number,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            updatedAt: t.updated_at,
          })),
          actionData: {
            type: 'tickets',
            tickets,
          },
        };
      }

      default:
        return {
          toolName,
          success: false,
          data: null,
          message: `Tool "${toolName}" không được hỗ trợ trong hệ thống.`,
        };
    }
  } catch (err: any) {
    return {
      toolName,
      success: false,
      data: null,
      message: err?.message || 'Lỗi thực thi tool.',
    };
  }
}
