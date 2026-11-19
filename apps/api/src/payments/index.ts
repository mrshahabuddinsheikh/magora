import { cod } from "./cod";
import { payoneer } from "./payoneer";
import { jazzcash } from "./jazzcash";
import { easypaisa, card, bank } from "./stubs";
import type { PaymentProvider } from "./types";

/** Register new gateways here — checkout, apps and the website pick them up automatically. */
export const providers: PaymentProvider[] = [cod, card, jazzcash, easypaisa, bank, payoneer];

export const getProvider = (id: string) => providers.find((p) => p.id === id && p.enabled());

export const paymentMethods = () =>
  providers.map((p) => ({ id: p.id, name: p.name, description: p.description, kind: p.kind, enabled: p.enabled() }));

export type { PaymentProvider, PaymentAction } from "./types";
