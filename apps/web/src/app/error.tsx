"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { WHATSAPP } from "@/lib/config";

/** Friendly page if something breaks, instead of a blank screen */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-16 text-center">
      <div className="card w-full p-8">
        <p className="text-4xl">😕</p>
        <h1 className="mt-3 text-[22px] font-bold">Something went wrong</h1>
        <p className="mt-2 text-[14.5px] text-muted">Please try again. If it keeps happening, message us on WhatsApp and we’ll help you place your order.</p>
        <div className="mt-6 grid gap-2">
          <button onClick={() => retry()} className="btn btn-primary h-12">Try again</button>
          <Link href="/" className="btn btn-glass h-12">Go to home</Link>
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="mt-1 text-[13.5px] font-medium text-accent hover:underline">WhatsApp support</a>
        </div>
      </div>
    </section>
  );
}
