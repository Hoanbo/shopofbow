import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Guards /admin routes — redirects to login when not authenticated. */
export default function ProtectedRoute() {
  const { session, loading, isAdmin } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sky-soft">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  }

  if (!isAdmin) {
    alert('Tài khoản của bạn không có quyền truy cập trang quản trị Admin.');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
