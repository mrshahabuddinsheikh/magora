import { Suspense } from "react";
import { InvoiceClient } from "./InvoiceClient";

export const metadata = { title: "Invoice", robots: { index: false } };

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-muted">Loading…</p>}>
      <InvoiceClient />
    </Suspense>
  );
}
