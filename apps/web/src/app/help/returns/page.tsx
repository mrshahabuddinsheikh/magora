import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone, RotateCcw } from "lucide-react";
import { STORE_NAME, WHATSAPP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Returns & Exchange Policy · ${STORE_NAME}`,
  description: `Official 7-Day Return and Exchange policy and online claims portal for ${STORE_NAME} Pakistan.`,
};

export default function ReturnsPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span>/</span>
        <Link href="/help" className="hover:text-ink">Help Center</Link>
        <span>/</span>
        <span className="font-semibold text-ink">Returns &amp; Exchange Policy</span>
      </div>

      <div className="glass rounded-[32px] p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <RotateCcw size={14} /> 7-Day Hassle-Free Policy
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Returns, Replacements &amp; Refunds
            </h1>
            <p className="mt-1 text-xs text-muted">
              We stand behind our quality. If your case doesn&apos;t fit or you changed your mind, we make exchanges simple.
            </p>
          </div>
          <Link
            href="/returns"
            className="btn btn-primary h-11 px-5 text-sm font-semibold shadow-md"
          >
            Start Online Return <ArrowRight size={15} />
          </Link>
        </div>

        {/* 3 Step Process */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4 text-xs space-y-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-black/5 font-bold text-ink">1</span>
            <b className="block text-sm text-ink">Submit Online</b>
            <p className="text-muted leading-relaxed">Enter your Order Number &amp; Phone on our Return Portal and select your items.</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 text-xs space-y-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-black/5 font-bold text-ink">2</span>
            <b className="block text-sm text-ink">Courier Pickup</b>
            <p className="text-muted leading-relaxed">Keep the parcel in original packaging. We arrange rider pickup or provide drop-off info.</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 text-xs space-y-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-black/5 font-bold text-ink">3</span>
            <b className="block text-sm text-ink">Exchange or Refund</b>
            <p className="text-muted leading-relaxed">New item dispatched immediately or refund sent via JazzCash / EasyPaisa / Bank.</p>
          </div>
        </div>

        {/* Policy Details */}
        <div className="mt-8 space-y-6 text-[13.5px] leading-relaxed text-ink/80 border-t border-line pt-6">
          <div>
            <h3 className="font-bold text-ink text-base">Key Return Terms:</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1.5 text-muted">
              <li><b>7 Days Window:</b> You can submit a return within 7 calendar days of courier delivery.</li>
              <li><b>Pristine Condition:</b> The case, screen protector, or accessory must be unused with original stickers and packaging intact.</li>
              <li><b>Wrong or Damaged Item:</b> If you received a defective product or wrong phone model from our side, we replace it 100% free of shipping cost.</li>
              <li><b>Refund Channels:</b> COD refunds are sent electronically to your JazzCash, EasyPaisa, or Pakistani Bank Account within 3–5 working days after inspection.</li>
            </ul>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <Link href="/returns" className="btn btn-primary h-11 px-6 text-sm">
            Go to Online Return Form <ArrowRight size={16} />
          </Link>
          <a
            href={`https://wa.me/${WHATSAPP}?text=Assalam%20o%20Alaikum%20Magora%20Support%2C%20I%20have%20a%20question%20about%20returns`}
            target="_blank"
            rel="noopener noreferrer"
            className="chip h-10 px-4 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Phone size={14} /> Talk to Return Support on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
