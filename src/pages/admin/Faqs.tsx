import { useCallback, useEffect, useState } from 'react';
import { listFaqs, createFaq, updateFaq, deleteFaq, type FaqRow } from '../../data/admin';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';

export default function AdminFaqs() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  
  // Search & Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState({ question: '', answer: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setRows(await listFaqs(null));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.question.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createFaq({
        product_id: null,
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        sort_order: rows.length + 1,
      });
      setDraft({ question: '', answer: '' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const onDelete = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa câu hỏi FAQ',
      message: 'Bạn có chắc chắn muốn xóa câu hỏi thường gặp này không?',
      onConfirm: async () => {
        try {
          await deleteFaq(id);
          setRows((r) => r.filter((x) => x.id !== id));
          toast.success('Xóa FAQ thành công!');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
          setErr(e instanceof Error ? e.message : 'Xóa thất bại');
        }
      },
    });
  };

  const saveEdit = async (id: string, patch: Partial<FaqRow>) => {
    try {
      await updateFaq(id, patch);
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    }
  };

  // Filtered rows
  const filteredRows = rows.filter((f) =>
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">FAQ chung</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý câu hỏi thường gặp hiển thị trên trang chủ và phần liên hệ của BOW.</p>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50 dark:bg-red-950/20 px-4.5 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          ⚠️ {err}
        </div>
      )}

      {/* FORM: ADD FAQ CARD */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3 mb-4">Thêm câu hỏi mới</h3>
        <form onSubmit={add} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Câu hỏi thường gặp</label>
            <input
              type="text"
              required
              value={draft.question}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              placeholder="Ví dụ: Quy định bảo hành tài khoản ra sao?"
              className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Nội dung trả lời</label>
            <textarea
              required
              value={draft.answer}
              onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
              placeholder="Nhập nội dung giải đáp chi tiết..."
              rows={3}
              className="w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-6 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60 transition hover:scale-102"
          >
            {busy ? 'Đang thêm...' : '➕ Thêm câu hỏi'}
          </button>
        </form>
      </div>

      {/* FILTER & SEARCH ROW */}
      <div className="flex h-11 items-center gap-2 rounded-xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] px-4 w-full sm:max-w-md shadow-xs">
        <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm câu hỏi hoặc câu trả lời..."
          className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
        />
      </div>

      {/* FAQS LIST CARD */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Danh sách câu hỏi ({rows.length})</h3>
        
        {loading ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-xs">
            Không tìm thấy câu hỏi nào.
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-slate-50 dark:divide-slate-800/40">
            {filteredRows.map((f, idx) => (
              <FaqItem key={f.id} row={f} onSave={saveEdit} onDelete={onDelete} isFirst={idx === 0} />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Xóa FAQ"
        variant="danger"
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function FaqItem({
  row,
  onSave,
  onDelete,
  isFirst
}: {
  row: FaqRow;
  onSave: (id: string, patch: Partial<FaqRow>) => void;
  onDelete: (id: string) => void;
  isFirst: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(row.question);
  const [a, setA] = useState(row.answer);

  if (editing) {
    return (
      <div className={`space-y-3 ${isFirst ? '' : 'pt-4'}`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none"
        />
        <textarea
          value={a}
          onChange={(e) => setA(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3.5 text-xs font-bold outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-500"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              onSave(row.id, { question: q.trim(), answer: a.trim() });
              setEditing(false);
            }}
            className="rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-4 ${isFirst ? '' : 'pt-4'}`}>
      <div className="space-y-1 min-w-0 flex-1">
        <h4 className="text-xs font-black text-slate-900 dark:text-white">{row.question}</h4>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{row.answer}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] text-slate-400 hover:text-[#2563EB] transition shadow-xs"
          title="Sửa FAQ"
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(row.id)}
          className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-red-50 text-slate-400 hover:text-red-500 transition shadow-xs"
          title="Xóa FAQ"
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
