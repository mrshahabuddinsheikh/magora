import { Suspense } from "react";
import { LabelsClient } from "./LabelsClient";

export const metadata = { title: "Parcel labels", robots: { index: false } };

export default function LabelsPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-muted">Loading…</p>}>
      <LabelsClient />
    </Suspense>
  );
}
