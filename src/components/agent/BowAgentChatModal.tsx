import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { processAgentMessage, type AgentMessage, type AgentAction } from '../../services/agent/agentEngine';
import type { AgentContext } from '../../services/agent/types';
import { clearSessionContext, getSessionContext } from '../../services/agent/sessionContext';
import { agentAnalytics } from '../../services/agent/monitoring/agentAnalytics';
import { useToast } from '../Toast';

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
      suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng', '🎟️ Mã giảm giá'],
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
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

      // Timeout Guard 8s chống treo vô hạn
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      );

      const agentReply = await Promise.race([
        processAgentMessage(text, context),
        timeoutPromise,
      ]);

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
  const handleActionDispatch = (action: AgentAction) => {
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
          onClose();
          const targetSlug = action.payload.productSlug || action.payload.productId;
          const planQuery = action.payload.planId ? `?plan=${action.payload.planId}` : '';
          navigate(`/products/${targetSlug}${planQuery}`);
          toast.success(`Đang mở trang đặt mua ${action.payload.productName || 'sản phẩm'}...`);
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
          onClose();
          const orderParam = action.payload.orderId ? `&orderId=${action.payload.orderId}` : '';
          navigate(`/dashboard?tab=tickets&newTicket=1${orderParam}`);
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
          onClose();
          const amt = action.payload.amount || 50000;
          navigate(`/dashboard?tab=wallet&depositAmount=${amt}`);
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
      return (
        <div className={`mt-3 rounded-2xl border ${isExpired ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 grayscale opacity-75' : 'border-blue-100 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 dark:from-[#162544] dark:to-[#121B30]'} p-3.5 shadow-sm space-y-2.5 animate-fade-up`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${isExpired ? 'bg-slate-400' : 'bg-[#2563EB]'} text-white text-xs shadow-xs`}>
                🎬
              </span>
              <div>
                <h4 className="text-xs font-black text-[#0F172A] dark:text-white leading-tight">
                  {action.payload.productName || 'Gói bản quyền'}
                </h4>
                <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                  {action.payload.planLabel || 'Bản quyền chính hãng'}
                </p>
              </div>
            </div>
            {action.payload.displayPrice ? (
              <span className={`font-mono text-xs font-black ${isExpired ? 'text-slate-400' : 'text-[#2563EB] dark:text-[#38BDF8]'}`}>
                {action.payload.displayPrice.toLocaleString('vi-VN')}đ
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleActionDispatch(action)}
              disabled={isBusy || isExpired}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-black text-white shadow-md transition cursor-pointer disabled:opacity-50 ${isExpired ? 'bg-slate-400 shadow-none' : 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] shadow-blue-500/25 hover:from-[#008AE0] hover:to-[#1D4ED8] hover:scale-[1.01] active:scale-[0.98]'}`}
            >
              <span>{isExpired ? '⚠️' : (action.icon || '💳')}</span>
              <span>{isExpired ? 'Đã hết hạn' : (isBusy ? 'Đang mở thanh toán...' : action.label)}</span>
            </button>
            
            {isExpired && (
              <button
                type="button"
                onClick={() => handleSend(action.payload.productName || 'Mua gói này')}
                className="shrink-0 flex h-[38px] px-3 items-center justify-center rounded-xl bg-blue-100 hover:bg-blue-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 font-bold transition cursor-pointer"
                title="Tải lại lựa chọn"
              >
                🔄
              </button>
            )}
          </div>
        </div>
      );
    }

    if (action.type === 'NAVIGATE_RENEWAL' || action.type === 'NAVIGATE_SUPPORT') {
      return (
        <div className="mt-3 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 to-orange-50/30 dark:from-[#24211A] dark:to-[#1A1815] p-3.5 shadow-sm space-y-2.5 animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white text-xs shadow-xs">
              {action.icon || '🔄'}
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
            <span>{action.icon || '🔄'}</span>
            <span>{isBusy ? 'Đang mở...' : action.label}</span>
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
          <span>{isBusy ? 'Đang xử lý...' : action.label}</span>
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

                {/* Render Nhiều Action Card (Plan Selection) nếu có */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    {msg.actions.map(act => (
                      <div key={act.id}>
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
                      💡 {sug}
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
    </div>
  );
}
