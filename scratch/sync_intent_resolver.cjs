const fs = require('fs');

const srcPath = 'C:\\Web\\shopofbow\\src\\services\\agent\\intentResolver.ts';
const targetPath = 'C:\\BOW\\bow-agent\\src\\core\\intentResolver.ts';

let content = fs.readFileSync(srcPath, 'utf8');

// Replace local imports with standalone package imports
content = content.replace(
  "import type { AgentIntent, MultiIntentResult, DeferredContext, PlanItemResult } from './types';",
  "import type { AgentIntent, MultiIntentResult, DeferredContext, PlanItemResult } from './types';"
);

// Enhance hasWallet and hasOrderQuery and hasBuy
const targetFlags = `  const hasBuy =
    lower.startsWith('mua') ||
    cleanLower.startsWith('mua') ||
    lower.startsWith('đặt mua') ||
    cleanLower.startsWith('dat mua') ||
    lower.startsWith('thanh toán') ||
    cleanLower.startsWith('thanh toan') ||
    lower.includes('mua ') ||
    cleanLower.includes('mua ') ||
    lower.includes('mua luôn') ||
    cleanLower.includes('mua luon') ||
    lower.includes('mua ngay') ||
    cleanLower.includes('mua ngay') ||
    lower.includes('mua gói') ||
    cleanLower.includes('mua goi') ||
    lower.includes('lấy gói') ||
    cleanLower.includes('lay goi') ||
    lower.includes('chốt gói') ||
    cleanLower.includes('chot goi') ||
    lower.includes('mình muốn mua') ||
    cleanLower.includes('minh muon mua') ||
    lower.includes('tôi muốn mua') ||
    cleanLower.includes('toi muon mua') ||
    lower.includes('tôi cần mua') ||
    cleanLower.includes('toi can mua') ||
    lower.includes('có muốn mua') ||
    cleanLower.includes('co muon mua') ||
    lower.includes('muốn mua') ||
    cleanLower.includes('muon mua') ||
    lower.includes('cần mua') ||
    cleanLower.includes('can mua') ||
    lower.includes('đăng ký gói') ||
    cleanLower.includes('dang ky goi') ||
    lower.includes('đăng ký ') ||
    cleanLower.includes('dang ky ') ||
    lower.includes('cho tôi mua') ||
    cleanLower.includes('cho toi mua') ||
    (context.lastMentionedProduct &&
      (cleanLower === 'mua' || cleanLower === 'mua luon' || cleanLower === 'thanh toan ngay' || cleanLower === 'lay goi nay' || cleanLower === 'mua cai nay' || cleanLower === 'lay cai nay'));

  const hasWallet =
    cleanLower === 'nap' ||
    cleanLower.startsWith('nap ') ||
    cleanLower.includes('nap') ||
    cleanLower.includes('vi') ||
    cleanLower.includes('so du') ||
    cleanLower.includes('nap tien') ||
    cleanLower.includes('nap them tien') ||
    cleanLower.includes('nap them') ||
    cleanLower.includes('nap vi') ||
    cleanLower.includes('topup') ||
    cleanLower.includes('top up') ||
    cleanLower.includes('tien trong vi') ||
    cleanLower.includes('con bao nhieu tien') ||
    cleanLower.includes('kiem tra vi') ||
    cleanLower.includes('vi dien tu') ||
    lower.includes('nạp') ||
    lower.includes('ví') ||
    lower.includes('số dư') ||
    /^n[a\u1ea1]p\\s+[+0-9]/.test(lower) ||
    /^n[a\u1ea1]p\\s+\\d+[kKd\u0111]/.test(lower) ||
    /n[a\u1ea1]p\\s+[+]?\\d+[.,]?\\d*\\s*[kKd\u0111]/.test(lower) ||
    /n[a\u1ea1]p\\s+ti[e\u1ec1]n\\s+v[a\u00e0]o\\s+v[i\u00ed]/.test(lower) ||
    /n[a\u1ea1]p\\s+[+]\\d/.test(lower);

  const hasOrderQuery =
    cleanLower.includes('don hang') ||
    cleanLower.includes('lich su mua') ||
    cleanLower.includes('tai khoan da mua') ||
    cleanLower.includes('tra cuu don') ||
    cleanLower.includes('kiem tra don') ||
    cleanLower.includes('don gan day') ||
    cleanLower.includes('don cho duyet') ||
    cleanLower.includes('danh sach don') ||
    cleanLower.includes('xem don') ||
    lower.includes('đơn hàng') ||
    lower.includes('lịch sử mua') ||
    lower.includes('tài khoản đã mua') ||
    lower.includes('tra cứu đơn') ||
    lower.includes('kiểm tra đơn') ||
    lower.includes('đơn gần đây') ||
    lower.includes('đơn chờ duyệt') ||
    lower.includes('danh sách đơn') ||
    lower.includes('xem đơn');`;

const oldBlockRegex = /const hasBuy =[\s\S]*?const hasOrderQuery =[\s\S]*?lower\.includes\('xem đơn'\);/;
content = content.replace(oldBlockRegex, targetFlags);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Synced intentResolver.ts to @bow/agent/src/core/intentResolver.ts');
