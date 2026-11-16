import { Suspense } from "react";
import { RateOrder } from "./RateOrder";

export const metadata = { title: "Rate your order", robots: { index: false, follow: false } };

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-muted">Loading…</p>}>
      <RateOrder />
    </Suspense>
  );
}
