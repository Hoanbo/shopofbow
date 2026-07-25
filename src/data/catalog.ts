// Data now comes from Supabase (see src/data/api.ts).
// This module only keeps the shared VND formatter used across cards.

export const formatVND = (n: number) => n.toLocaleString('vi-VN') + '₫';
