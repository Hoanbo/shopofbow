import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../icons';

export interface PromptItem {
  id: string;
  title: string;
  category: string;
  prompt_content: string;
  image_url?: string | null;
  description?: string | null;
  tags?: string[] | null;
  copy_count: number;
  is_featured: boolean;
  created_at: string;
}

interface PromptDetailModalProps {
  prompt: PromptItem | null;
  onClose: () => void;
  onCopy: (prompt: PromptItem) => void;
  isCopied: boolean;
  onTagClick?: (tag: string) => void;
}

const CATEGORY_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string; productLink: string; productName: string; desc: string }> = {
  chatgpt: {
    label: 'ChatGPT',
    icon: '🤖',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
    productLink: '/?search=chatgpt',
    productName: 'ChatGPT Plus',
    desc: 'Chạy tốt nhất trên mô hình GPT-4o / ChatGPT Plus để có kết quả chính xác và lập luận sâu sắc nhất.',
  },
  midjourney: {
    label: 'Midjourney',
    icon: '🎨',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200/60 dark:border-purple-900/40',
    productLink: '/?search=midjourney',
    productName: 'Midjourney Pro',
    desc: 'Tối ưu cho Midjourney v6 / Niji 6 để tạo ra hình ảnh chất lượng 8K chuẩn nhiếp ảnh thương mại.',
  },
  claude: {
    label: 'Claude',
    icon: '⚡',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
    productLink: '/?search=claude',
    productName: 'Claude 3.5 Sonnet',
    desc: 'Khuyên dùng với Claude 3.5 Sonnet để audit code, viết logic phức tạp và xử lý văn bản chuyên sâu.',
  },
  capcut: {
    label: 'CapCut',
    icon: '🎬',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-[#00A3FF] dark:text-[#35A8FF]',
    border: 'border-sky-200/60 dark:border-sky-900/40',
    productLink: '/?search=capcut',
    productName: 'CapCut Pro',
    desc: 'Sử dụng kèm kịch bản video để cắt ghép trên CapCut Pro không giới hạn hiệu ứng cao cấp.',
  },
  flux: {
    label: 'Flux & SD',
    icon: '🔮',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
    productLink: '/?search=ai',
    productName: 'AI Image Generator',
    desc: 'Phù hợp với Flux.1, Stable Diffusion XL và Leonardo AI để vẽ ảnh sáng tạo nghệ thuật.',
  },
  canva: {
    label: 'Canva',
    icon: '🖌️',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200/60 dark:border-cyan-900/40',
    productLink: '/?search=canva',
    productName: 'Canva Pro',
    desc: 'Áp dụng cho thiết kế đồ họa, bài đăng mạng xã hội và banner bán hàng chuyên nghiệp.',
  },
};

export default function PromptDetailModal({
  prompt,
  onClose,
  onCopy,
  isCopied,
  onTagClick,
}: PromptDetailModalProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [prompt?.id]);

  useEffect(() => {
    if (!prompt) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [prompt]);

  if (!prompt) return null;

  const catMeta = CATEGORY_META[prompt.category.toLowerCase()] || {
    label: prompt.category.toUpperCase(),
    icon: '💡',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    productLink: '/',
    productName: 'Công cụ AI',
    desc: 'Áp dụng câu lệnh này vào các công cụ AI tương ứng để đạt hiệu quả tối ưu.',
  };

  // Trích xuất các biến placeholder dạng [BIẾN] để hướng dẫn người dùng
  const placeholders = Array.from(new Set(prompt.prompt_content.match(/\[([^[\]]+)\]/g) || [])).slice(0, 5);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-[100000] w-full max-w-2xl max-h-[90dvh] sm:max-h-[92dvh] my-auto flex flex-col overflow-hidden rounded-[26px] sm:rounded-[30px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#131C32]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-xl shrink-0">
              {catMeta.icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}>
                  {catMeta.label}
                </span>
                {prompt.is_featured && (
                  <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-black shadow-xs flex items-center gap-1">
                    <span>⭐</span> Nổi bật
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1">
                  <span>📋</span> {prompt.copy_count} lượt sao chép
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                {prompt.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* 1. Thumbnail Image or Visual Header */}
          {prompt.image_url && !imgError ? (
            <div className="relative h-56 sm:h-72 w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-sm group">
              <img
                src={prompt.image_url}
                alt={prompt.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                <span className="text-xs font-bold text-white/90 bg-black/40 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10">
                  🖼️ Kết quả mẫu thực tế tạo bởi câu lệnh này
                </span>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br ${
              prompt.category.toLowerCase() === 'chatgpt' ? 'from-emerald-600/20 via-teal-900/30 to-slate-900' :
              prompt.category.toLowerCase() === 'midjourney' ? 'from-purple-600/20 via-indigo-900/30 to-slate-900' :
              prompt.category.toLowerCase() === 'claude' ? 'from-amber-600/20 via-orange-900/30 to-slate-900' :
              prompt.category.toLowerCase() === 'capcut' ? 'from-sky-600/20 via-blue-900/30 to-slate-900' :
              'from-blue-600/20 via-indigo-900/30 to-slate-900'
            } p-5 flex items-center gap-4`}>
              <span className="text-4xl p-3 rounded-2xl bg-white/10 backdrop-blur-md shadow-xs">
                {catMeta.icon}
              </span>
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider block">
                  {catMeta.label} Mega-Prompt
                </span>
                <p className="text-xs sm:text-sm text-slate-200 font-bold mt-0.5 leading-snug">
                  {prompt.title}
                </p>
              </div>
            </div>
          )}

          {/* 2. Mục đích & Kết quả đạt được (Description) */}
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-2">
            <h4 className="text-xs font-black text-[#2563EB] dark:text-[#35A8FF] uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯</span> Mục đích & Kết quả đạt được:
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
              {prompt.description || 'Prompt được tối ưu hóa cấu trúc chuyên sâu giúp bạn đạt được kết quả chính xác, tiết kiệm tối đa thời gian thử sai.'}
            </p>
          </div>

          {/* 3. Hướng dẫn thay thế biến (nếu có các ô [BIẾN]) */}
          {placeholders.length > 0 && (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2">
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>💡</span> Các phần bạn cần điền thông tin của bạn vào:
              </h4>
              <div className="flex flex-wrap gap-2 pt-1">
                {placeholders.map((ph) => (
                  <span
                    key={ph}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800"
                  >
                    {ph}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-0.5">
                👉 Sau khi sao chép, bạn chỉ cần thay thế các đoạn chữ trong ngoặc vuông <code>[...]</code> bằng nội dung thực tế của bạn.
              </p>
            </div>
          )}

          {/* 4. Full Prompt Code Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📜</span> Chi tiết câu lệnh Prompt:
              </h4>
            </div>

            <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-900 p-4 font-mono text-xs sm:text-[13px] text-slate-100 leading-relaxed shadow-inner overflow-x-auto select-all">
              <pre className="whitespace-pre-wrap font-mono break-words">{prompt.prompt_content}</pre>
            </div>
          </div>

          {/* 5. Gợi ý mô hình AI tối ưu (Thuần thông tin, không nút mua) */}
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 p-4 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-black text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm">
              <span>🚀</span> Khuyên dùng với: <span className="text-[#2563EB] dark:text-[#35A8FF]">{catMeta.productName}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              {catMeta.desc}
            </p>
          </div>

          {/* 6. Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-slate-400 block">Từ khóa liên quan:</span>
              <div className="flex flex-wrap gap-1.5">
                {prompt.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (onTagClick) onTagClick(tag);
                      onClose();
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-[#2563EB] dark:text-slate-400 dark:hover:text-[#35A8FF] bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer Actions */}
        <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E]/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={() => onCopy(prompt)}
            className={`flex-[2] rounded-full font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              isCopied
                ? 'bg-emerald-500 text-white scale-98'
                : 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] text-white shadow-blue-500/25'
            }`}
          >
            {isCopied ? (
              <span>✓ Đã sao chép câu lệnh!</span>
            ) : (
              <>
                <span>📋</span>
                <span>Sao chép toàn bộ Prompt</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
