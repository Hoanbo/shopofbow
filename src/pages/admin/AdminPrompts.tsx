import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Pagination } from '../../components/admin/Pagination';
import { ConfirmModal } from '../../components/ConfirmModal';
import { uploadImage } from '../../data/admin';

interface PromptRow {
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
  updated_at?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'claude', label: 'Claude' },
  { value: 'capcut', label: 'CapCut' },
  { value: 'flux', label: 'Flux & SD' },
  { value: 'canva', label: 'Canva' },
  { value: 'other', label: 'Khác' },
];

const CATEGORY_TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  chatgpt: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/60' },
  midjourney: { bg: 'bg-purple-50 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800/60' },
  claude: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/60' },
  capcut: { bg: 'bg-cyan-50 dark:bg-cyan-950/50', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/60' },
  flux: { bg: 'bg-rose-50 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/60' },
  canva: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/60' },
  other: { bg: 'bg-slate-50 dark:bg-slate-900/50', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' },
};

export default function AdminPrompts() {
  const toast = useToast();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PromptRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<PromptRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'chatgpt',
    prompt_content: '',
    image_url: '',
    description: '',
    tags: '',
    is_featured: false,
  });

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB!');
      return;
    }
    setUploadingImage(true);
    try {
      const publicUrl = await uploadImage(file, 'prompts');
      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast.success('Tải ảnh lên thành công!');
    } catch (err: any) {
      console.error('Error uploading prompt image:', err);
      toast.error('Lỗi khi tải ảnh: ' + (err.message || 'Thất bại'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchAdminPrompts();
  }, []);

  const fetchAdminPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('ai_prompts')
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setPrompts(data || []);
    } catch (err: any) {
      console.error('Error fetching admin prompts:', err);
      toast.error('Lỗi khi tải danh sách Prompt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      category: 'chatgpt',
      prompt_content: '',
      image_url: '',
      description: '',
      tags: '',
      is_featured: false,
    });
    setShowEditorModal(true);
  };

  const openEditModal = (item: PromptRow) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      prompt_content: item.prompt_content,
      image_url: item.image_url || '',
      description: item.description || '',
      tags: (item.tags || []).join(', '),
      is_featured: item.is_featured,
    });
    setShowEditorModal(true);
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.prompt_content.trim()) {
      toast.error('Vui lòng nhập Tiêu đề và Nội dung câu lệnh Prompt.');
      return;
    }

    setSaving(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        prompt_content: formData.prompt_content.trim(),
        image_url: formData.image_url.trim() || null,
        description: formData.description.trim() || null,
        tags: tagsArray,
        is_featured: formData.is_featured,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await ((supabase.from('ai_prompts') as any)
          .update(payload)
          .eq('id', editingItem.id));
        if (error) throw error;
        toast.success('✓ Cập nhật Prompt thành công!');
      } else {
        const { error } = await ((supabase.from('ai_prompts') as any)
          .insert(payload));
        if (error) throw error;
        toast.success('✓ Thêm mới Prompt thành công!');
      }

      setShowEditorModal(false);
      fetchAdminPrompts();
    } catch (err: any) {
      console.error('Error saving prompt:', err);
      toast.error(err.message || 'Không thể lưu Prompt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!deletingItem) return;
    try {
      const { error } = await ((supabase.from('ai_prompts') as any)
        .delete()
        .eq('id', deletingItem.id));

      if (error) throw error;
      toast.success('✓ Đã xóa Prompt thành công!');
      setDeletingItem(null);
      fetchAdminPrompts();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa Prompt.');
    }
  };

  const toggleFeatured = async (item: PromptRow) => {
    try {
      const nextVal = !item.is_featured;
      const { error } = await ((supabase.from('ai_prompts') as any)
        .update({ is_featured: nextVal, updated_at: new Date().toISOString() })
        .eq('id', item.id));

      if (error) throw error;
      setPrompts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, is_featured: nextVal } : p))
      );
      toast.success(nextVal ? '⭐ Đã đánh dấu Nổi bật' : 'Đã bỏ đánh dấu Nổi bật');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật');
    }
  };

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchContent = p.prompt_content.toLowerCase().includes(q);

      return matchTitle || matchDesc || matchContent;
    });
  }, [prompts, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage) || 1;
  const paginatedPrompts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPrompts.slice(start, start + itemsPerPage);
  }, [filteredPrompts, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>✨</span> Quản lý Thư viện Prompt AI
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Thêm mới, biên tập và quản lý các câu lệnh mẫu cho khách hàng sao chép miễn phí.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:scale-102 cursor-pointer"
        >
          <span>➕</span>
          <span>Thêm Prompt Mới</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Tìm kiếm Prompt..."
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none transition"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar scrollbar-none">
          <button
            type="button"
            onClick={() => { setSelectedCategory('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedCategory === 'all'
              ? 'bg-[#2563EB] text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
          >
            Tất cả ({prompts.length})
          </button>
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => { setSelectedCategory(cat.value); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedCategory === cat.value
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompts List Container */}
      {loading ? (
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-16 text-center text-xs text-slate-400 font-medium animate-pulse shadow-xs">
          Đang tải dữ liệu Prompt AI...
        </div>
      ) : paginatedPrompts.length === 0 ? (
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-16 text-center space-y-2 shadow-xs">
          <span className="text-3xl block">📝</span>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa có Prompt nào</p>
          <p className="text-[11px] text-slate-400">Hãy nhấn "Thêm Prompt Mới" để tạo câu lệnh mẫu đầu tiên.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3.5 px-4">Ảnh / Tiêu đề</th>
                    <th className="py-3.5 px-3">Danh mục</th>
                    <th className="py-3.5 px-3">Lượt chép</th>
                    <th className="py-3.5 px-3">Nổi bật</th>
                    <th className="py-3.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedPrompts.map((p) => {
                    const catStyle = CATEGORY_TAG_STYLES[p.category.toLowerCase()] || CATEGORY_TAG_STYLES.other;
                    return (
                      <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base shrink-0">
                                ✨
                              </div>
                            )}
                            <div className="min-w-0 max-w-sm">
                              <span className="font-bold text-slate-900 dark:text-white block truncate">{p.title}</span>
                              <span className="text-[11px] font-mono text-slate-400 block truncate mt-0.5">{p.prompt_content}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-slate-700 dark:text-slate-300">
                          📋 {p.copy_count}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleFeatured(p)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition ${p.is_featured
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                              }`}
                          >
                            {p.is_featured ? '⭐ Nổi bật' : '☆ Thường'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                              title="Chỉnh sửa"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingItem(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Xóa"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Distinct Elevated Cards */}
          <div className="md:hidden space-y-3.5">
            {paginatedPrompts.map((p) => {
              const catStyle = CATEGORY_TAG_STYLES[p.category.toLowerCase()] || CATEGORY_TAG_STYLES.other;
              return (
                <div
                  key={p.id}
                  className="rounded-[24px] border border-slate-200/80 dark:border-[#1E2A4A]/80 bg-white dark:bg-[#131C32] p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                >
                  {/* Top Bar: Category badge & Action buttons */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/70 pb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                        {p.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFeatured(p)}
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition cursor-pointer flex items-center gap-1 ${p.is_featured
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                      >
                        <span>{p.is_featured ? '⭐ Nổi bật' : '☆ Thường'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                      >
                        <span>✏️</span>
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingItem(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer"
                      >
                        <span>🗑️</span>
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                    {p.title}
                  </h4>

                  {/* Code snippet preview with blue accent */}
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1527] p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed border-l-2 border-l-blue-500">
                    {p.prompt_content}
                  </div>

                  {/* Footer stats */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100/70 dark:border-slate-800/60">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span>📋</span> {p.copy_count} lượt sao chép
                    </span>
                    <span className="font-mono">{new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination Bar & Limit Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 bg-white dark:bg-[#131C32] rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-xs">

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPrompts.length}
            itemsPerPage={itemsPerPage}
            itemLabel="Prompt"
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </div>

      {/* Create / Edit Modal - 3-Tier Centered & Mobile Ready */}
      {showEditorModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => setShowEditorModal(false)} />
          <div className="relative z-[100000] w-full max-w-lg max-h-[88dvh] sm:max-h-[90dvh] my-auto flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
            {/* Sticky Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#131C32]">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingItem ? '✏️ Chỉnh sửa Prompt AI' : '➕ Thêm Prompt AI Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSavePrompt} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tiêu đề Prompt (*)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ví dụ: Chân dung Cinematic 8K Siêu Thực"
                    required
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium focus:border-[#2563EB] focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Danh mục AI</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium focus:border-[#2563EB] focus:outline-none transition"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-slate-300">Ảnh minh họa</label>
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>📁</span>
                        <span>{uploadingImage ? 'Đang tải lên...' : 'Tải ảnh từ máy'}</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="url"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="Dán link ảnh hoặc bấm Tải ảnh từ máy..."
                        className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium focus:border-[#2563EB] focus:outline-none transition"
                      />
                      {formData.image_url && (
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 relative group">
                          <img
                            src={formData.image_url}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nội dung câu lệnh Prompt (*)</label>
                  <textarea
                    value={formData.prompt_content}
                    onChange={(e) => setFormData({ ...formData, prompt_content: e.target.value })}
                    placeholder="Nhập chi tiết câu lệnh prompt..."
                    rows={6}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 font-mono text-xs font-medium focus:border-[#2563EB] focus:outline-none transition leading-relaxed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Mô tả ngắn</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả tác dụng của prompt này..."
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium focus:border-[#2563EB] focus:outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tags từ khóa (cách nhau bởi dấu phẩy)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="midjourney, 8k, cinematic, portrait"
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium focus:border-[#2563EB] focus:outline-none transition"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="h-4 w-4 rounded text-[#2563EB]"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Đánh dấu là Prompt Nổi Bật (Featured) ⭐</span>
                </label>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E]/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] font-bold text-white shadow-md disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Đang lưu...' : 'Lưu Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Xóa Prompt AI"
        message={`Bạn có chắc chắn muốn xóa Prompt "${deletingItem?.title}" không? Hành động này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        cancelText="Hủy"
        variant="danger"
        onConfirm={handleDeletePrompt}
        onClose={() => setDeletingItem(null)}
      />
    </div>
  );
}
