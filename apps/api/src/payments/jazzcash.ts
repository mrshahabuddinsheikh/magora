import crypto from "node:crypto";
import { config } from "../config";
import type { PaymentProvider } from "./types";

/**
 * JazzCash hosted checkout (Page Redirection v1.1).
 * Ready-made skeleton: add merchant credentials in .env and set JAZZCASH_ENABLED=true.
 * Double-check field names against the integration guide JazzCash sends with your
 * merchant account before going live.
 */
const env = () => ({
  merchantId: process.env.JAZZCASH_MERCHANT_ID ?? "",
  password: process.env.JAZZCASH_PASSWORD ?? "",
  salt: process.env.JAZZCASH_INTEGRITY_SALT ?? "",
  sandbox: process.env.JAZZCASH_SANDBOX !== "false",
});

function secureHash(fields: Record<string, string>, salt: string) {
  const values = Object.keys(fields)
    .filter((k) => k.startsWith("pp_") && fields[k] !== "")
    .sort()
    .map((k) => fields[k]);
  return crypto.createHmac("sha256", salt).update([salt, ...values].join("&")).digest("hex").toUpperCase();
}

const ts = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14);

export const jazzcash: PaymentProvider = {
  id: "jazzcash",
  name: "JazzCash",
  description: "Pay with your JazzCash account or app.",
  kind: "wallet",
  enabled: () => true,
  async initiate(order) {
    const e = env();
    if (!e.merchantId) {
      // Direct account transfer handled via checkout & order receipt
      return { type: "none" };
    }
    const now = new Date();
    const fields: Record<string, string> = {
      pp_Version: "1.1",
      pp_TxnType: "MWALLET",
      pp_Language: "EN",
      pp_MerchantID: e.merchantId,
      pp_Password: e.password,
      pp_TxnRefNo: `T${order.number}${now.getTime().toString().slice(-6)}`,
      pp_Amount: String(order.total * 100), // paisa
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: ts(now),
      pp_TxnExpiryDateTime: ts(new Date(now.getTime() + 60 * 60 * 1000)),
      pp_BillReference: order.number,
      pp_Description: `Order ${order.number}`,
      pp_ReturnURL: `${config.publicWebUrl}/api/payments/jazzcash/return`,
      ppmpf_1: order.number,
    };
    fields.pp_SecureHash = secureHash(fields, e.salt);
    return {
      type: "form",
      method: "POST",
      action: e.sandbox
        ? "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/"
        : "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/",
      fields,
    };
  },
  async verifyCallback(body) {
    const { pp_SecureHash, ...rest } = body;
    const ok = secureHash(rest, env().salt) === pp_SecureHash;
    return {
      orderNumber: body.pp_BillReference ?? body.ppmpf_1,
      paid: ok && body.pp_ResponseCode === "000",
      reference: body.pp_TxnRefNo,
      raw: body,
    };
  },
};
