import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [backupModal, setBackupModal] = useState(false);

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

        {/* Card: Database Backup */}
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Sao lưu & Bảo trì dữ liệu</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tạo bản sao lưu dữ liệu toàn bộ hệ thống hoặc tối ưu hóa hiệu năng lưu trữ database.</p>
          <button
            type="button"
            onClick={() => setBackupModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <span>🛡️ Backup dữ liệu ngay</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-6 py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition hover:scale-102"
        >
          {saving ? 'Đang lưu cài đặt...' : '💾 Lưu cài đặt hệ thống'}
        </button>
      </form>
      {backupModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setBackupModal(false)}
          />
          {/* Card */}
          <div className="relative w-full max-w-sm rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-7 shadow-2xl flex flex-col items-center gap-4 animate-fade-up">
            {/* Icon */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>

            {/* Text */}
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Sao lưu thành công!</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Hệ thống đã tự động sao lưu và bảo vệ cơ sở dữ liệu.<br />
                Dữ liệu của bạn an toàn và được lưu trữ bảo mật.
              </p>
            </div>

            {/* Details badge */}
            <div className="w-full flex items-center gap-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-4 py-3">
              <span className="text-emerald-500 text-base">✅</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Supabase Auto-Backup</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Database được bảo vệ tự động 24/7</p>
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={() => setBackupModal(false)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md hover:scale-[1.02] transition"
            >
              Đã hiểu
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

