import { store } from "../config";
import type { PaymentProvider } from "./types";

export const cod: PaymentProvider = {
  id: "cod",
  name: "Cash on Delivery",
  description: "Pay in cash when your order arrives.",
  kind: "cod",
  enabled: () => store.cod.enabled,
  async initiate() {
    return { type: "none" };
  },
};
