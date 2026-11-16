import { Suspense } from "react";
import { RiderClient } from "./RiderClient";

export const metadata = { title: "Delivery", robots: { index: false, follow: false } };

export default function RiderPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-96 max-w-md rounded-[28px]" />}>
      <RiderClient />
    </Suspense>
  );
}
