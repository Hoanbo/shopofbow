import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-bow grid place-items-center py-24 text-center">
      <span className="text-6xl font-extrabold text-brand-500">404</span>
      <h1 className="mt-3 text-2xl font-bold text-ink">Không tìm thấy trang</h1>
      <p className="mt-2 text-ink-muted">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>
      <Link to="/" className="btn-primary mt-6">
        Về trang chủ
      </Link>
    </div>
  );
}
