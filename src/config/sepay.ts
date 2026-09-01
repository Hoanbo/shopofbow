/**
 * src/config/sepay.ts — Centralized SePay & Banking Configuration (Single Source of Truth)
 *
 * Used consistently across:
 *  - Dashboard User Wallet Deposit (src/pages/Dashboard.tsx)
 *  - CheckoutModal (src/components/CheckoutModal.tsx)
 *  - AgentDepositModal (src/components/agent/AgentDepositModal.tsx)
 */

export interface BankConfig {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

export const BANK_CONFIG: BankConfig = {
  bankId: 'MB',
  bankName: 'MB Bank (Quân Đội)',
  accountNo: '0966821315',
  accountName: 'NGUYEN VAN HOAN',
};

// Export alias for standard naming convention
export const SEPAY_BANK_CONFIG = BANK_CONFIG;

/**
 * Generate official VietQR payment image URL synced with SePay
 */
export function getPaymentQrUrl(amount: number, paymentCode: string): string {
  return `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${amount}&addInfo=${paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;
}
