import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone, Scale, ShieldCheck } from "lucide-react";
import { STORE_NAME, WHATSAPP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Privacy Policy & Legal Disclaimers · ${STORE_NAME}`,
  description: `Official Privacy Policy, Legal Terms, Trademark Disclaimers, and Limitation of Liability for ${STORE_NAME} Pakistan.`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Breadcrumb & Navigation */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span>/</span>
        <Link href="/help" className="hover:text-ink">Help Center</Link>
        <span>/</span>
        <span className="font-semibold text-ink">Privacy Policy &amp; Legal Protection</span>
      </div>

      {/* Header Banner */}
      <div className="glass rounded-[32px] p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <ShieldCheck size={14} /> Official Legal Policy &amp; Terms
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Privacy Policy, Terms of Service &amp; Legal Immunity
            </h1>
            <p className="mt-1 text-xs text-muted">
              Last Updated &amp; Effective Date: November 2026 · Governed by the Laws of the Islamic Republic of Pakistan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${WHATSAPP}?text=Assalam%20o%20Alaikum%20Magora%20Legal%20Support`}
              target="_blank"
              rel="noopener noreferrer"
              className="chip h-9 bg-ink text-xs font-semibold text-white hover:bg-black/80"
            >
              <Phone size={13} /> Legal Inquiries
            </a>
          </div>
        </div>

        {/* Executive Summary Alert */}
        <div className="mt-6 rounded-2xl bg-amber-50/80 p-4 border border-amber-200/70 text-[13px] leading-relaxed text-amber-950">
          <p className="font-bold flex items-center gap-1.5 text-amber-900">
            <Scale size={16} /> Legal Notice &amp; Binding Agreement:
          </p>
          <p className="mt-1">
            By visiting, browsing, placing an order, or registering with <b>{STORE_NAME}</b> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you (&quot;User&quot; or &quot;Customer&quot;) explicitly acknowledge, understand, and unconditionally accept all terms, trademark disclaimers, liability limitations, and return conditions set forth herein. If you do not agree with any part of this agreement, you must immediately discontinue the use of our services and website.
          </p>
        </div>

        {/* Structured Legal Clauses */}
        <div className="mt-8 space-y-10 text-[14px] leading-relaxed text-ink/80">

          {/* Section 1 */}
          <section id="trademarks" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">1</span>
              Third-Party Trademarks &amp; Non-Affiliation Disclaimer
            </h2>
            <div className="rounded-2xl bg-black/[0.02] p-4 text-[13px] space-y-2 border border-black/5">
              <p>
                <b>Apple®, iPhone®, MagSafe®, AirPods®, and Apple Watch®</b> are registered trademarks of Apple Inc., registered in the U.S. and other jurisdictions.
              </p>
              <p>
                <b>Samsung® and Galaxy®</b> are registered trademarks of Samsung Electronics Co., Ltd.
              </p>
              <p>
                <b>Google® and Pixel®</b> are registered trademarks of Google LLC.
              </p>
              <p className="font-semibold text-ink">
                IMPORTANT LEGAL NOTICE: {STORE_NAME} is an independent third-party designer, manufacturer, and distributor of aftermarket smartphone protective accessories. {STORE_NAME} is NOT affiliated with, sponsored by, authorized by, licensed by, or in any way officially connected with Apple Inc., Samsung Electronics, Google LLC, or any of their subsidiaries or affiliates.
              </p>
              <p>
                References to specific phone models (e.g., &quot;iPhone 16 Pro Max&quot;, &quot;Galaxy S25 Ultra&quot;) and technologies (e.g., &quot;MagSafe compatible&quot;) are made solely for the purpose of identifying device fitment and compatibility under the fair use doctrine.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="liability" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">2</span>
              Comprehensive Limitation of Liability &amp; No Device Warranty
            </h2>
            <div className="space-y-2 text-[13.5px]">
              <p>
                While our cases, tempered glass screen protectors, and skins are engineered using premium materials (polycarbonate, TPU, 9H tempered glass, N52 neodymium magnets) to offer drop protection and scratch resistance:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted">
                <li>
                  <b>NO ACCESSORY GUARANTEES 100% UNCONDITIONAL IMMUNITY:</b> Inherent physical limitations of glass and micro-electronic components mean that severe kinetic impacts, high-velocity drops, drops onto sharp gravel/surfaces, angular torsion, or pressure can cause screen shattering or internal hardware failure, regardless of whether a case is worn.
                </li>
                <li>
                  <b>NO DEVICE DAMAGE REIMBURSEMENT:</b> Under no legal theory—whether in contract, tort (including negligence), strict liability, or statutory claim—shall {STORE_NAME}, its owners, partners, executives, employees, or logistics agents be liable to you or any third party for any direct, indirect, incidental, punitive, or consequential damages resulting from device drops, cracked LCDs, water immersion, battery heating, or cosmetic scratches.
                </li>
                <li>
                  <b>MAXIMUM LEGAL LIABILITY CAP:</b> In the event that any court of competent jurisdiction finds {STORE_NAME} liable notwithstanding the provisions above, our maximum aggregate legal liability shall be strictly limited to the exact invoice amount paid by you for the specific accessory product purchased.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="data-privacy" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">3</span>
              Personal Data Collection, Usage &amp; WhatsApp Marketing Consent
            </h2>
            <p className="text-[13.5px]">
              In strict adherence to fair trade practices and the Prevention of Electronic Crimes Act (PECA 2016), we collect and process the following information:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-[13px]">
              <div className="rounded-2xl border border-line p-3.5 bg-white">
                <b className="block text-ink font-semibold">Data Collected:</b>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-muted">
                  <li>Full Customer Name &amp; Shipping Address</li>
                  <li>Mobile Phone Number (WhatsApp active)</li>
                  <li>City, Province, and Postal Area</li>
                  <li>Order details, device model, and preferences</li>
                  <li>IP address, browser user-agent &amp; cookies</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-line p-3.5 bg-white">
                <b className="block text-ink font-semibold">Purpose of Collection:</b>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-muted">
                  <li>Courier dispatch &amp; delivery via TCS, Trax, Leopards, PostEx</li>
                  <li>Cash on Delivery (COD) phone verification</li>
                  <li>Order tracking updates via SMS &amp; WhatsApp</li>
                  <li>Cart recovery reminders &amp; VIP discount codes</li>
                  <li>WhatsApp Community announcements for new drops</li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/60 p-3.5 text-[12.5px] text-emerald-950">
              <b>WhatsApp &amp; Communication Opt-In:</b> By submitting your phone number on our storefront, during checkout, or through interactive promotional banners, you grant express written consent for {STORE_NAME} to send you order notifications, delivery OTPs, feedback requests, and marketing announcements via WhatsApp or SMS. You may opt out anytime by messaging &quot;STOP&quot; to our WhatsApp support.
            </div>
          </section>

          {/* Section 4 */}
          <section id="returns-refunds" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">4</span>
              Return, Exchange &amp; Refund Legal Boundaries
            </h2>
            <div className="space-y-2 text-[13.5px]">
              <p>
                To prevent fraud and maintain the highest hygiene and quality standards:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted">
                <li>
                  <b>7-Day Time Window:</b> Return and exchange requests must be filed online through our official Return Portal within exactly seven (7) calendar days from the delivery timestamp recorded by the courier tracking system.
                </li>
                <li>
                  <b>Condition of Merchandise:</b> Products must be completely unused, free of scratches, and returned in their original packaging with all protective films, box sleeves, and lens wipes intact.
                </li>
                <li>
                  <b>Mandatory Unboxing Proof:</b> In claims regarding transit breakage, missing items, or wrong product received, the customer must submit unboxing photographic or video proof within 48 hours of delivery. Requests made without evidence or after 48 hours shall not be entertained.
                </li>
                <li>
                  <b>Non-Refundable Courier Costs:</b> For voluntary returns where the customer ordered the wrong phone model or changed their mind, return shipping freight charges (Rs. 200–300) are the responsibility of the customer.
                </li>
                <li>
                  <b>Refund Processing:</b> Cash on Delivery refunds are disbursed directly to the customer&apos;s verified JazzCash, EasyPaisa, or Pakistani Bank Account within 3 to 5 business days following physical receipt and quality inspection at our warehouse.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section id="cod-fraud" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">5</span>
              Cash on Delivery (COD) Integrity &amp; Anti-Fraud Protection
            </h2>
            <p className="text-[13.5px]">
              Cash on Delivery is provided as a convenience to genuine buyers across Pakistan. Placing fake, prank, or deliberate refusal orders causes financial injury in courier freight and packing materials:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[13px] text-muted">
              <li>Orders with unverifiable phone numbers or unresponsive WhatsApp verification may be cancelled without prior notice.</li>
              <li>Customers who repeatedly refuse delivered COD parcels without legitimate cause will be permanently blacklisted across our network and merchant partner registries.</li>
              <li>{STORE_NAME} reserves the right to require 10% to 20% advance payment for high-value orders or addresses with elevated courier return ratios (RTO).</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="disputes" className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">6</span>
              Governing Law, Dispute Resolution &amp; Jurisdiction
            </h2>
            <div className="rounded-2xl bg-black/[0.02] p-4 text-[13px] border border-black/5 space-y-2">
              <p>
                <b>Governing Law:</b> This Agreement and all transactions shall be governed by, interpreted, and enforced in accordance with the substantive laws of the Islamic Republic of Pakistan, without regard to conflicts of law principles.
              </p>
              <p>
                <b>Mandatory Amicable Resolution:</b> Before filing any formal consumer court petition, legal notice, or complaint, the customer agrees to first contact {STORE_NAME}&apos;s designated dispute resolution team via WhatsApp or written email to attempt a good-faith resolution within fourteen (14) business days.
              </p>
              <p>
                <b>Exclusive Legal Jurisdiction:</b> Any legal claim, court action, arbitration, or proceeding arising under or in connection with these terms shall be brought exclusively in the courts of competent jurisdiction located in Lahore, Punjab, Pakistan. Both parties irrevocably consent to the personal jurisdiction and venue of such courts.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="contact-legal" className="space-y-3 border-t border-line pt-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-xs">7</span>
              Legal Department Contact Details
            </h2>
            <p className="text-[13px] text-muted">
              For legal notices, data removal requests under PECA, or formal inquiries, please contact our compliance department:
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="rounded-xl bg-black/[0.04] px-3.5 py-2 text-ink">
                WhatsApp: +92 {WHATSAPP.slice(1, 4)} {WHATSAPP.slice(4)}
              </span>
              <span className="rounded-xl bg-black/[0.04] px-3.5 py-2 text-ink">
                Hours: 10:00 AM – 8:00 PM (PKT), Mon – Sat
              </span>
              <span className="rounded-xl bg-black/[0.04] px-3.5 py-2 text-ink">
                Jurisdiction: Lahore, Punjab, Pakistan
              </span>
            </div>
          </section>
        </div>

        {/* Back Link */}
        <div className="mt-10 border-t border-line pt-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            <ArrowLeft size={16} /> Return to Store
          </Link>
          <Link href="/help/returns" className="text-sm font-semibold text-muted hover:text-ink">
            View Return &amp; Exchange Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
