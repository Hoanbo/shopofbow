// scratch/fix_encoding.mjs
import * as fs from 'fs';

const filePath = 'src/services/agent/agentEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replaceAll('sáº£n pháº©m', 'sản phẩm');
content = content.replaceAll('ðŸ› ï¸  Xem danh má»¥c', '🛍️ Xem danh mục');
content = content.replaceAll('â†’', '→');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned agentEngine.ts encoding');
