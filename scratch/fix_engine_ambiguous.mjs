// scratch/fix_engine_ambiguous.mjs
import * as fs from 'fs';

const filePath = 'src/services/agent/agentEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF for matching
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

const ambiguousReplacements = [
  ["lowerText === 'tÃ´i cáº§n ai tá»‘t'", "lowerText === 'tôi cần ai tốt'"],
  ["lowerText === 'tÃ´i cáº§n ai tá»‘t?'", "lowerText === 'tôi cần ai tốt?'"],
  ["lowerText === 'app nÃ o hay'", "lowerText === 'app nào hay'"],
  ["lowerText === 'app nÃ o hay?'", "lowerText === 'app nào hay?'"],
  ["lowerText === 'tool nÃ o tá»‘t'", "lowerText === 'tool nào tốt'"],
  ["lowerText === 'tool nÃ o tá»‘t?'", "lowerText === 'tool nào tốt?'"],
  ["lowerText === 'cho tÃ´i má»™t tool tá»‘t'", "lowerText === 'cho tôi một tool tốt'"],
  ["lowerText === 'ai tá»‘t'", "lowerText === 'ai tốt'"],
  ["lowerText === 'cÃ´ng cá»¥ tá»‘t'", "lowerText === 'công cụ tốt'"],
  ["'â “ **Báº¡n muá»‘n dÃ¹ng AI để lÃ m viá»‡c gÃ¬ cá»¥ thá»ƒ?**\\n\\nVÃ­ dá»¥: Táº¡o áº£nh, lÃ m video, viáº¿t ná»™i dung/code, dá»‹ch thuáº­t hay há» c táº­p để mÃ¬nh tÆ° váº¥n gÃ³i phÃ¹ há»£p nháº¥t nhé!'",
   "'❓ **Bạn muốn dùng AI để làm việc gì cụ thể?**\\n\\nVí dụ: Tạo ảnh, làm video, viết nội dung/code, dịch thuật hay học tập để mình tư vấn gói phù hợp nhất nhé!'"],
  ["['ðŸŽ¬ LÃ m video AI', 'ðŸŽ¨ Váº½ & Táº¡o áº£nh', 'ðŸ’» Láº­p trÃ¬nh & Code', 'ðŸŽµ Nghe nháº¡c & Xem phim']",
   "['🎬 Làm video AI', '🎨 Vẽ & Tạo ảnh', '💻 Lập trình & Code', '🎵 Nghe nhạc & Xem phim']"],
  ["['/reset', 'reset chat', 'reset phiÃªn', 'xÃ³a ngá»¯ cáº£nh', 'báº¯t Ä‘áº§u láº¡i tá»« Ä‘áº§u', 'lÃ m má»›i phiÃªn chat']",
   "['/reset', 'reset chat', 'reset phiên', 'xóa ngữ cảnh', 'bắt đầu lại từ đầu', 'làm mới phiên chat']"],
  ["`ðŸ”„ MÃ¬nh Ä‘Ã£ lÃ m má»›i cuá»™c há»™i thoáº¡i.\\n\\nBáº¡n cáº§n há»— trá»£ tÃ¬m sáº£n pháº©m, xem báº£ng giÃ¡ hay tra cá»©u Ä‘Æ¡n hÃ ng nÃ o?`",
   "`🔄 Mình đã làm mới cuộc hội thoại.\\n\\nBạn cần hỗ trợ tìm sản phẩm, xem bảng giá hay tra cứu đơn hàng nào?`"],
  ["['ðŸ› ï¸  Xem danh má»¥c', 'ðŸ”Ž TÃ¬m sáº£n pháº©m', 'ðŸ“¦ Kiá»ƒm tra Ä‘Æ¡n hÃ ng']",
   "['🛍️ Xem danh mục', '🔎 Tìm sản phẩm', '📦 Kiểm tra đơn hàng']"]
];

let replacedCount = 0;
for (const [from, to] of ambiguousReplacements) {
  if (content.includes(from)) {
    content = content.replaceAll(from, to);
    replacedCount++;
  }
}

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Successfully replaced ${replacedCount} patterns in ${filePath}`);
