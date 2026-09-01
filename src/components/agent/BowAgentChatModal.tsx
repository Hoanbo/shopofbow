import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { processAgentMessage, processAgentMessageV2, type AgentMessage, type AgentAction } from '../../services/agent/agentEngine';
import type { AgentContext } from '../../services/agent/types';
import { clearSessionContext, getSessionContext } from '../../services/agent/sessionContext';
import { agentAnalytics } from '../../services/agent/monitoring/agentAnalytics';
import { useToast } from '../Toast';
import CheckoutModal from '../CheckoutModal';
import { AgentDepositModal } from './AgentDepositModal';
import { AgentWarrantyModal } from './AgentWarrantyModal';
import { fetchBySlug } from '../../data/api';
import type { CatalogItem, PlanTier } from '../../data/types';
import { supabase } from '../../lib/supabase';

interface BowAgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCheckoutDirect?: (productSlug: string, planId?: string) => void;
}

export default function BowAgentChatModal({ isOpen, onClose }: BowAgentChatModalProps) {
  const { session, profile, balance, isAdmin, isCtv } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'agent',
      content: `👋 Xin chào! Mình là ✨ **BOW Agent** — Trợ lý thông minh của **Shop of BOW**.\n\nMình có thể giúp bạn tìm sản phẩm, xem bảng giá, mua tài khoản 1-Click, kiểm tra đơn hàng hoặc hỗ trợ bảo hành 24/7. Bạn đang cần mình hỗ trợ điều gì? 🚀`,
      timestamp: new Date().toISOString(),
      suggestions: ['🛍️ Xem danh mục', '🔍 Tìm sản phẩm', '📦 Kiểm tra đơn hàng', '🎟️ Mã giảm giá'],
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [directCheckout, setDirectCheckout] = useState<{
    item: CatalogItem;
    plan: { id?: string; label: string; duration: string; price: number };
  } | null>(null);
  const [directDepositAmount, setDirectDepositAmount] = useState<number | null>(null);
  const [warrantyModalData, setWarrantyModalData] = useState<{ order: any; issue?: string } | null>(null);
  const [walletSuccessOrder, setWalletSuccessOrder] = useState<{ code: string; amount: number; qty: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const context: AgentContext = {
    userId: session?.user?.id,
    email: session?.user?.email,
    fullName: profile?.full_name,
    role: isAdmin ? 'admin' : isCtv ? 'ctv' : session ? 'user' : 'guest',
    balance: balance,
    isAuthenticated: !!session,
  };

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Theo dõi Session Started (chỉ gửi 1 lần mỗi khi mở)
  const hasTrackedSessionStart = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasTrackedSessionStart.current) {
        const currentSession = getSessionContext();
        agentAnalytics.track({
          eventType: 'SESSION_STARTED',
          sessionId: currentSession.updatedAt.toString(),
          userId: session?.user?.id,
        });
        hasTrackedSessionStart.current = true;
      }

      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    } else {
      hasTrackedSessionStart.current = false;
    }
  }, [isOpen, messages]);

  const handleResetChat = () => {
    clearSessionContext();
    setMessages([
      {
        id: 'welcome_msg_' + Date.now(),
        sender: 'agent',
        content: `👋 Xin chào! Mình là ✨ **BOW Agent** — Trợ lý thông minh của **Shop of BOW**.\n\nMình có thể giúp bạn tìm sản phẩm, xem bảng giá, mua tài khoản 1-Click, kiểm tra đơn hàng hoặc hỗ trợ bảo hành 24/7. Bạn đang cần mình hỗ trợ điều gì? 🚀`,
        timestamp: new Date().toISOString(),
        suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng', '🎟️ Mã giảm giá'],
      },
    ]);
    setInputValue('');
    setIsTyping(false);
    setExecutingActionId(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    const userMsg: AgentMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Giả lập độ trễ suy nghĩ nhẹ (250-350ms)
      await new Promise((r) => setTimeout(r, 300));

      let agentReply: AgentMessage;
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 9000)
        );

        agentReply = await Promise.race([
          processAgentMessage(text, context),
          timeoutPromise,
        ]);
      } catch (primaryErr) {
        console.warn('[BOW Agent Chat] Primary engine delayed or failed, activating instant deterministic V2 fallback:', primaryErr);
        agentReply = await processAgentMessageV2(text, context);
      }

      // Track ACTION_SHOWN
      const currentSession = getSessionContext();
      if (agentReply.action) {
        agentAnalytics.track({
          eventType: 'ACTION_SHOWN',
          actionId: agentReply.action.id,
          actionType: agentReply.action.type,
          productId: agentReply.action.payload.productId,
          planId: agentReply.action.payload.planId,
          sessionId: currentSession.updatedAt.toString(),
          userId: session?.user?.id,
        });
      }
      if (agentReply.actions) {
        agentReply.actions.forEach(act => {
          agentAnalytics.track({
            eventType: 'ACTION_SHOWN',
            actionId: act.id,
            actionType: act.type,
            productId: act.payload.productId,
            planId: act.payload.planId,
            sessionId: currentSession.updatedAt.toString(),
            userId: session?.user?.id,
          });
        });
      }

      setMessages((prev) => [...prev, agentReply]);
    } catch (err: any) {
      console.error('[BOW Agent Chat Error]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'agent',
          content: '⚠️ **Hiện mình chưa thể lấy dữ liệu lúc này.**\n\nBạn vui lòng thử lại sau ít phút hoặc nhắn tin trực tiếp [Zalo Hỗ Trực](https://zalo.me/0966821315) để được hỗ trợ tức thì nhé! 🙏',
          timestamp: new Date().toISOString(),
          suggestions: ['🛍️ Xem danh mục', 'Gặp hỗ trợ viên'],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Điều phối và thực thi Action Card (Anti Double-Click)
  const handleActionDispatch = async (action: AgentAction) => {
    if (executingActionId === action.id) return;
    
    const currentSession = getSessionContext();

    // Kiểm tra TTL
    if (action.expiresAt && Date.now() > action.expiresAt) {
      agentAnalytics.track({
        eventType: 'ACTION_EXPIRED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
      toast.error('Thao tác này đã hết hạn. Vui lòng thử lại.');
      return;
    }

    agentAnalytics.track({
      eventType: 'ACTION_CLICKED',
      actionId: action.id,
      actionType: action.type,
      productId: action.payload.productId,
      planId: action.payload.planId,
      sessionId: currentSession.updatedAt.toString(),
      userId: session?.user?.id,
    });

    // Workflow Tracking
    if (action.type === 'NAVIGATE_CHECKOUT') {
      agentAnalytics.track({
        eventType: 'CHECKOUT_OPENED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    } else if (action.type === 'NAVIGATE_RENEWAL') {
      agentAnalytics.track({
        eventType: 'RENEWAL_OPENED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    } else if (action.type === 'NAVIGATE_ORDER_DETAIL') {
      agentAnalytics.track({
        eventType: 'ORDER_VIEWED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    } else if (action.type === 'NAVIGATE_SUPPORT') {
      agentAnalytics.track({
        eventType: 'WARRANTY_OPENED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    } else if (action.type === 'OPEN_DEPOSIT') {
      agentAnalytics.track({
        eventType: 'DEPOSIT_OPENED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    } else if (action.type === 'APPLY_COUPON') {
      agentAnalytics.track({
        eventType: 'COUPON_APPLIED',
        actionId: action.id,
        actionType: action.type,
        productId: action.payload.productId,
        planId: action.payload.planId,
        sessionId: currentSession.updatedAt.toString(),
        userId: session?.user?.id,
      });
    }

    setExecutingActionId(action.id);

    try {
      switch (action.type) {
        case 'NAVIGATE_CHECKOUT': {
          const targetSlug = action.payload.productSlug || action.payload.productId;
          if (!targetSlug) {
            toast.error('Không tìm thấy thông tin sản phẩm.');
            break;
          }

          try {
            let item = await fetchBySlug(targetSlug);
            if (!item && action.payload.productId) {
              const { data: pData } = await supabase
                .from('products')
                .select('slug')
                .eq('id', action.payload.productId)
                .maybeSingle();
              if (pData?.slug) {
                item = await fetchBySlug(pData.slug);
              }
            }

            if (!item) {
              toast.error('Sản phẩm hiện không khả dụng.');
              break;
            }

            let matchedPlan: PlanTier | undefined = undefined;
            if (action.payload.planId) {
              matchedPlan = item.plans.find((p) => p.id === action.payload.planId);
            }
            if (!matchedPlan && action.payload.planLabel) {
              matchedPlan = item.plans.find((p) => p.label.toLowerCase() === action.payload.planLabel!.toLowerCase());
            }
            if (!matchedPlan) {
              matchedPlan = item.plans[0];
            }

            if (!matchedPlan) {
              toast.error('Gói cước không khả dụng.');
              break;
            }

            setDirectCheckout({
              item,
              plan: {
                id: matchedPlan.id,
                label: matchedPlan.label,
                duration: matchedPlan.duration,
                price: matchedPlan.price,
              },
            });
          } catch (err) {
            console.error('[Agent Direct Checkout Error]:', err);
            toast.error('Không thể mở giao diện thanh toán lúc này.');
          }
          break;
        }

        case 'NAVIGATE_ORDER_DETAIL': {
          onClose();
          navigate(`/dashboard?tab=orders&order_id=${action.payload.orderId}`);
          break;
        }

        case 'NAVIGATE_RENEWAL': {
          onClose();
          navigate(`/dashboard?tab=orders&order_id=${action.payload.orderId}&action=renew`);
          break;
        }

        case 'NAVIGATE_SUPPORT': {
          setWarrantyModalData({
            order: {
              id: action.payload.orderId,
              paymentCode: action.payload.paymentCode,
              productName: action.payload.productName,
            },
            issue: action.payload.issueDescription,
          });
          break;
        }

        case 'NAVIGATE_TICKET_DETAIL': {
          onClose();
          navigate(`/dashboard?tab=tickets&ticket_id=${action.payload.ticketId}`);
          break;
        }

        case 'APPLY_COUPON': {
          if (action.payload.couponCode) {
            sessionStorage.setItem('bow_applied_coupon', action.payload.couponCode);
            toast.success(`Đã lưu mã giảm giá ${action.payload.couponCode}! Mã sẽ tự động áp dụng khi thanh toán.`);
          }
          break;
        }

        case 'OPEN_DEPOSIT': {
          const amt = action.payload.amount || 50000;
          setDirectDepositAmount(amt);
          break;
        }

        default:
          console.warn('[ActionDispatcher] Unhandled action type:', action.type);
      }
    } finally {
      setTimeout(() => setExecutingActionId(null), 1000);
    }
  };

  // Render text có hỗ trợ markdown đơn giản và link nội bộ
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
      return (
        <p key={idx} className={`${line === '' ? 'h-2' : ''} leading-relaxed break-words`}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-extrabold text-[#0F172A] dark:text-white">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={pIdx} className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#2563EB] dark:text-[#38BDF8]">
                  {part.slice(1, -1)}
                </code>
              );
            }
            const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
            if (linkMatch) {
              const [, label, href] = linkMatch;
              const isExternal = href.startsWith('http');
              return (
                <a
                  key={pIdx}
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                  onClick={(e) => {
                    if (!isExternal) {
                      e.preventDefault();
                      onClose();
                      navigate(href);
                    }
                  }}
                  className="font-bold text-[#2563EB] dark:text-[#38BDF8] hover:underline underline-offset-2 transition inline-flex items-center gap-0.5"
                >
                  {label}
                </a>
              );
            }
            return <React.Fragment key={pIdx}>{part}</React.Fragment>;
          })}
        </p>
      );
    });
  };

  // Render Thẻ Hành Động Tương Tác (Action Card UI V2)
  const renderActionCard = (action: AgentAction) => {
    const isBusy = executingActionId === action.id;
    const isExpired = action.expiresAt ? Date.now() > action.expiresAt : false;

    if (action.type === 'NAVIGATE_CHECKOUT') {
      const planTitle = action.payload.planLabel || 'Gói bản quyền';
      return (
        <div className={`mt-2 rounded-2xl border ${isExpired ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 grayscale opacity-75' : 'border-blue-100 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 dark:from-[#162544] dark:to-[#121B30]'} p-3 shadow-xs space-y-2 animate-fade-up`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isExpired ? 'bg-slate-400' : 'bg-[#2563EB]'} text-white text-[11px] font-bold shadow-xs`}>
                ⚡
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                  {planTitle}
                </h4>
                {action.payload.productName && action.payload.productName !== planTitle && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {action.payload.productName}
                  </p>
                )}
              </div>
            </div>
            {action.payload.displayPrice ? (
              <span className={`font-mono text-xs font-extrabold shrink-0 ${isExpired ? 'text-slate-400' : 'text-[#2563EB] dark:text-[#38BDF8]'}`}>
                {action.payload.displayPrice.toLocaleString('vi-VN')}đ
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleActionDispatch(action)}
              disabled={isBusy || isExpired}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 ${isExpired ? 'bg-slate-400 shadow-none' : 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] hover:from-[#008AE0] hover:to-[#1D4ED8] active:scale-[0.98]'}`}
            >
              <span>{isExpired ? '⚠️' : (action.icon || '💳')}</span>
              <span>{isExpired ? 'Đã hết hạn' : (isBusy ? 'Đang xử lý...' : action.label.replace(/^[\p{Emoji}\s]+/u, ''))}</span>
            </button>
            
            {isExpired && (
              <button
                type="button"
                onClick={() => handleSend(action.payload.productName || 'Mua gói này')}
                className="shrink-0 flex h-[34px] px-2.5 items-center justify-center rounded-xl bg-blue-100 hover:bg-blue-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 font-bold transition cursor-pointer"
                title="Tải lại lựa chọn"
              >
                🔄
              </button>
            )}
          </div>
        </div>
      );
    }

    // Sanitize label to strip any leading emoji, ensuring icon is rendered strictly ONCE (component responsibility)
    const cleanActionLabel = (action.label || '').replace(/^[\p{Emoji}\u200d\uFE0F\s]+/u, '').trim() || action.label;

    if (action.type === 'NAVIGATE_RENEWAL' || action.type === 'NAVIGATE_SUPPORT') {
      const isSupport = action.type === 'NAVIGATE_SUPPORT';
      // Icon cho Header Badge đại diện cho đơn hàng (📦).
      // Icon trong nút bấm đại diện cho hành động (action.icon, vd: 🎫 Gửi yêu cầu bảo hành).
      const badgeIcon = '📦';

      return (
        <div className="mt-3 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 to-orange-50/30 dark:from-[#24211A] dark:to-[#1A1815] p-3.5 shadow-sm space-y-2.5 animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white text-xs shadow-xs">
              {badgeIcon}
            </span>
            <div>
              <h4 className="text-xs font-black text-[#0F172A] dark:text-white leading-tight">
                {action.payload.productName || 'Đơn hàng'}
              </h4>
              <p className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                Mã: {action.payload.paymentCode || 'N/A'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleActionDispatch(action)}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 px-3 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:scale-[1.01] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
          >
            <span>{action.icon || (isSupport ? '🎫' : '🔄')}</span>
            <span>{isBusy ? 'Đang mở...' : cleanActionLabel}</span>
          </button>
        </div>
      );
    }

    // Default Action Button Card
    return (
      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => handleActionDispatch(action)}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-2 px-3.5 text-xs font-bold text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
        >
          <span>{action.icon || '✨'}</span>
          <span>{isBusy ? 'Đang xử lý...' : cleanActionLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Chat Window Container */}
      <div className="relative z-10 flex flex-col w-full max-w-full sm:max-w-lg h-[90dvh] sm:h-[620px] rounded-t-[28px] sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#11192C] shadow-2xl overflow-hidden animate-slide-up text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-[#F0F7FF] to-white dark:from-[#162238] dark:to-[#11192C] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Avatar AI */}
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00A3FF] to-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-white dark:ring-slate-800">
              <span className="text-base sm:text-lg">✨</span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white dark:bg-slate-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate">
                  BOW Agent
                </h3>
                <span className="shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs">
                  V2 Guided
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                Trợ lý thông minh Shop of BOW
              </p>
            </div>
          </div>

          {/* Action Buttons: Reset & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              title="Làm mới hội thoại"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-[#2563EB] dark:hover:text-[#38BDF8] transition cursor-pointer active:scale-95 text-base font-bold"
              aria-label="Làm mới hội thoại"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 space-y-4 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs break-words [overflow-wrap:anywhere] ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white rounded-br-xs'
                    : 'bg-slate-50 dark:bg-[#18243E] text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800/80 rounded-bl-xs'
                }`}
              >
                {renderMessageContent(msg.content)}

                {/* Render Action Card đơn nếu có */}
                {msg.action && renderActionCard(msg.action)}

                {/* Render Nhiều Action Card (Plan Selection) nếu có - loại trừ action đơn đã render */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    {msg.actions
                      .filter(act => !msg.action || (act.id ? act.id !== msg.action.id : act.type !== msg.action.type))
                      .map(act => (
                        <div key={act.id || act.type}>
                          {renderActionCard(act)}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Suggestions Chips */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-full">
                  {msg.suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSend(sug)}
                      className="rounded-full bg-blue-50/80 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-blue-100 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] dark:text-[#38BDF8] transition cursor-pointer hover:scale-102 max-w-full truncate"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs py-1.5 px-1 animate-pulse">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/70 dark:bg-blue-900/40 text-[11px]">
                🔄
              </span>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 ml-1">Đang tra cứu dữ liệu...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#11192C] shrink-0">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-[#18243E] border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#00A3FF]/40 transition">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi giá gói, mua tài khoản, gia hạn, bảo hành..."
              className="flex-1 min-w-0 bg-transparent text-xs text-[#0F172A] dark:text-white placeholder:text-slate-400 focus:outline-none py-1.5"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-white transition cursor-pointer ${
                inputValue.trim() && !isTyping
                  ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] shadow-md shadow-blue-500/30 hover:scale-105'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
              }`}
              aria-label="Send"
            >
              <svg className="h-4 w-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-1 mt-2">
            <span>✨ Powered by BOW Agent V2 Engine</span>
            <span>Chế độ tương tác 100% an toàn</span>
          </div>
        </div>
      </div>

      {/* Direct Checkout Modal over Agent */}
      {directCheckout && (
        <CheckoutModal
          isOpen={true}
          onClose={() => setDirectCheckout(null)}
          item={directCheckout.item}
          plan={directCheckout.plan}
          onWalletSuccess={(order) => {
            setDirectCheckout(null);
            setWalletSuccessOrder(order);
          }}
        />
      )}

      {/* Direct Deposit Modal over Agent */}
      {directDepositAmount !== null && (
        <AgentDepositModal
          isOpen={true}
          initialAmount={directDepositAmount}
          onClose={() => setDirectDepositAmount(null)}
          onSuccess={() => {
            // refresh balance handled in modal
          }}
        />
      )}

      {/* Direct Warranty Modal over Agent (V3.3 Phase 4.3) */}
      {warrantyModalData !== null && (
        <AgentWarrantyModal
          isOpen={true}
          order={warrantyModalData.order}
          initialIssue={warrantyModalData.issue}
          onClose={() => setWarrantyModalData(null)}
          onTicketCreated={(_ticketId, ticketNum) => {
            setMessages((prev) => [
              ...prev,
              {
                id: 'sys_ticket_' + Date.now(),
                sender: 'agent',
                content: `✅ **Đã gửi yêu cầu bảo hành (\`${ticketNum}\`) thành công!**\n\nKỹ thuật viên đã nhận thông báo và sẽ phản hồi trong ít phút. Bạn có thể theo dõi tiến độ trong mục Ticket.`,
                timestamp: new Date().toISOString(),
                suggestions: ['💬 Xem trao đổi Ticket', '📦 Xem tất cả đơn', '🛍️ Xem danh mục'],
              },
            ]);
          }}
        />
      )}

      {/* Direct Wallet Success Modal over Agent */}
      {walletSuccessOrder && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setWalletSuccessOrder(null)} />
          <div className="relative w-full max-w-sm transform rounded-[26px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 text-center shadow-2xl transition-all animate-fade-up text-slate-900 dark:text-white">
            <div className="space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 text-2xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0F172A] dark:text-white">Đặt hàng thành công!</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">Mã đơn hàng: {walletSuccessOrder.code}</p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed">
                  Đơn hàng đã được chuyển sang trạng thái <strong>Chờ bàn giao</strong>. Admin sẽ thiết lập tài khoản và gửi thông tin qua email/mục đơn hàng trong 5 - 15 phút.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletSuccessOrder(null)}
                className="w-full rounded-full bg-[#0F172A] dark:bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-black dark:hover:bg-blue-700 transition cursor-pointer"
              >
                Đóng và tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
