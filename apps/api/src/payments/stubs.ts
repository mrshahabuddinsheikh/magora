import type { PaymentProvider } from "./types";

/**
 * Placeholders so the checkout UI and apps already know these methods exist.
 * Implement initiate()/verifyCallback() when the merchant accounts are ready.
 */
const notReady = async (): Promise<never> => {
  throw new Error("Payment provider not configured yet");
};

export const easypaisa: PaymentProvider = {
  id: "easypaisa",
  name: "Easypaisa",
  description: "Pay with your Easypaisa account.",
  kind: "wallet",
  enabled: () => process.env.EASYPAISA_ENABLED === "true" && !!process.env.EASYPAISA_STORE_ID,
  initiate: notReady,
};

export const card: PaymentProvider = {
  id: "card",
  name: "Debit / Credit Card",
  description: "Visa, Mastercard, UnionPay, PayPak.",
  kind: "card",
  enabled: () => process.env.CARD_ENABLED === "true" && !!process.env.CARD_MERCHANT_ID,
  initiate: notReady,
};
