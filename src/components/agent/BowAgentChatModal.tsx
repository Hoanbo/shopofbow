import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { processAgentMessage, type AgentMessage } from '../../services/agent/agentEngine';
import type { AgentContext } from '../../services/agent/permissions';

interface BowAgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BowAgentChatModal({ isOpen, onClose }: BowAgentChatModalProps) {
  const { session, profile, balance, isAdmin, isCtv } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'agent',
      content: `👋 Xin chào! Mình là ✨ **BOW Agent** — Trợ lý thông minh của **Shop of BOW**.\n\nMình có thể giúp bạn tìm sản phẩm, xem bảng giá, kiểm tra đơn hàng hoặc nhận mã giảm giá 24/7. Bạn đang cần mình hỗ trợ điều gì? 🚀`,
      timestamp: new Date().toISOString(),
      suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng', '🎟️ Mã giảm giá'],
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, messages]);

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome_msg_' + Date.now(),
        sender: 'agent',
        content: `👋 Xin chào! Mình là ✨ **BOW Agent** — Trợ lý thông minh của **Shop of BOW**.\n\nMình có thể giúp bạn tìm sản phẩm, xem bảng giá, kiểm tra đơn hàng hoặc nhận mã giảm giá 24/7. Bạn đang cần mình hỗ trợ điều gì? 🚀`,
        timestamp: new Date().toISOString(),
        suggestions: ['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng', '🎟️ Mã giảm giá'],
      },
    ]);
    setInputValue('');
    setIsTyping(false);
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
      // Giả lập độ trễ suy nghĩ nhẹ (300-500ms) để tự nhiên
      await new Promise((r) => setTimeout(r, 350));
      
      // Timeout Guard 8s chống treo vô hạn
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      );

      const agentReply = await Promise.race([
        processAgentMessage(text, context),
        timeoutPromise,
      ]);

      setMessages((prev) => [...prev, agentReply]);
    } catch (err: any) {
      console.error('[BOW Agent Chat Error]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'agent',
          content: '⚠️ **Hiện mình chưa thể lấy dữ liệu lúc này.**\n\nBạn vui lòng thử lại sau ít phút hoặc nhắn tin trực tiếp [Zalo Hỗ Trợ](https://zalo.me/0966821315) để được hỗ trợ tức thì nhé! 🙏',
          timestamp: new Date().toISOString(),
          suggestions: ['🛍️ Tất cả sản phẩm', 'Gặp hỗ trợ viên'],
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

  // Render text có hỗ trợ markdown đơn giản và link nội bộ
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Parse markdown bold **text**
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
                  className="font-bold text-[#2563EB] dark:text-[#38BDF8] underline decoration-blue-400 hover:text-blue-700 transition"
                >
                  {label}
                </a>
              );
            }
            return part;
          })}
        </p>
      );
    });
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
                <span className="shrink-0 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.5 text-[9px] font-black text-[#2563EB] dark:text-[#38BDF8]">
                  V1 AI
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
                className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs break-words [overflow-wrap:anywhere] ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white rounded-br-xs'
                    : 'bg-slate-50 dark:bg-[#18243E] text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800/80 rounded-bl-xs'
                }`}
              >
                {renderMessageContent(msg.content)}
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
              placeholder="Hỏi giá gói, kiểm tra đơn hàng, bảo hành..."
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
            <span>✨ Powered by BOW Agent Engine</span>
            <span>Chế độ an toàn 100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
