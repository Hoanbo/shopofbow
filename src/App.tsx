import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Listing from './pages/Listing';
import Detail from './pages/Detail';
import Contact from './pages/Contact';
import Prompts from './pages/Prompts';
import NotFound from './pages/NotFound';
import Auth from './pages/Auth';
import ClientDashboard from './pages/Dashboard';
import { AuthProvider } from './context/AuthContext';
import { FavoritesProvider } from './context/FavoritesContext';

// Admin is code-split so the public site never downloads the dashboard bundle.
const ProtectedRoute = lazy(() => import('./components/admin/ProtectedRoute'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const ProductEditor = lazy(() => import('./pages/admin/ProductEditor'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminFaqs = lazy(() => import('./pages/admin/Faqs'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminTickets = lazy(() => import('./pages/admin/Tickets'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminPrompts = lazy(() => import('./pages/admin/AdminPrompts'));

const adminSpinner = (
  <div className="grid min-h-dvh place-items-center bg-sky-soft">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
  </div>
);
const lazyAdmin = (el: ReactNode) => <Suspense fallback={adminSpinner}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: '/login', element: <Auth /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/dashboard', element: <ClientDashboard /> },
      { path: '/prompts', element: <Prompts /> },
      { path: '/ai-tools', element: <Navigate to="/products" replace /> },
      { path: '/ai-tools/:slug', element: <Detail category="ai-tool" base="/products" crumb="Sản phẩm" /> },
      { path: '/premium-apps', element: <Navigate to="/products" replace /> },
      { path: '/premium-apps/:slug', element: <Detail category="premium-app" base="/products" crumb="Sản phẩm" /> },
      {
        path: '/products',
        element: (
          <Listing
            category="all"
            base="/products"
            title="Sản phẩm"
            subtitle="Khám phá thế giới AI Tools & Premium Apps hàng đầu. Kích hoạt tự động, bảo hành trọn gói."
          />
        ),
      },
      { path: '/products/:slug', element: <Detail category="all" base="/products" crumb="Sản phẩm" /> },
      { path: '/contact', element: <Contact /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // ─────────────── Admin ───────────────
  // Không có trang login riêng cho admin — dùng chung /login với người dùng.
  // ProtectedRoute sẽ chuyển hướng về /login khi chưa đăng nhập.
  {
    element: lazyAdmin(<ProtectedRoute />),
    children: [
      {
        path: '/admin',
        element: lazyAdmin(<AdminLayout />),
        children: [
          { index: true, element: lazyAdmin(<Dashboard />) },
          { path: 'products', element: lazyAdmin(<AdminProducts />) },
          { path: 'products/new', element: lazyAdmin(<ProductEditor />) },
          { path: 'products/:id', element: lazyAdmin(<ProductEditor />) },
          { path: 'prompts', element: lazyAdmin(<AdminPrompts />) },
          { path: 'reviews', element: lazyAdmin(<AdminReviews />) },
          { path: 'categories', element: lazyAdmin(<AdminCategories />) },
          { path: 'faqs', element: lazyAdmin(<AdminFaqs />) },
          { path: 'contact', element: <Navigate to="/admin/tickets" replace /> },
          { path: 'orders', element: lazyAdmin(<AdminOrders />) },
          { path: 'coupons', element: lazyAdmin(<AdminCoupons />) },
          { path: 'tickets', element: lazyAdmin(<AdminTickets />) },
          { path: 'audit-logs', element: lazyAdmin(<AdminAuditLogs />) },
          { path: 'activity', element: lazyAdmin(<AdminAuditLogs />) },
          { path: 'users', element: lazyAdmin(<AdminUsers />) },
          { path: 'settings', element: lazyAdmin(<AdminSettings />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <RouterProvider router={router} />
      </FavoritesProvider>
    </AuthProvider>
  );
}
