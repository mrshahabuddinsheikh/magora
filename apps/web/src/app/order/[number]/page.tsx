import { Suspense } from "react";
import { OrderClient } from "./OrderClient";

export const metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-96 max-w-3xl rounded-[28px]" />}>
      <OrderClient />
    </Suspense>
  );
}
