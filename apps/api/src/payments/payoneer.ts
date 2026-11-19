import type { PaymentProvider } from "./types";

export const payoneer: PaymentProvider = {
  id: "payoneer",
  name: "Payoneer / Online Payment",
  description: "Pay securely with Payoneer, Debit / Credit Card or Online Transfer.",
  kind: "card",
  enabled: () => true, // Dynamically controlled by admin settings
  async initiate(order) {
    // Shows order confirmation with Payoneer direct link, account details & WhatsApp confirmation
    return { type: "none" };
  },
};
