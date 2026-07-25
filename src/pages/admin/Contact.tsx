import { useEffect, useState } from 'react';
import { getContactSettings, saveContactSettings, type ContactRow } from '../../data/admin';
import { Field, Banner, AdminCard } from '../../components/admin/ui';

const empty = { facebook_url: '', zalo_url: '', support_phone: '', support_email: '' };

export default function AdminContact() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    getContactSettings()
      .then((c: ContactRow | null) => {
        if (c) {
          setForm({
            facebook_url: c.facebook_url ?? '',
            zalo_url: c.zalo_url ?? '',
            support_phone: c.support_phone ?? '',
            support_email: c.support_email ?? '',
          });
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await saveContactSettings({
        facebook_url: form.facebook_url || null,
        zalo_url: form.zalo_url || null,
        support_phone: form.support_phone || null,
        support_email: form.support_email || null,
      });
      setOk('Đã lưu thông tin liên hệ.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-brand-100/60" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Thông tin liên hệ</h1>
        <p className="text-sm text-ink-muted">Các link này hiển thị ở Header, Footer, nút liên hệ và trang Liên hệ.</p>
      </div>

      {err && <Banner kind="error">{err}</Banner>}
      {ok && <Banner kind="success">{ok}</Banner>}

      <AdminCard title="Kênh liên hệ">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Facebook / Messenger URL"
            value={form.facebook_url}
            onChange={(e) => set('facebook_url', e.target.value)}
            placeholder="https://m.me/..."
            hint="Nút 'Liên hệ Facebook' trên mỗi sản phẩm"
          />
          <Field
            label="Zalo URL"
            value={form.zalo_url}
            onChange={(e) => set('zalo_url', e.target.value)}
            placeholder="https://zalo.me/..."
            hint="Nút 'Liên hệ Zalo' trên mỗi sản phẩm"
          />
          <Field
            label="Số điện thoại hỗ trợ"
            value={form.support_phone}
            onChange={(e) => set('support_phone', e.target.value)}
            placeholder="0900 000 000"
          />
          <Field
            label="Email hỗ trợ"
            type="email"
            value={form.support_email}
            onChange={(e) => set('support_email', e.target.value)}
            placeholder="support@bow.vn"
          />
        </div>
        <button onClick={onSave} disabled={saving} className="btn-primary mt-5 disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </AdminCard>
    </div>
  );
}
