import type { PaymentProvider } from "./types";

export const easypaisa: PaymentProvider = {
  id: "easypaisa",
  name: "Easypaisa",
  description: "Pay with your Easypaisa account or app.",
  kind: "wallet",
  enabled: () => true,
  initiate: async () => ({ type: "none" }),
};

export const card: PaymentProvider = {
  id: "card",
  name: "Debit / Credit Card",
  description: "Visa, Mastercard, UnionPay, PayPak.",
  kind: "card",
  enabled: () => true,
  initiate: async () => ({ type: "none" }),
};

export const bank: PaymentProvider = {
  id: "bank",
  name: "Direct Bank Transfer",
  description: "Transfer via online banking or Raast.",
  kind: "bank",
  enabled: () => true,
  initiate: async () => ({ type: "none" }),
};

