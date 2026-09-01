// src/services/agent/contracts/orderProvider.ts
// BOW AGENT V3.3 — STEP 1: ORDER & WARRANTY PROVIDER CONTRACT
//
// Abstracts order retrieval, purchase history, and warranty verification.

export interface AgentOrderSummary {
  id: string;
  userId: string;
  productName: string;
  planLabel?: string;
  price: number;
  status: string;
  paymentCode?: string;
  notes?: string;
  createdAt: string;
  warrantyExpiresAt?: string;
}

export interface WarrantyStatusResult {
  orderId: string;
  isEligible: boolean;
  reason?: string;
  ticketCount: number;
  status: string;
}

export interface OrderProvider {
  /**
   * Retrieve a specific order by ID or payment code
   */
  getOrder(orderIdOrCode: string): Promise<AgentOrderSummary | null>;

  /**
   * Retrieve order history for a specific customer
   */
  getUserOrders(userId: string, limit?: number): Promise<AgentOrderSummary[]>;

  /**
   * Check warranty eligibility for an order (e.g. active warranty period, cancelled status)
   */
  getWarrantyStatus(orderId: string): Promise<WarrantyStatusResult>;
}
