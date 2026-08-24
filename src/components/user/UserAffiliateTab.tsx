import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { generateReferralLink } from '../../utils/affiliate';

interface UserConversion {
  id: string;
  product_name: string | null;
  order_amount: number;
  commission_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

export default function UserAffiliateTab() {
  const { session, profile, refreshProfile } = useAuth();
  const [conversions, setConversions] = useState<UserConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const referralCode = profile?.referral_code || (session?.user?.id ? `BOW${session.user.id.substring(0, 5).toUpperCase()}` : 'BOW');
  const shareLink = generateReferralLink(referralCode);

  const fetchUserConversions = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('affiliate_conversions') as any)
        .select('id, product_name, order_amount, commission_amount, status, created_at')
        .eq('referrer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversions(data || []);
    } catch (err) {
      console.warn('[UserAffiliateTab] Error loading conversions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserConversions();
    refreshProfile();
  }, [session?.user?.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Đã sao chép liên kết giới thiệu!');
    setTimeout(() => setCopied(false), 2500);
  };

  const totalEarnings = conversions
    .filter((c) => c.status === 'completed')
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

  const pendingEarnings = conversions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

  const completedCount = conversions.filter((c) => c.status === 'completed').length;

  const shareText = encodeURIComponent(`Nhận ưu đãi giảm giá tài khoản AI Tools & Premium Apps bản quyền tại Shop of BOW: ${shareLink}`);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#00A3FF] via-[#2563EB] to-[#1D4ED8] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-md">
            🎁 CHƯƠNG TRÌNH GIỚI THIỆU BẠN BÈ (AFFILIATE)
          </div>
          <h2 className="text-xl sm:text-2xl font-black leading-tight">
            Chia sẻ cho bạn bè — Nhận hoa hồng thẳng vào Ví BOW!
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-medium">
            Mỗi khi bạn bè mua đơn hàng qua liên kết giới thiệu của bạn, bạn nhận ngay tiền hoa hồng thẳng vào ví web để mua sắm hoặc rút tiền.
          </p>
        </div>

        <div className="absolute right-4 -bottom-6 text-7xl sm:text-8xl opacity-20 pointer-events-none select-none">
          🤝
        </div>
      </div>

      {/* Share Box */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Liên kết giới thiệu độc quyền của bạn</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Gửi liên kết này cho bạn bè, đối tác hoặc đăng lên mạng xã hội.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-xs font-mono font-bold text-[#2563EB] dark:text-[#35A8FF] outline-none select-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400">
              Mã: {referralCode}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={`rounded-2xl px-6 py-3 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white hover:scale-102'
            }`}
          >
            {copied ? '✓ Đã sao chép!' : '📋 Sao chép link'}
          </button>
        </div>

        {/* Social Share Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-400 mr-1">Chia sẻ nhanh:</span>
          <a
            href={`https://zalo.me/share?url=${encodeURIComponent(shareLink)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
          >
            💬 Zalo
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition"
          >
            📘 Facebook
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900/40 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition"
          >
            ✈️ Telegram
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">Hoa hồng đã nhận</span>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalEarnings.toLocaleString('vi-VN')}đ
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Đã cộng vào Số dư ví của bạn
          </span>
        </div>

        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500">Đơn hàng thành công</span>
          <p className="mt-1 text-2xl font-black text-[#2563EB] dark:text-[#35A8FF]">
            {completedCount} đơn
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Từ bạn bè đã giới thiệu
          </span>
        </div>

        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-500">Hoa hồng đang chờ</span>
          <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
            {pendingEarnings.toLocaleString('vi-VN')}đ
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Sẽ cộng ví khi đơn hàng hoàn tất
          </span>
        </div>
      </div>

      {/* How it works 3 steps */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">Cách thức nhận thưởng Win - Win</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700 space-y-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/60 font-black text-xs text-blue-600 dark:text-blue-400">
              1
            </span>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">Gửi link cho bạn bè</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Copy liên kết giới thiệu ở trên và gửi cho bạn bè, đồng nghiệp hoặc hội nhóm.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700 space-y-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 font-black text-xs text-amber-600 dark:text-amber-400">
              2
            </span>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">Bạn bè đặt mua dịch vụ</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Bạn bè bấm vào link và chọn mua các gói tài khoản / phần mềm chất lượng cao tại shop.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700 space-y-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 font-black text-xs text-emerald-600 dark:text-emerald-400">
              3
            </span>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">Nhận hoa hồng vào ví</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Khi đơn hàng bàn giao thành công, tiền thưởng được cộng ngay vào ví web để bạn mua sắm.
            </p>
          </div>
        </div>
      </div>

      {/* Conversion History Table */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Lịch sử nhận hoa hồng</h3>
          <button
            onClick={fetchUserConversions}
            className="text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
          >
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
            <p className="mt-2 text-xs font-semibold text-slate-400">Đang tải lịch sử...</p>
          </div>
        ) : conversions.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <span className="text-4xl block">🤝</span>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Bạn chưa có lượt giới thiệu nào. Hãy chia sẻ link ngay nhé!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-auto">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-400 font-black">
                <tr>
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Sản phẩm</th>
                  <th className="px-3 py-2.5">Giá trị đơn</th>
                  <th className="px-3 py-2.5">Hoa hồng nhận</th>
                  <th className="px-3 py-2.5 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-3 py-3 font-extrabold text-slate-900 dark:text-white">
                      {c.product_name || 'Sản phẩm'}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {Number(c.order_amount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-3 py-3 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +{Number(c.commission_amount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {c.status === 'completed' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-black">
                          ✓ Đã cộng ví
                        </span>
                      ) : c.status === 'pending' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold">
                          ⏳ Chờ hoàn tất
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-0.5 text-[10px] font-bold">
                          ✕ Đã hủy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
