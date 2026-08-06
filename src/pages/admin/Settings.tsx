import { useEffect, useState } from 'react';
import { getContactSettings, saveContactSettings, type ContactRow } from '../../data/admin';

const empty = {
  facebook_url: '',
  zalo_url: '',
  instagram_url: '',
  tiktok_url: '',
  discord_url: '',
  locket_url: '',
  support_phone: '',
  support_email: '',
};

export default function AdminSettings() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // General site info mockup state
  const [siteName, setSiteName] = useState('BOW - Shop Premium Accounts');
  const [siteDesc, setSiteDesc] = useState('Cung cấp tài khoản premium giá tốt nhất thị trường.');

  useEffect(() => {
    getContactSettings()
      .then((c: ContactRow | null) => {
        if (c) {
          setForm({
            facebook_url: c.facebook_url ?? '',
            zalo_url: c.zalo_url ?? '',
            instagram_url: c.instagram_url ?? '',
            tiktok_url: c.tiktok_url ?? '',
            discord_url: c.discord_url ?? '',
            locket_url: c.locket_url ?? '',
            support_phone: c.support_phone ?? '',
            support_email: c.support_email ?? '',
          });
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const setVal = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await saveContactSettings({
        facebook_url: form.facebook_url || null,
        zalo_url: form.zalo_url || null,
        instagram_url: form.instagram_url || null,
        tiktok_url: form.tiktok_url || null,
        discord_url: form.discord_url || null,
        locket_url: form.locket_url || null,
        support_phone: form.support_phone || null,
        support_email: form.support_email || null,
      });
      setOk('Đã lưu cấu hình cài đặt hệ thống thành công!');
      setTimeout(() => setOk(null), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-t-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Cài đặt hệ thống</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Cấu hình thông tin cơ bản, mạng xã hội và kênh liên hệ của BOW.</p>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50 dark:bg-red-950/20 px-4.5 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          ⚠️ {err}
        </div>
      )}
      {ok && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 px-4.5 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ✅ {ok}
        </div>
      )}

      <form onSubmit={onSave} className="space-y-6">
        {/* Card: Website Info */}
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Thông tin website</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Tên Website</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Mô tả Meta Description</label>
              <input
                type="text"
                value={siteDesc}
                onChange={(e) => setSiteDesc(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        {/* Card: Social Contacts */}
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Kênh mạng xã hội & Thẻ danh thiếp (FE Card)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Facebook Profile / Messenger URL</label>
              <input
                type="text"
                value={form.facebook_url}
                onChange={(e) => setVal('facebook_url', e.target.value)}
                placeholder="https://www.facebook.com/Bobowcon..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Zalo Contact URL</label>
              <input
                type="text"
                value={form.zalo_url}
                onChange={(e) => setVal('zalo_url', e.target.value)}
                placeholder="https://zalo.me/0966821315..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Instagram URL</label>
              <input
                type="text"
                value={form.instagram_url}
                onChange={(e) => setVal('instagram_url', e.target.value)}
                placeholder="https://www.instagram.com/bobowcon..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">TikTok Profile URL</label>
              <input
                type="text"
                value={form.tiktok_url}
                onChange={(e) => setVal('tiktok_url', e.target.value)}
                placeholder="https://www.tiktok.com/@bobowcon..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Discord Invite Link</label>
              <input
                type="text"
                value={form.discord_url}
                onChange={(e) => setVal('discord_url', e.target.value)}
                placeholder="https://discord.gg/..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Locket Profile Link</label>
              <input
                type="text"
                value={form.locket_url}
                onChange={(e) => setVal('locket_url', e.target.value)}
                placeholder="https://locket.cam/..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Số điện thoại Hotline</label>
              <input
                type="text"
                value={form.support_phone}
                onChange={(e) => setVal('support_phone', e.target.value)}
                placeholder="0966 821 315..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Email Hỗ Trợ</label>
              <input
                type="email"
                value={form.support_email}
                onChange={(e) => setVal('support_email', e.target.value)}
                placeholder="hoankb4@gmail.com..."
                className="h-11 w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-6 py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition hover:scale-102"
        >
          {saving ? 'Đang lưu cài đặt...' : '💾 Lưu cài đặt hệ thống'}
        </button>
      </form>
    </div>
  );
}

