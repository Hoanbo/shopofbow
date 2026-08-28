export interface BackupCodeItem {
  code: string;
  used: boolean;
  used_at?: string;
}

const STORAGE_PREFIX = 'bow_backup_codes_v2_';

function generateRandomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Bỏ các ký tự dễ nhầm lẫn như 0, O, 1, I
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1}-${part2}`;
}

/** Lấy danh sách 10 mã dự phòng của user */
export function getStoredBackupCodes(userId: string): BackupCodeItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migration nếu là dạng string cũ
        return parsed.map((item) => {
          if (typeof item === 'string') {
            return { code: item, used: false };
          }
          return item;
        });
      }
    }
  } catch (err) {
    console.warn('[BackupCodes] Error parsing stored codes:', err);
  }

  // Tự động khởi tạo 10 mã mới nếu chưa có
  return generateNewBackupCodes(userId);
}

/** Tạo mới 10 mã dự phòng (vô hiệu hóa các mã cũ) */
export function generateNewBackupCodes(userId: string): BackupCodeItem[] {
  if (!userId) return [];
  const codes: BackupCodeItem[] = Array.from({ length: 10 }, () => ({
    code: generateRandomCode(),
    used: false,
  }));

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(codes));
  } catch (err) {
    console.error('[BackupCodes] Error saving codes:', err);
  }
  return codes;
}

/** Đếm số lượng mã còn lại / tổng số */
export function getBackupCodesStats(userId: string): { remaining: number; total: number; codes: BackupCodeItem[] } {
  const codes = getStoredBackupCodes(userId);
  const remaining = codes.filter((c) => !c.used).length;
  return {
    remaining,
    total: codes.length,
    codes,
  };
}

/** Sử dụng 1 mã dự phòng (Single-use) */
export function verifyAndConsumeBackupCode(userId: string, inputCode: string): { success: boolean; remaining: number; error?: string } {
  if (!userId || !inputCode) {
    return { success: false, remaining: 0, error: 'Vui lòng nhập mã dự phòng.' };
  }

  const normalized = inputCode.trim().toUpperCase().replace(/[\s_]/g, '-');
  const codes = getStoredBackupCodes(userId);
  
  const targetIndex = codes.findIndex((c) => c.code === normalized);
  if (targetIndex === -1) {
    return { success: false, remaining: codes.filter((c) => !c.used).length, error: 'Mã dự phòng không chính xác.' };
  }

  const targetCode = codes[targetIndex];
  if (targetCode.used) {
    return { 
      success: false, 
      remaining: codes.filter((c) => !c.used).length, 
      error: `Mã dự phòng này đã được sử dụng vào lúc ${new Date(targetCode.used_at || '').toLocaleString('vi-VN')}.` 
    };
  }

  // Đánh dấu đã sử dụng
  codes[targetIndex] = {
    ...targetCode,
    used: true,
    used_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(codes));
  } catch (err) {
    console.error('[BackupCodes] Error updating used code:', err);
  }

  const remaining = codes.filter((c) => !c.used).length;
  return { success: true, remaining };
}

/** Xóa danh sách mã dự phòng khi tắt 2FA */
export function clearBackupCodes(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch (err) {
    console.error('[BackupCodes] Error clearing codes:', err);
  }
}
