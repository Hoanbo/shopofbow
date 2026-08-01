import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Guards /admin routes. AuthProvider đã chặn render cho tới khi auth load xong,
 * nên tại đây session/isAdmin luôn ở trạng thái cuối cùng — quyết định điều
 * hướng là chính xác, không có cửa sổ race.
 */
export default function ProtectedRoute() {
  const { session, isAdmin } = useAuth();
  const loc = useLocation();

  // Chưa đăng nhập → về trang đăng nhập chung, nhớ đích để quay lại sau khi login.
  if (!session) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }

  // Đã đăng nhập nhưng không phải admin → về trang chủ.
  // (Không dùng alert() trong render — đó là side-effect gây lỗi.)
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
