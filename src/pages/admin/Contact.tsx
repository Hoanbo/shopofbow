import { useState, useEffect } from 'react';

type Message = {
  id: number;
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
  created_at: string;
  unread: boolean;
  replied?: boolean;
  archived?: boolean;
  replies?: string[];
};

const SEED_MESSAGES: Message[] = [
  {
    id: 1,
    sender_name: 'Nguyễn Văn Hoài',
    sender_email: 'hoainv@gmail.com',
    subject: 'Gói YouTube Premium 1 năm có được bảo hành trọn thời gian sử dụng?',
    body: 'Chào Admin, mình muốn hỏi gói YouTube Premium 1 năm có được bảo hành trọn 12 tháng không? Nếu giữa chừng bị lỗi gia hạn thì quy trình xử lý như thế nào?',
    created_at: '2026-07-29T22:30:00.000Z',
    unread: true,
  },
  {
    id: 2,
    sender_name: 'Trần Thị Lan',
    sender_email: 'lantran@outlook.com',
    subject: 'Hợp tác đại lý phân phối slot ChatGPT Plus',
    body: 'Chào Admin BOW, hiện tại nhóm mình có cộng đồng học tập muốn đăng ký sỉ số lượng lớn slot ChatGPT Plus. Không biết bên shop có chính sách chiết khấu tốt cho đại lý hoặc số lượng từ 10 slot trở lên không?',
    created_at: '2026-07-29T21:15:00.000Z',
    unread: true,
  },
  {
    id: 3,
    sender_name: 'Lê Hoàng Nam',
    sender_email: 'namlh99@gmail.com',
    subject: 'Gặp sự cố trừ số dư ví khi mua gói Canva Pro',
    body: 'Chào shop, mình vừa bấm mua Canva Pro 1 năm và tài khoản ví đã bị trừ 249.000đ. Tuy nhiên trang lịch sử đơn hàng của mình vẫn ở trạng thái "Chờ bàn giao" hơn 15 phút rồi. Admin kiểm tra giúp mình mã đơn hàng BOW9284 nhé.',
    created_at: '2026-07-29T19:40:00.000Z',
    unread: false,
    replied: true,
    replies: ['Chào bạn Nam, shop đã kích hoạt thủ công tài khoản Canva Pro của bạn. Thông tin đăng nhập đã được cập nhật trực tiếp tại lịch sử đơn hàng của bạn. Rất xin lỗi bạn vì sự chậm trễ này!'],
  },
];

