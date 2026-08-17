import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../icons';
import { extractPromptVariables, buildCustomizedPrompt } from '../../utils/promptUtils';
import { useToast } from '../Toast';

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
  onCopy: (prompt: PromptItem, customContent?: string) => void;
  isCopied: boolean;
  onTagClick?: (tag: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; bg: string; text: string; border: string; aiUrl?: string; aiLabel?: string; desc: string }
> = {
  chatgpt: {
    label: 'ChatGPT',
    icon: '🤖',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
    aiUrl: 'https://chatgpt.com',
    aiLabel: 'Mở ChatGPT',
    desc: 'Chạy tốt nhất trên mô hình GPT-4o / ChatGPT Plus để có kết quả chính xác và lập luận sâu sắc nhất.',
  },
  midjourney: {
    label: 'Midjourney',
    icon: '🎨',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200/60 dark:border-purple-900/40',
    aiUrl: 'https://www.midjourney.com',
    aiLabel: 'Mở Midjourney',
    desc: 'Tối ưu cho Midjourney v6 / Niji 6 để tạo ra hình ảnh chất lượng 8K chuẩn nhiếp ảnh thương mại.',
  },
  claude: {
    label: 'Claude',
    icon: '⚡',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
    aiUrl: 'https://claude.ai/new',
    aiLabel: 'Mở Claude.ai',
    desc: 'Khuyên dùng với Claude 3.5 Sonnet để audit code, viết logic phức tạp và xử lý văn bản chuyên sâu.',
  },
  capcut: {
    label: 'CapCut',
    icon: '🎬',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-[#00A3FF] dark:text-[#35A8FF]',
    border: 'border-sky-200/60 dark:border-sky-900/40',
    aiUrl: 'https://www.capcut.com',
    aiLabel: 'Mở CapCut',
    desc: 'Sử dụng kèm kịch bản video để cắt ghép trên CapCut Pro không giới hạn hiệu ứng cao cấp.',
  },
  flux: {
    label: 'Flux & SD',
    icon: '🔮',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
    aiUrl: 'https://leonardo.ai',
    aiLabel: 'Mở Leonardo AI',
    desc: 'Phù hợp với Flux.1, Stable Diffusion XL và Leonardo AI để vẽ ảnh sáng tạo nghệ thuật.',
  },
  canva: {
    label: 'Canva',
    icon: '🖌️',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200/60 dark:border-cyan-900/40',
    aiUrl: 'https://www.canva.com',
    aiLabel: 'Mở Canva',
    desc: 'Áp dụng cho thiết kế đồ họa, bài đăng mạng xã hội và banner bán hàng chuyên nghiệp.',
  },
};

export default function PromptDetailModal({
  prompt,
  onClose,
  onCopy,
  isCopied,
  onTagClick,
  isFavorite = false,
  onToggleFavorite,
}: PromptDetailModalProps) {
  const [imgError, setImgError] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [activeViewMode, setActiveViewMode] = useState<'customizer' | 'preview'>('customizer');
  const toast = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  // Parse variables
  const variables = useMemo(() => {
    if (!prompt?.prompt_content) return [];
    return extractPromptVariables(prompt.prompt_content, prompt.category);
  }, [prompt?.prompt_content, prompt?.category]);

  // Reset variable state when prompt changes
  useEffect(() => {
    setImgError(false);
    setVariableValues({});
    setActiveViewMode(variables.length > 0 ? 'customizer' : 'preview');
  }, [prompt?.id, variables.length]);

  // Lock body scroll
  useEffect(() => {
    if (!prompt) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [prompt]);

  // Compute final filled prompt
  const customizedPrompt = useMemo(() => {
    if (!prompt) return '';
    return buildCustomizedPrompt(prompt.prompt_content, variableValues);
  }, [prompt, variableValues]);

  // Count filled variables
  const filledCount = useMemo(() => {
    return Object.values(variableValues).filter((v) => v && v.trim()).length;
  }, [variableValues]);

  if (!prompt) return null;

  const catMeta = CATEGORY_META[prompt.category.toLowerCase()] || {
    label: prompt.category.toUpperCase(),
    icon: '💡',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    desc: 'Áp dụng câu lệnh này vào các công cụ AI tương ứng để đạt hiệu quả tối ưu.',
  };

  const handleSetVariable = (rawKey: string, val: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [rawKey]: val,
    }));
  };

  const handleResetVariables = () => {
    setVariableValues({});
    toast.info('Đã xóa dữ liệu tùy biến về mặc định.');
  };

  // Launch direct in AI tool
  const handleLaunchAI = (url?: string) => {
    if (!url) return;
    onCopy(prompt, customizedPrompt);
    toast.success(`Đã sao chép Prompt & đang mở ${catMeta.aiLabel || 'Web AI'}...`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 overscroll-contain overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-[100000] w-full max-w-4xl max-h-[92dvh] sm:max-h-[94dvh] my-auto flex flex-col overflow-hidden rounded-[26px] sm:rounded-[32px] border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#111A2E] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#111A2E]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-xl shrink-0 shadow-xs">
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
                {variables.length > 0 && (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                    <span>🎛️</span> {variables.length} biến tùy biến
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400 font-semibold hidden sm:inline-flex items-center gap-1">
                  <span>📋</span> {prompt.copy_count} lượt sao chép
                </span>
              </div>
              <h3 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5" title={prompt.title}>
                {prompt.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Favorite Button */}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(prompt.id)}
                title={isFavorite ? 'Bỏ lưu yêu thích' : 'Lưu Prompt vào bộ sưu tập'}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isFavorite
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-500 border border-rose-200 dark:border-rose-800 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                <span className="text-base">{isFavorite ? '❤️' : '🤍'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Switch on Mobile & Desktop if Variables Exist */}
        {variables.length > 0 && (
          <div className="lg:hidden flex items-center border-b border-slate-100 dark:border-slate-800/80 px-4 py-2 bg-slate-50/60 dark:bg-[#18243E]/40 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveViewMode('customizer')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeViewMode === 'customizer'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>🎛️ Điền thông số ({filledCount}/{variables.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('preview')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeViewMode === 'preview'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>📜 Xem kết quả</span>
            </button>
          </div>
        )}

        {/* Scrollable Content Body (2-Column on LG if Variables, or 1-Column) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Header Summary / Description */}
          {prompt.description && (
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 sm:p-4 space-y-1">
              <h4 className="text-[11px] font-black text-[#2563EB] dark:text-[#35A8FF] uppercase tracking-wider flex items-center gap-1.5">
                <span>🎯</span> Mục đích & Kết quả đạt được:
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                {prompt.description}
              </p>
            </div>
          )}

          {/* Interactive Variable Customizer & Live Preview Layout */}
          {variables.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* LEFT COLUMN: Interactive Input Form (hidden on mobile if in 'preview' mode) */}
              <div className={`lg:col-span-6 space-y-4 ${activeViewMode === 'preview' ? 'hidden lg:block' : 'block'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎛️</span> Điền thông số của bạn:
                  </h4>
                  {filledCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetVariables}
                      className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>✕</span> Xóa dữ liệu đã điền
                    </button>
                  )}
                </div>

                <div className="space-y-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-[#16223B]/80 p-4 shadow-inner">
                  {variables.map((v, idx) => {
                    const currentVal = variableValues[v.raw] || '';
                    const hasVal = Boolean(currentVal.trim());

                    return (
                      <div key={v.raw} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#2563EB] dark:text-[#35A8FF] text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span>{v.name}</span>
                          </label>
                          {v.defaultHint && (
                            <span className="text-[10px] font-mono text-slate-400">
                              (Mẫu: {v.defaultHint})
                            </span>
                          )}
                        </div>

                        {/* Input Field with Clear Button */}
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => handleSetVariable(v.raw, e.target.value)}
                            placeholder={`Nhập ${v.name.toLowerCase()}...`}
                            className={`w-full h-10 rounded-xl border bg-white dark:bg-[#0E1626] px-3 text-xs font-medium text-slate-900 dark:text-white shadow-2xs focus:outline-none transition ${
                              hasVal
                                ? 'border-[#2563EB] dark:border-[#35A8FF] ring-1 ring-blue-500/20'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          />
                          {hasVal && (
                            <button
                              type="button"
                              onClick={() => handleSetVariable(v.raw, '')}
                              className="absolute right-2.5 h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center text-[10px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Preset Suggestion Chips */}
                        {v.options && v.options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {v.options.map((opt) => {
                              const isSelected = currentVal === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleSetVariable(v.raw, opt)}
                                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-white dark:bg-[#0E1626] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                                  }`}
                                >
                                  + {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: Live Preview Code Box (hidden on mobile if in 'customizer' mode) */}
              <div className={`lg:col-span-6 space-y-4 ${activeViewMode === 'customizer' ? 'hidden lg:block' : 'block'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>📜</span> Câu lệnh thời gian thực (Live Preview):
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded-full">
                    {filledCount > 0 ? `✓ Đã điền ${filledCount}/${variables.length} biến` : 'Bản gốc'}
                  </span>
                </div>

                <div
                  ref={previewRef}
                  className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-950 p-4 font-mono text-xs sm:text-[13px] text-slate-100 leading-relaxed shadow-inner max-h-[380px] overflow-y-auto select-all"
                >
                  <pre className="whitespace-pre-wrap font-mono break-words">{customizedPrompt}</pre>
                </div>

                {/* Quick Copy customized vs original */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onCopy(prompt, customizedPrompt)}
                    className="flex-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 py-2 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📋</span>
                    <span>Sao chép câu lệnh đã điền</span>
                  </button>
                  {filledCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onCopy(prompt, prompt.prompt_content)}
                      title="Sao chép câu lệnh mẫu gốc với các ngoặc vuông"
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Bản gốc
                    </button>
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* Single Column Full Code Box when No Variables */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> Chi tiết câu lệnh Prompt:
                </h4>
              </div>

              <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-950 p-4 font-mono text-xs sm:text-[13px] text-slate-100 leading-relaxed shadow-inner max-h-[380px] overflow-y-auto select-all">
                <pre className="whitespace-pre-wrap font-mono break-words">{prompt.prompt_content}</pre>
              </div>
            </div>
          )}

          {/* Thumbnail Image Showcase if Available */}
          {prompt.image_url && !imgError && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🖼️</span> Kết quả mẫu thực tế từ câu lệnh này:
              </h4>
              <div className="relative h-60 sm:h-80 w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-sm">
                <img
                  src={prompt.image_url}
                  alt={prompt.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* AI Model Recommendation & Tags */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="text-xs space-y-0.5">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>⚡</span> Khuyên dùng: <span className="text-[#2563EB] dark:text-[#35A8FF] font-black">{catMeta.label}</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {catMeta.desc}
              </p>
            </div>

            {prompt.tags && prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {prompt.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (onTagClick) onTagClick(tag);
                      onClose();
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-[#2563EB] dark:text-slate-400 dark:hover:text-[#35A8FF] bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg transition cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Fixed Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 p-3.5 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#16223B]/80 shrink-0">
          
          {/* Direct Launch to Web AI Button (if url available) */}
          {catMeta.aiUrl && (
            <button
              type="button"
              onClick={() => handleLaunchAI(catMeta.aiUrl)}
              className="w-full sm:w-auto rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-4 py-2.5 text-xs font-black text-emerald-700 dark:text-emerald-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>🚀</span>
              <span>Sao chép & {catMeta.aiLabel}</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => onCopy(prompt, customizedPrompt)}
              className={`flex-2 sm:flex-none rounded-full font-black text-xs px-6 py-2.5 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-500 text-white scale-98'
                  : 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] text-white shadow-blue-500/25'
              }`}
            >
              {isCopied ? (
                <span>✓ Đã sao chép vào Clipboard!</span>
              ) : (
                <>
                  <span>📋</span>
                  <span>Sao chép câu lệnh {filledCount > 0 ? 'đã điền' : ''}</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
