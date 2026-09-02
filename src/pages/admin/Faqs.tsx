import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listFaqs, createFaq, updateFaq, deleteFaq, type FaqRow } from '../../data/admin';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Pagination } from '../../components/admin/Pagination';

const FAQS_PER_PAGE = 8;

// ── Vietnamese Text Normalizer ───────────────────────────────────────────────
function normalizeVi(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Semantic Topic Classifier for Intelligent FAQ Grouping ───────────────────
interface TopicRule {
  id: string;
  name: string;
  primaryKeywords: string[];
  secondaryKeywords: string[];
}

const FAQ_TOPIC_RULES: TopicRule[] = [
  {
    id: 'warranty',
    name: 'Bảo hành & Đổi mới',
    primaryKeywords: ['bao hanh', 'doi moi', 'chinh sach bao hanh', 'bao hanh tron goi', 'bao hanh nhu the nao', 'loi tai khoan'],
    secondaryKeywords: ['doi tra', 'bao hanh tai khoan', 'ho tro doi', 'loi', 'hu'],
  },
  {
    id: 'delivery_time',
    name: 'Thời gian nhận tài khoản / Kích hoạt',
    primaryKeywords: ['bao lau', 'khi nao nhan', 'thoi gian nhan', 'mat bao lau', 'bao lau thi nhan', 'kich hoat trong bao lau'],
    secondaryKeywords: ['sau khi mua', 'sau khi thanh toan', 'nhan tai khoan', 'kich hoat'],
  },
  {
    id: 'payment_methods',
    name: 'Phương thức thanh toán',
    primaryKeywords: ['hinh thuc thanh toan', 'phuong thuc thanh toan', 'thanh toan bang', 'thanh toan qua', 'cach thanh toan'],
    secondaryKeywords: ['chuyen khoan', 'momo', 'zalopay', 'ngan hang', 'the tin dung', 'qr pay'],
  },
  {
    id: 'refund_policy',
    name: 'Chính sách hoàn tiền / Hủy đơn',
    primaryKeywords: ['hoan tien', 'tra tien', 'huy don hang', 'chinh sach hoan tien', 'refund'],
    secondaryKeywords: ['hoan lai', 'lay lai tien'],
  },
  {
    id: 'wallet_deposit',
    name: 'Nạp tiền & Số dư ví',
    primaryKeywords: ['nap tien', 'so du vi', 'nap vi', 'nap tu dong', 'cach nap tien'],
    secondaryKeywords: ['nap tien vao tai khoan', 'tien trong vi'],
  },
  {
    id: 'account_usage',
    name: 'Sử dụng & Đăng nhập tài khoản',
    primaryKeywords: ['dang nhap', 'mat khau', 'doi pass', 'huong dan su dung', 'dang nhap nhu the nao', 'quen mat khau'],
    secondaryKeywords: ['profile', 'tai khoan dung chung', 'slot'],
  },
];

function identifyTopic(q: string, a: string): string | null {
  const normQ = normalizeVi(q);
  const normA = normalizeVi(a);

  for (const rule of FAQ_TOPIC_RULES) {
    // 1. If Question directly contains a primary keyword -> Match immediately
    if (rule.primaryKeywords.some((kw) => normQ.includes(kw))) {
      return rule.name;
    }

    // 2. If Question has secondary keyword AND Answer has primary/secondary keyword
    const qHasSecondary = rule.secondaryKeywords.some((kw) => normQ.includes(kw));
    const aHasPrimary = rule.primaryKeywords.some((kw) => normA.includes(kw));
    const aHasSecondary = rule.secondaryKeywords.some((kw) => normA.includes(kw));

    if (qHasSecondary && (aHasPrimary || aHasSecondary)) {
      return rule.name;
    }
  }

  return null;
}

/**
 * Checks if two FAQs are semantically duplicate or cover the exact same core topic.
 */
function checkFaqDuplicate(
  faqA: FaqRow,
  faqB: FaqRow
): { isDuplicate: boolean; reason: string } {
  const qA = normalizeVi(faqA.question);
  const qB = normalizeVi(faqB.question);
  const aA = normalizeVi(faqA.answer);
  const aB = normalizeVi(faqB.answer);

  // 1. Exact match on question
  if (qA === qB) {
    return { isDuplicate: true, reason: 'Trùng khớp 100% tiêu đề câu hỏi' };
  }

  // 2. Exact match on answer
  if (aA.length >= 10 && aA === aB) {
    return { isDuplicate: true, reason: 'Trùng khớp 100% nội dung câu trả lời' };
  }

  // 3. High word overlap in question (>= 75%)
  const wordsA = qA.split(' ').filter(Boolean);
  const wordsB = qB.split(' ').filter(Boolean);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let matchCount = 0;
  for (const w of setA) {
    if (setB.has(w)) matchCount++;
  }
  const dice = (2 * matchCount) / (setA.size + setB.size);
  if (dice >= 0.75) {
    return {
      isDuplicate: true,
      reason: `Tiêu đề tương đồng ${Math.round(dice * 100)}%`,
    };
  }

  // 4. Same Identified Core Intent/Topic (e.g. both are about "Bảo hành & Đổi mới")
  const topicA = identifyTopic(faqA.question, faqA.answer);
  const topicB = identifyTopic(faqB.question, faqB.answer);

  if (topicA && topicB && topicA === topicB) {
    return {
      isDuplicate: true,
      reason: `Cùng chủ đề: "${topicA}"`,
    };
  }

  return { isDuplicate: false, reason: '' };
}

type SortOption = 'sort_order' | 'az' | 'newest';
type FilterTab = 'all' | 'duplicates';

export default function AdminFaqs() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  // Search, Filter & Tab States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('sort_order');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedFaq, setSelectedFaq] = useState<FaqRow | null>(null);
  const [formData, setFormData] = useState({ question: '', answer: '', sort_order: 1 });
  const [modalBusy, setModalBusy] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  // Quick Inline Add Accordion State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickDraft, setQuickDraft] = useState({ question: '', answer: '' });
  const [quickBusy, setQuickBusy] = useState(false);

  // Delete Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    faqId: string | null;
    questionText: string;
  }>({
    isOpen: false,
    faqId: null,
    questionText: '',
  });

  // Lock scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Close custom dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listFaqs(null);
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu FAQ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Smart Deduplication Map ────────────────────────────────────────────────
  const duplicateInfoMap = useMemo(() => {
    const map = new Map<string, { similarTo: Array<{ id: string; question: string; reason: string }> }>();

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const itemA = rows[i];
        const itemB = rows[j];
        const check = checkFaqDuplicate(itemA, itemB);

        if (check.isDuplicate) {
          const existingA = map.get(itemA.id) || { similarTo: [] };
          existingA.similarTo.push({ id: itemB.id, question: itemB.question, reason: check.reason });
          map.set(itemA.id, existingA);

          const existingB = map.get(itemB.id) || { similarTo: [] };
          existingB.similarTo.push({ id: itemA.id, question: itemA.question, reason: check.reason });
          map.set(itemB.id, existingB);
        }
      }
    }
    return map;
  }, [rows]);

  const duplicateCount = duplicateInfoMap.size;

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedFaq(null);
    setFormData({
      question: '',
      answer: '',
      sort_order: rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order || 0)) + 1 : 1,
    });
    setModalErr(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (faq: FaqRow) => {
    setModalMode('edit');
    setSelectedFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      sort_order: faq.sort_order || 1,
    });
    setModalErr(null);
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim()) {
      setModalErr('Vui lòng nhập câu hỏi thường gặp');
      return;
    }
    if (!formData.answer.trim()) {
      setModalErr('Vui lòng nhập nội dung câu trả lời');
      return;
    }

    setModalBusy(true);
    setModalErr(null);

    try {
      if (modalMode === 'create') {
        await createFaq({
          product_id: null,
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          sort_order: Number(formData.sort_order) || rows.length + 1,
        });
        toast.success('Thêm câu hỏi FAQ mới thành công!');
      } else if (selectedFaq) {
        await updateFaq(selectedFaq.id, {
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          sort_order: Number(formData.sort_order) || selectedFaq.sort_order,
        });
        toast.success('Cập nhật câu hỏi FAQ thành công!');
      }
      setIsModalOpen(false);
      await load();
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'Thao tác thất bại');
    } finally {
      setModalBusy(false);
    }
  };

  // Quick Inline Add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDraft.question.trim()) {
      toast.error('Vui lòng nhập câu hỏi thường gặp');
      return;
    }
    if (!quickDraft.answer.trim()) {
      toast.error('Vui lòng nhập câu trả lời');
      return;
    }

    setQuickBusy(true);
    try {
      await createFaq({
        product_id: null,
        question: quickDraft.question.trim(),
        answer: quickDraft.answer.trim(),
        sort_order: rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order || 0)) + 1 : 1,
      });
      setQuickDraft({ question: '', answer: '' });
      toast.success('Thêm câu hỏi FAQ thành công!');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thêm FAQ thất bại');
    } finally {
      setQuickBusy(false);
    }
  };

  // Trigger Delete
  const handleDeletePrompt = (faq: FaqRow) => {
    setConfirmConfig({
      isOpen: true,
      faqId: faq.id,
      questionText: faq.question,
    });
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!confirmConfig.faqId) return;
    try {
      await deleteFaq(confirmConfig.faqId);
      setRows((prev) => prev.filter((x) => x.id !== confirmConfig.faqId));
      toast.success('Đã xóa câu hỏi FAQ thành công!');
      setConfirmConfig({ isOpen: false, faqId: null, questionText: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xóa FAQ thất bại');
    }
  };

  // Move Order Up/Down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedRows.length) return;

    const currentFaq = sortedRows[index];
    const targetFaq = sortedRows[targetIndex];

    const currentOrder = currentFaq.sort_order || index + 1;
    const targetOrder = targetFaq.sort_order || targetIndex + 1;

    try {
      await Promise.all([
        updateFaq(currentFaq.id, { sort_order: targetOrder }),
        updateFaq(targetFaq.id, { sort_order: currentOrder }),
      ]);
      await load();
      toast.success('Đã cập nhật thứ tự hiển thị!');
    } catch (e) {
      toast.error('Lỗi khi đổi thứ tự hiển thị');
    }
  };

  // Filter by Tab and Search
  const tabFilteredRows = useMemo(() => {
    if (activeTab === 'duplicates') {
      return rows.filter((r) => duplicateInfoMap.has(r.id));
    }
    return rows;
  }, [rows, activeTab, duplicateInfoMap]);

  const searchedRows = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredRows;
    const q = searchQuery.toLowerCase();
    return tabFilteredRows.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [tabFilteredRows, searchQuery]);

  // Sort Rows
  const sortedRows = useMemo(() => {
    return [...searchedRows].sort((a, b) => {
      if (sortBy === 'az') return a.question.localeCompare(b.question, 'vi');
      if (sortBy === 'newest') return (b.id || '').localeCompare(a.id || '');
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [searchedRows, sortBy]);

  const totalPages = Math.ceil(sortedRows.length / FAQS_PER_PAGE) || 1;
  const paginatedRows = sortedRows.slice((currentPage - 1) * FAQS_PER_PAGE, currentPage * FAQS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, activeTab]);

  const sortLabels: Record<SortOption, { label: string; desc: string }> = {
    sort_order: { label: 'Thứ tự hiển thị (#1, #2...)', desc: 'Thứ tự ưu tiên trên trang chủ' },
    newest: { label: 'Mới nhất trước', desc: 'Sắp xếp theo thời gian thêm gần đây' },
    az: { label: 'Câu hỏi A → Z', desc: 'Bảng chữ cái tiếng Việt' },
  };

  return (
    <div className="space-y-6">
      {/* ── 1. HEADER SECTION ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">FAQ chung</h1>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-3 py-1 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/50 dark:border-blue-900/40">
              {rows.length} câu hỏi
            </span>
            {duplicateCount > 0 && (
              <span
                onClick={() => setActiveTab('duplicates')}
                className="cursor-pointer rounded-full bg-amber-50 dark:bg-amber-950/50 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50 transition hover:scale-105 flex items-center gap-1.5 shadow-2xs"
                title="Bấm để xem danh sách câu hỏi trùng chủ đề"
              >
                <span>⚠️</span>
                <span>{duplicateCount} trùng lặp</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Quản lý, chỉnh sửa, lọc trùng lặp và sắp xếp câu hỏi thường gặp cho khách hàng và trợ lý AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowQuickAdd((v) => !v)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition shadow-xs cursor-pointer border ${
              showQuickAdd
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                : 'bg-white dark:bg-[#131C32] text-slate-700 dark:text-slate-300 border-[#E8F1FF] dark:border-[#1E2A4A] hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>{showQuickAdd ? '▲ Thu gọn' : '⚡ Thêm nhanh'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-5 text-xs font-black text-white shadow-md transition-all duration-200 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-102 cursor-pointer"
          >
            <span>➕ Thêm câu hỏi mới</span>
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-xs font-bold text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>⚠️ {err}</span>
          <button onClick={load} className="underline hover:text-red-700">Thử lại</button>
        </div>
      )}

      {/* ── 2. QUICK INLINE ADD FORM ─────────────────────────────────────── */}
      {showQuickAdd && (
        <div className="rounded-[24px] border border-blue-200 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 via-white to-sky-50/30 dark:from-[#131C32] dark:to-slate-900 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/30 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#2563EB] dark:text-[#35A8FF] flex items-center gap-1.5">
              <span>⚡</span>
              <span>Thêm câu hỏi FAQ nhanh</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Tự động gán thứ tự tiếp theo</span>
          </div>

          <form onSubmit={handleQuickAdd} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Câu hỏi thường gặp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={quickDraft.question}
                onChange={(e) => setQuickDraft((d) => ({ ...d, question: e.target.value }))}
                placeholder="Ví dụ: Quy định bảo hành tài khoản ra sao?"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Nội dung trả lời chi tiết <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                value={quickDraft.answer}
                onChange={(e) => setQuickDraft((d) => ({ ...d, answer: e.target.value }))}
                placeholder="Nhập nội dung giải đáp cụ thể và rõ ràng cho khách hàng..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs font-medium outline-none transition focus:border-[#2563EB] text-slate-900 dark:text-white leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setQuickDraft({ question: '', answer: '' });
                  setShowQuickAdd(false);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={quickBusy}
                className="rounded-xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-5 py-2 text-xs font-black text-white shadow-xs transition hover:scale-102 disabled:opacity-60 cursor-pointer"
              >
                {quickBusy ? 'Đang thêm...' : '➕ Thêm ngay'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 3. FILTER TABS & SEARCH & CUSTOM DROPDOWN ────────────────────── */}
      <div className="space-y-3">
        {/* Filter Tabs: Tất cả vs Câu hỏi trùng lặp */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-[#131C32] text-slate-600 dark:text-slate-400 border border-[#E8F1FF] dark:border-[#1E2A4A] hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>Tất cả câu hỏi</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {rows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('duplicates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'duplicates'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-[#131C32] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <span>⚠️ Trùng lặp chủ đề</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'duplicates' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
            }`}>
              {duplicateCount}
            </span>
          </button>
        </div>

        {/* Search Bar + Custom Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] px-3.5 shadow-xs transition focus-within:border-blue-500">
              <svg
                className="w-4 h-4 text-slate-400 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'duplicates'
                    ? 'Tìm trong các câu hỏi trùng chủ đề...'
                    : 'Tìm kiếm câu hỏi hoặc nội dung câu trả lời...'
                }
                className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 text-xs flex items-center justify-center shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Custom Styled Dropdown */}
          <div className="relative self-end sm:self-auto shrink-0" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((v) => !v)}
              className="flex h-11 items-center justify-between gap-3 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] px-4 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer min-w-[210px]"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400">Sắp xếp:</span>
                <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF] truncate">
                  {sortLabels[sortBy].label}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isSortOpen ? 'rotate-180 text-blue-500' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu Popover */}
            {isSortOpen && (
              <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-1.5 shadow-2xl backdrop-blur-md animate-fade-in">
                {(Object.keys(sortLabels) as SortOption[]).map((key) => {
                  const item = sortLabels[key];
                  const isSelected = sortBy === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSortBy(key);
                        setIsSortOpen(false);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#35A8FF]'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="mt-0.5 flex h-4 w-4 items-center justify-center shrink-0">
                        {isSelected ? (
                          <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black leading-snug">{item.label}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. FAQS LIST SECTION ─────────────────────────────────────────── */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {activeTab === 'duplicates' ? 'Danh sách câu hỏi trùng chủ đề' : 'Danh sách câu hỏi thường gặp'}
            </h2>
            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-400">
              Hiển thị {paginatedRows.length} / {sortedRows.length}
            </span>
          </div>

          {activeTab === 'duplicates' && (
            <button
              onClick={() => setActiveTab('all')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              ← Xem tất cả FAQ
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
            <p className="text-xs font-bold text-slate-400">Đang tải danh sách câu hỏi FAQ...</p>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <span className="text-3xl">❓</span>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {activeTab === 'duplicates'
                ? 'Tuyệt vời! Không có câu hỏi nào bị trùng lặp chủ đề.'
                : searchQuery
                ? 'Không tìm thấy câu hỏi nào phù hợp với từ khóa.'
                : 'Chưa có câu hỏi FAQ nào.'}
            </p>
            {activeTab === 'all' && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 px-4 py-2 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 transition cursor-pointer"
              >
                ➕ Thêm câu hỏi đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedRows.map((faq, idx) => {
              const globalIdx = (currentPage - 1) * FAQS_PER_PAGE + idx;
              const dupInfo = duplicateInfoMap.get(faq.id);

              return (
                <div
                  key={faq.id}
                  className={`group relative rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-xs space-y-3 ${
                    dupInfo
                      ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-400'
                      : 'border-slate-100 dark:border-slate-800/80 bg-[#FAFCFF] dark:bg-slate-900/40 hover:border-blue-200 dark:hover:border-blue-900'
                  }`}
                >
                  {/* Top Bar: Order badge, Question, Action Buttons */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Order Index Badge */}
                      <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100/70 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/50 text-[11px] font-black text-[#2563EB] dark:text-[#35A8FF]">
                        #{faq.sort_order || globalIdx + 1}
                      </span>

                      {/* Question Text */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug break-words">
                          {faq.question}
                        </h3>

                        {/* Duplicate Alert Banner */}
                        {dupInfo && (
                          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/50 p-2.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                              <span>⚠️ Trùng chủ đề với {dupInfo.similarTo.length} câu hỏi khác:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400 pl-1">
                              {dupInfo.similarTo.map((sim) => (
                                <li key={sim.id} className="truncate">
                                  <span className="font-semibold">"{sim.question}"</span>
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">
                                    ({sim.reason})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Sửa & Xóa & Reorder */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Reorder Buttons */}
                      {sortBy === 'sort_order' && activeTab === 'all' && (
                        <div className="hidden xs:flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-1.5 mr-0.5">
                          <button
                            type="button"
                            disabled={globalIdx === 0}
                            onClick={() => handleMoveOrder(globalIdx, 'up')}
                            className="h-8 w-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-xs transition cursor-pointer"
                            title="Di chuyển lên trên"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={globalIdx === sortedRows.length - 1}
                            onClick={() => handleMoveOrder(globalIdx, 'down')}
                            className="h-8 w-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-xs transition cursor-pointer"
                            title="Di chuyển xuống dưới"
                          >
                            ▼
                          </button>
                        </div>
                      )}

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(faq)}
                        className="flex items-center gap-1.5 h-8.5 px-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-extrabold shadow-2xs transition-all duration-200 hover:scale-102 cursor-pointer"
                        title="Chỉnh sửa câu hỏi này"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Sửa</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeletePrompt(faq)}
                        className="flex items-center gap-1.5 h-8.5 px-3 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-extrabold shadow-2xs transition-all duration-200 hover:scale-102 cursor-pointer"
                        title="Xóa câu hỏi này"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>

                  {/* Answer Box */}
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#151f36] p-3.5 sm:p-4 text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words shadow-2xs">
                    {faq.answer}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {sortedRows.length > FAQS_PER_PAGE && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedRows.length}
              itemsPerPage={FAQS_PER_PAGE}
              itemLabel="câu hỏi"
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ── 5. FULL CREATE / EDIT FAQ MODAL ──────────────────────────────── */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
              onClick={() => !modalBusy && setIsModalOpen(false)}
            />

            {/* Modal Box */}
            <div className="relative z-10 w-full max-w-xl my-auto rounded-[28px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#18243E] p-6 sm:p-8 shadow-2xl transition-all animate-fade-up text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-[#2563EB] dark:text-[#35A8FF] text-lg font-black">
                    {modalMode === 'create' ? '➕' : '✏️'}
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      {modalMode === 'create' ? 'Thêm câu hỏi FAQ mới' : 'Chỉnh sửa câu hỏi FAQ'}
                    </h2>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {modalMode === 'create'
                        ? 'Nội dung sẽ được cập nhật ngay trên trang web và bộ nhớ BOW AI.'
                        : `Đang chỉnh sửa câu hỏi: ${selectedFaq?.id?.slice(0, 8)}...`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={modalBusy}
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {modalErr && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-bold text-red-600 dark:text-red-400">
                  ⚠️ {modalErr}
                </div>
              )}

              {/* Modal Form */}
              <form onSubmit={handleSaveModal} className="space-y-4">
                {/* Question */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Câu hỏi thường gặp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.question}
                    onChange={(e) => setFormData((d) => ({ ...d, question: e.target.value }))}
                    placeholder="Ví dụ: Quy định bảo hành tài khoản như thế nào?"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Answer */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Nội dung câu trả lời chi tiết <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.answer}
                    onChange={(e) => setFormData((d) => ({ ...d, answer: e.target.value }))}
                    placeholder="Nhập nội dung giải đáp cụ thể, chi tiết và thân thiện cho khách hàng..."
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-3.5 text-xs font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white leading-relaxed"
                  />
                </div>

                {/* Sort Order */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Thứ tự hiển thị (#)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.sort_order}
                      onChange={(e) => setFormData((d) => ({ ...d, sort_order: Number(e.target.value) || 1 }))}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-col justify-end text-[11px] text-slate-400 font-medium pb-2">
                    Số nhỏ hơn sẽ hiển thị trước trên website.
                  </div>
                </div>

                {/* Live Preview Box */}
                {formData.question && (
                  <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                      👁️ Xem trước giao diện:
                    </span>
                    <p className="text-xs font-black text-slate-900 dark:text-white">{formData.question}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300 whitespace-pre-wrap">
                      {formData.answer || '(Chưa có nội dung câu trả lời)'}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={() => setIsModalOpen(false)}
                    className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 px-5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={modalBusy}
                    className="h-10 rounded-xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 text-xs font-black text-white shadow-md transition-all duration-200 hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-102 disabled:opacity-60 cursor-pointer flex items-center gap-2"
                  >
                    {modalBusy ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <span>{modalMode === 'create' ? '➕ Tạo câu hỏi FAQ' : '💾 Lưu thay đổi'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── 6. DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title="Xóa câu hỏi FAQ"
        message={`Bạn có chắc chắn muốn xóa câu hỏi "${confirmConfig.questionText}" khỏi hệ thống không? Hành động này không thể hoàn tác.`}
        confirmText="Xóa vĩnh viễn"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmConfig({ isOpen: false, faqId: null, questionText: '' })}
      />
    </div>
  );
}
