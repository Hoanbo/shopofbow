import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Pagination } from '../../components/admin/Pagination';

const USERS_PER_PAGE = 6;



interface UserRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  balance: number;
  created_at: string;
  total_orders: number;
  is_admin_user?: boolean;
}

interface UserOrder {
  id: string;
  product_name: string;
  plan_label: string;
  price: number;
  status: string;
  payment_code: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();


  // Edit User modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete User modal state
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // User orders history modal state
  const [viewOrdersUser, setViewOrdersUser] = useState<UserRow | null>(null);
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_get_users_list');
      if (error) {
        console.error('[AdminUsers] rpc admin_get_users_list failed:', error);
        toast.error(`RPC Error: ${error.message || error.details || 'Vui lòng chạy lại file SQL 0014'}`);
        // Fallback if migration 0013 / 0014 has not been run in Supabase yet
        const { data: profs, error: profErr } = await (supabase.from('profiles') as any)
          .select('id, full_name, avatar_url, balance, created_at, phone')
          .order('created_at', { ascending: false });

        if (profErr) throw profErr;

        // Fetch orders count per user in fallback
        const { data: ords } = await (supabase.from('orders') as any).select('user_id');
        const orderCounts: Record<string, number> = {};
        if (ords) {
          ords.forEach((o: any) => {
            if (o.user_id) {
              orderCounts[o.user_id] = (orderCounts[o.user_id] || 0) + 1;
            }
          });
        }

        setUsers(
          (profs || []).map((p: any) => ({
            ...p,
            phone: p.phone || '',
            email: p.email || 'N/A',
            total_orders: orderCounts[p.id] || 0,
            is_admin_user: false,
          })) as UserRow[],
        );
      } else {
        setUsers((data || []) as UserRow[]);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toast.error(err.message || 'Lỗi khi tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Edit User Submission
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setUpdating(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_update_user', {
        p_user_id: editUser.id,
        p_full_name: editFullName.trim() || undefined,
        p_phone: editPhone.trim() || undefined,
      });

      if (error) throw error;
      if (data === 'success') {
        toast.success('Cập nhật thông tin khách hàng thành công!');
        setEditUser(null);
        fetchUsers();
      } else {
        throw new Error('Cập nhật thất bại.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật người dùng.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Delete User Submission
  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    if (deleteUser.is_admin_user) {
      toast.error('Không thể xóa tài khoản Admin.');
      setDeleteUser(null);
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_delete_user', {
        p_user_id: deleteUser.id,
      });

      if (error) throw error;

      if (data === 'success') {
        toast.success(`Đã xóa tài khoản ${deleteUser.full_name} (${deleteUser.email})!`);
        setDeleteUser(null);
        fetchUsers();
      } else if (data === 'cannot_delete_admin') {
        toast.error('Không thể xóa tài khoản Admin.');
      } else {
        throw new Error('Xóa tài khoản thất bại.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa người dùng.');
    } finally {
      setDeleting(false);
    }
  };

  // View user order history
  const handleOpenUserOrders = async (user: UserRow) => {
    setViewOrdersUser(user);
    setLoadingOrders(true);
    try {
      const { data, error } = await (supabase.from('orders') as any)
        .select('id, product_name, plan_label, price, status, payment_code, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserOrders((data || []) as UserOrder[]);
    } catch (err: any) {
      toast.error('Lỗi khi tải đơn hàng của người dùng.');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    );
  });

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const totalBalance = users.reduce((sum, u) => sum + Number(u.balance || 0), 0);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Quản lý người dùng</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Xem danh sách tài khoản, chỉnh sửa thông tin hoặc xóa tài khoản người dùng an toàn.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition"
        >
          🔄 Tải lại
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Tổng thành viên</span>
          <p className="mt-1 text-3xl font-black text-[#0F172A] dark:text-white">{users.length}</p>
        </div>
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">Tổng số dư ví hệ thống</span>
          <p className="mt-1 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {totalBalance.toLocaleString('vi-VN')}đ
          </p>
        </div>
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500">Đơn hàng đã đặt</span>
          <p className="mt-1 text-3xl font-black text-[#2563EB] dark:text-[#35A8FF]">
            {users.reduce((sum, u) => sum + Number(u.total_orders || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 rounded-[22px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-4 shadow-xs">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search theo Tên, Email, SĐT hoặc User ID..."
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-sm font-semibold outline-none focus:border-[#2563EB] dark:focus:border-[#35A8FF] text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-[28px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
            <p className="mt-3 text-sm font-semibold text-slate-400">Đang tải danh sách người dùng...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-slate-400">
            Không tìm thấy người dùng phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-auto">
              <thead className="border-b border-[#E8F1FF] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-400 font-black">
                <tr>
                  <th className="px-4 py-3.5">Khách hàng</th>
                  <th className="px-4 py-3.5">Email / SĐT</th>
                  <th className="px-4 py-3.5">Số dư ví</th>
                  <th className="px-4 py-3.5">Đơn đã đặt</th>
                  <th className="px-4 py-3.5">Ngày tham gia</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FF] dark:divide-slate-800">
                {paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    {/* KHÁCH HÀNG */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00A3FF] to-[#2563EB] text-xs font-black text-white shadow-xs shrink-0">
                          {(u.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[130px] lg:max-w-[160px]" title={u.full_name || 'Thành viên'}>
                              {u.full_name || 'Thành viên'}
                            </span>
                            {u.is_admin_user && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-black shrink-0">
                                👑 Admin
                              </span>
                            )}
                          </div>
                          <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[120px] mt-0.5">
                            {u.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* EMAIL / SĐT */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[150px] lg:max-w-[190px]" title={u.email}>
                        {u.email}
                      </div>
                      {u.phone && (
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          📞 {u.phone}
                        </div>
                      )}
                    </td>

                    {/* SỐ DƯ VÍ */}
                    <td className="px-4 py-3.5 font-black text-emerald-600 dark:text-emerald-400 text-xs whitespace-nowrap">
                      {Number(u.balance || 0).toLocaleString('vi-VN')}đ
                    </td>

                    {/* ĐƠN ĐÃ ĐẶT */}
                    <td className="px-4 py-3.5 font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenUserOrders(u)}
                        className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 transition"
                      >
                        {u.total_orders || 0} đơn
                      </button>
                    </td>

                    {/* NGÀY THAM GIA */}
                    <td className="px-4 py-3.5 font-medium text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>

                    {/* THAO TÁC */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditUser(u);
                            setEditFullName(u.full_name || '');
                            setEditPhone(u.phone || '');
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 transition shadow-xs"
                        >
                          ✏️ Sửa
                        </button>
                        {u.is_admin_user ? (
                          <span
                            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400 cursor-not-allowed"
                            title="Tài khoản Admin không thể xóa"
                          >
                            🔒 Admin
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition shadow-xs"
                          >
                            🗑️ Ban
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalUserPages}
        totalItems={filteredUsers.length}
        itemsPerPage={USERS_PER_PAGE}
        itemLabel="người dùng"
        onPageChange={setCurrentPage}
      />

      {/* MODAL EDIT USER */}
      {editUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setEditUser(null)} />
          <div className="relative w-full max-w-md rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 shadow-2xl animate-fade-up">
            <h3 className="text-lg font-black text-[#0F172A] dark:text-white">Sửa thông tin khách hàng</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400 truncate">
              Email: <strong className="text-slate-700 dark:text-slate-200">{editUser.email}</strong>
            </p>

            <form onSubmit={handleUpdateUser} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nhập họ tên khách hàng..."
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678..."
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-3 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 rounded-full bg-[#2563EB] hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-md transition"
                >
                  {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRM DELETE USER */}
      {deleteUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setDeleteUser(null)} />
          <div className="relative w-full max-w-md rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 shadow-2xl animate-fade-up text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-100 dark:border-rose-900/50 text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-black text-[#0F172A] dark:text-white">Xác nhận xóa tài khoản?</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản <strong className="text-slate-800 dark:text-white">{deleteUser.full_name}</strong> ({deleteUser.email})?
              </p>
              <p className="mt-1 text-[11px] font-bold text-rose-500">Hành động này không thể hoàn tác.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 rounded-full bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-60"
              >
                {deleting ? 'Đang xóa...' : 'Xóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USER ORDERS HISTORY */}
      {viewOrdersUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setViewOrdersUser(null)} />
          <div className="relative w-full max-w-2xl max-h-[85dvh] overflow-y-auto transform rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#0F172A] dark:text-white">Lịch sử đơn hàng</h3>
                <p className="text-xs font-semibold text-slate-400">
                  Khách hàng: <strong className="text-slate-700 dark:text-slate-200">{viewOrdersUser.full_name}</strong> ({viewOrdersUser.email})
                </p>
              </div>
              <button
                onClick={() => setViewOrdersUser(null)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-500"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loadingOrders ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">Đang tải đơn hàng...</div>
              ) : userOrders.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">Khách hàng chưa có đơn hàng nào.</div>
              ) : (
                userOrders.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 text-xs space-y-1.5">
                    <div className="flex justify-between font-extrabold">
                      <span className="text-[#0F172A] dark:text-white">{o.product_name}</span>
                      <span className="text-[#2563EB] dark:text-[#35A8FF]">{Number(o.price || 0).toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-medium">
                      <span>Mã: <strong className="text-slate-600 dark:text-slate-300 font-mono">{o.payment_code}</strong></span>
                      <span>Gói: {o.plan_label}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-700/60 pt-2 mt-2">
                      <span className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleString('vi-VN')}</span>
                      <span className="font-bold uppercase text-[10px] tracking-wider text-slate-500">{o.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
