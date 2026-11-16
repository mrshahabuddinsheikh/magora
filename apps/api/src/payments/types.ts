export interface PaymentOrder {
  id: number;
  number: string;
  total: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
}

/** What the client (web or mobile app) must do after the order is created */
export type PaymentAction =
  | { type: "none" } // COD — nothing to do, show confirmation
  | { type: "redirect"; url: string } // open hosted payment page / in-app browser
  | { type: "form"; action: string; method: "POST"; fields: Record<string, string> }; // auto-submit form

export interface CallbackResult {
  orderNumber: string;
  paid: boolean;
  reference?: string;
  raw: unknown;
}

export interface PaymentProvider {
  id: string;
  name: string;
  description: string;
  /** shown as small icons in checkout */
  kind: "cod" | "wallet" | "card" | "bank";
  enabled(): boolean;
  initiate(order: PaymentOrder): Promise<PaymentAction>;
  /** Verify a gateway callback / webhook. Must check the signature! */
  verifyCallback?(body: Record<string, string>): Promise<CallbackResult>;
}
