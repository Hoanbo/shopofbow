import { useCallback, useEffect, useState } from 'react';
import { listFaqs, createFaq, updateFaq, deleteFaq, type FaqRow } from '../../data/admin';
import { Field, TextArea, DeleteButton, Banner, AdminCard } from '../../components/admin/ui';

export default function AdminFaqs() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
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

  const add = async () => {
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

  const onDelete = async (id: string) => {
    try {
      await deleteFaq(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  };

  const saveEdit = async (id: string, patch: Partial<FaqRow>) => {
    try {
      await updateFaq(id, patch);
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">FAQ chung</h1>
        <p className="text-sm text-ink-muted">Câu hỏi thường gặp hiển thị trên trang Liên hệ.</p>
      </div>

      {err && <Banner kind="error">{err}</Banner>}

      <AdminCard title="Thêm câu hỏi">
        <div className="space-y-3">
          <Field label="Câu hỏi" value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
          <TextArea label="Trả lời" rows={3} value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
          <button onClick={add} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? 'Đang thêm...' : '+ Thêm FAQ'}
          </button>
        </div>
      </AdminCard>

      <AdminCard title={`Danh sách (${rows.length})`}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-brand-50/60" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">Chưa có câu hỏi nào.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((f) => (
              <FaqItem key={f.id} row={f} onSave={saveEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function FaqItem({
  row,
  onSave,
  onDelete,
}: {
  row: FaqRow;
  onSave: (id: string, patch: Partial<FaqRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(row.question);
  const [a, setA] = useState(row.answer);

  if (editing) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
        <Field label="Câu hỏi" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextArea label="Trả lời" rows={3} value={a} onChange={(e) => setA(e.target.value)} />
        <div className="flex gap-2">
          <button
            onClick={() => {
              onSave(row.id, { question: q.trim(), answer: a.trim() });
              setEditing(false);
            }}
            className="btn-primary !px-4 !py-2 !text-xs"
          >
            Lưu
          </button>
          <button
            onClick={() => {
              setQ(row.question);
              setA(row.answer);
              setEditing(false);
            }}
            className="btn-ghost !px-4 !py-2 !text-xs"
          >
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-100 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{row.question}</p>
          <p className="mt-1 text-sm text-ink-muted">{row.answer}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-brand-100 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Sửa
          </button>
          <DeleteButton onDelete={() => onDelete(row.id)} />
        </div>
      </div>
    </div>
  );
}