export default function AdminContact() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'inbox' | 'archived'>('inbox');

  // Load from localStorage or seed
  useEffect(() => {
    const saved = localStorage.getItem('bow_inbox_messages');
    if (saved) {
      const parsed = JSON.parse(saved);
      setMessages(parsed);
      if (parsed.length > 0) setSelectedMsgId(parsed[0].id);
    } else {
      localStorage.setItem('bow_inbox_messages', JSON.stringify(SEED_MESSAGES));
      setMessages(SEED_MESSAGES);
      setSelectedMsgId(SEED_MESSAGES[0].id);
    }
  }, []);

  const saveToStorage = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem('bow_inbox_messages', JSON.stringify(updated));
  };

  const selectedMsg = messages.find((m) => m.id === selectedMsgId);

  // Mark message read when selected
  useEffect(() => {
    if (selectedMsg && selectedMsg.unread) {
      const updated = messages.map((m) =>
        m.id === selectedMsg.id ? { ...m, unread: false } : m
      );
      saveToStorage(updated);
    }
  }, [selectedMsgId]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMsg || !replyText.trim()) return;

    const updated = messages.map((m) => {
      if (m.id === selectedMsg.id) {
        return {
          ...m,
          replied: true,
          replies: [...(m.replies || []), replyText.trim()],
        };
      }
      return m;
    });

    saveToStorage(updated);
    setReplyText('');
    alert('Đã gửi thư phản hồi khách hàng thành công!');
  };

  const handleArchive = (id: number) => {
    const updated = messages.map((m) =>
      m.id === id ? { ...m, archived: true } : m
    );
    saveToStorage(updated);
    
    // Auto select another visible message
    const visible = updated.filter((m) => filter === 'inbox' ? !m.archived : m.archived);
    if (visible.length > 0) {
      setSelectedMsgId(visible[0].id);
    } else {
      setSelectedMsgId(null);
    }
  };

  const visibleMessages = messages.filter((m) =>
    filter === 'inbox' ? !m.archived : m.archived
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Hộp thư liên hệ</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Đọc và trả lời trực tiếp các câu hỏi hỗ trợ gửi từ trang chủ BOW.</p>
        </div>
        <div className="flex gap-2">
          {['inbox', 'archived'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f as any);
                const visible = messages.filter((m) => f === 'inbox' ? !m.archived : m.archived);
                setSelectedMsgId(visible.length > 0 ? visible[0].id : null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f
                  ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f === 'inbox' ? 'Hộp thư đến' : 'Đã lưu trữ'}
            </button>
          ))}
        </div>
      </div>

      {/* INBOX CONTAINER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] overflow-hidden min-h-[600px] shadow-xs">
        
        {/* MESSAGES LIST SIDEBAR (4 Cols) */}
        <div className="lg:col-span-4 border-r border-[#E8F1FF] dark:border-[#1E2A4A]/50 flex flex-col min-w-0">
          <div className="p-4 border-b border-slate-50 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách thư</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/40">
            {visibleMessages.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-semibold">
                Không có tin nhắn nào.
              </div>
            ) : (
              visibleMessages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMsgId(m.id)}
                  className={`w-full text-left p-4.5 block transition-all relative ${
                    selectedMsgId === m.id
                      ? 'bg-blue-50/50 dark:bg-slate-800/30'
                      : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/10'
                  }`}
                >
                  {m.unread && (
                    <span className="absolute right-4.5 top-5 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate pr-4">
                      {m.sender_name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold shrink-0 ml-auto">
                      {new Date(m.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <h4 className={`text-xs truncate mt-1 ${m.unread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                    {m.subject}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">
                    {m.body}
                  </p>
                  {m.replied && (
                    <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                      ✓ Đã phản hồi
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* MESSAGE DETAIL VIEW (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col min-w-0 bg-[#F8FBFF]/30 dark:bg-slate-900/10">
          {selectedMsg ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Top toolbar */}
              <div className="p-4 border-b border-[#E8F1FF] dark:border-[#1E2A4A]/50 flex items-center justify-between gap-4 bg-white dark:bg-[#131C32]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#19A7FF] to-[#2563EB] text-xs font-black text-white flex items-center justify-center shadow-xs">
                    {selectedMsg.sender_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="leading-none">
                    <span className="block text-xs font-black text-slate-900 dark:text-white">{selectedMsg.sender_name}</span>
                    <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">{selectedMsg.sender_email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!selectedMsg.archived && (
                    <button
                      onClick={() => handleArchive(selectedMsg.id)}
                      className="rounded-full border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 transition shadow-xs"
                    >
                      🗂️ Lưu trữ thư
                    </button>
                  )}
                </div>
              </div>

              {/* Message thread details */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <h2 className="text-sm font-black text-slate-950 dark:text-white leading-relaxed">{selectedMsg.subject}</h2>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Đã gửi lúc: {new Date(selectedMsg.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Original customer message */}
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] p-4.5 text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed shadow-xs">
                  {selectedMsg.body}
                </div>

                {/* Replied trail */}
                {selectedMsg.replies && selectedMsg.replies.map((rep, idx) => (
                  <div key={idx} className="flex gap-3 justify-end">
                    <div className="rounded-2xl bg-blue-600 p-4.5 text-xs text-white font-semibold leading-relaxed shadow-md max-w-md text-left">
                      <strong className="block text-sky-100 font-black text-[10px] uppercase tracking-wider mb-1">Thư phản hồi của BOW:</strong>
                      {rep}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply composer Form */}
              <div className="p-4 border-t border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32]">
                <form onSubmit={handleSendReply} className="space-y-3">
                  <textarea
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Viết thư phản hồi tới ${selectedMsg.sender_name}...`}
                    rows={3}
                    className="w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2 text-xs font-bold text-white shadow-md hover:scale-102 transition"
                    >
                      🚀 Gửi phản hồi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-400 font-semibold text-xs">
              Vui lòng chọn một tin nhắn để hiển thị.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
