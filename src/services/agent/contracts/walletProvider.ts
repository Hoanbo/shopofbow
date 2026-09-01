// src/services/agent/contracts/walletProvider.ts
// BOW AGENT V3.3 — STEP 1: WALLET & DEPOSIT PROVIDER CONTRACT
//
// Abstracts wallet balances, top-up instructions, and bank configuration.

export interface DepositInstructions {
  bankId: string;
  accountNo: string;
  accountName: string;
  transferSyntax?: string;
  qrUrl?: string;
  suggestedAmounts: number[];
}

export interface WalletProvider {
  /**
   * Retrieve the current balance for a user
   */
  getBalance(userId: string): Promise<number>;

  /**
   * Get bank transfer details and instructions for wallet deposit
   */
  getDepositInstructions(amount?: number, userId?: string): Promise<DepositInstructions>;
}
