import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Listing from './pages/Listing';
import Detail from './pages/Detail';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import { AuthProvider } from './context/AuthContext';

// Admin is code-split so the public site never downloads the dashboard bundle.
const ProtectedRoute = lazy(() => import('./components/admin/ProtectedRoute'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const ProductEditor = lazy(() => import('./pages/admin/ProductEditor'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminFaqs = lazy(() => import('./pages/admin/Faqs'));
const AdminContact = lazy(() => import('./pages/admin/Contact'));

const adminSpinner = (
  <div className="grid min-h-dvh place-items-center bg-sky-soft">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
  </div>
);
const lazyAdmin = (el: ReactNode) => <Suspense fallback={adminSpinner}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/ai-tools',
        element: (
          <Listing
            category="ai-tool"
            base="/ai-tools"
            title="AI Tools"
            subtitle="Tài khoản AI chính chủ — ChatGPT, Claude, Gemini... kích hoạt tức thì, bảo hành trọn gói."
          />
        ),
      },
      { path: '/ai-tools/:slug', element: <Detail category="ai-tool" base="/ai-tools" crumb="AI Tools" /> },
      {
        path: '/premium-apps',
        element: (
          <Listing
            category="premium-app"
            base="/premium-apps"
            title="Premium Apps"
            subtitle="Netflix, Spotify, YouTube Premium... giá siêu tốt, dùng ngay."
            layout="list"
          />
        ),
      },
      { path: '/premium-apps/:slug', element: <Detail category="premium-app" base="/premium-apps" crumb="Premium Apps" /> },
      {
        path: '/products',
        element: (
          <Listing
            category="product"
            base="/products"
            title="Featured Products"
            subtitle="Công cụ sáng tạo & tiện ích được yêu thích nhất."
          />
        ),
      },
      { path: '/products/:slug', element: <Detail category="product" base="/products" crumb="Sản phẩm" /> },
      { path: '/contact', element: <Contact /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // ─────────────── Admin ───────────────
  { path: '/admin/login', element: lazyAdmin(<Login />) },
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
          { path: 'categories', element: lazyAdmin(<AdminCategories />) },
          { path: 'faqs', element: lazyAdmin(<AdminFaqs />) },
          { path: 'contact', element: lazyAdmin(<AdminContact />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
