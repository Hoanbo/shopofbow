import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-bow grid place-items-center py-20 text-center">
      <div className="w-full max-w-md rounded-[28px] border border-[#E7EEF8] bg-white p-8 sm:p-10 shadow-lg">
        <span className="text-6xl font-black text-[#2563EB]">404</span>
        <h1 className="mt-4 text-2xl font-black text-[#0F172A]">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Trang bạn truy cập không tồn tại hoặc đã được chuyển sang địa chỉ mới.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-8 py-3 text-sm font-bold text-white shadow-md transition-transform duration-300 hover:scale-105 hover:from-[#0080E0] hover:to-[#1D4ED8]"
        >
          Trở về Trang chủ
        </Link>
      </div>
    </div>
  );
}
