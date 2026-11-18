import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { STORE_NAME, WHATSAPP } from "@/lib/config";

/**
 * Policy & info pages. ⚠️ Review this wording and add your real business
 * details (address, phone, NTN etc.) before going live.
 */
const PAGES: Record<string, { title: string; body: string[] }> = {
  shipping: {
    title: "Shipping Policy",
    body: [
      "We deliver all over Pakistan through trusted courier partners.",
      "Orders are dispatched within 24 hours (working days) and usually arrive in 2–4 working days in major cities, and 3–6 working days elsewhere.",
      "Delivery is FREE on orders over Rs.3,000. Below that a flat Rs.200 delivery charge applies.",
      "Cash on Delivery is available everywhere we deliver. Please keep the exact amount ready for the rider.",
      "We may call you to confirm your order before dispatch. Unconfirmed orders may be cancelled.",
    ],
  },
  returns: {
    title: "Returns & Exchange",
    body: [
      "Ordered the wrong model or not happy with the colour? You can exchange it within 7 days of delivery.",
      "The case must be unused and in its original packaging.",
      "If you received a damaged or wrong item, contact us within 48 hours with a photo and we’ll replace it free of charge.",
      "To start an exchange, message us on WhatsApp with your order number.",
    ],
  },
  privacy: {
    title: "Privacy Policy & Legal Disclaimers",
    body: [
      `${STORE_NAME} operates in strict compliance with the electronic commerce and consumer protection standards of Pakistan (PECA 2016).`,
      "We collect only the essential personal information required to safely fulfill and verify your order: full name, mobile WhatsApp number, delivery address, and device model.",
      "Third-Party Trademarks: Apple, iPhone, MagSafe, AirPods, Apple Watch, Samsung, Galaxy, and Google Pixel are registered trademarks of their respective owners. Magora is an independent aftermarket accessory brand with zero official affiliation.",
      "Limitation of Liability: While our cases offer heavy-duty drop protection, no protective accessory guarantees unconditional immunity against physical drops or screen breakage. Under no circumstances is Magora liable for device repair costs or consequential damages.",
      "Cash on Delivery & Returns: All delivered orders are backed by a 7-day return policy subject to unboxing video verification and unused item condition.",
      "Governing Law: All transactions and legal disputes are subject to the exclusive jurisdiction of the competent courts of Lahore, Punjab, Pakistan.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    body: [
      "All prices are in Pakistani Rupees (PKR) and include applicable taxes.",
      "Product colours in the 3D preview are as accurate as possible but may vary slightly by screen.",
      "We reserve the right to cancel orders in case of pricing errors or stock issues — you will be informed right away.",
      "MagSafe is a trademark of Apple Inc. Our cases are MagSafe-compatible and are not made or endorsed by Apple, Samsung or Google.",
      "Magora Coins & Loyalty Rewards: Magora Coins, cashback points, and promotional rewards are granted at the sole discretion of Magora. Magora reserves the absolute and unilateral right to modify, suspend, decline, cancel, or revoke any Magora Coins or reward discounts on any order at any time without prior notice (including suspected abuse, commercial reselling, returns, or order cancellations). Coins possess no cash value and cannot be withdrawn or exchanged for currency.",
    ],
  },
  about: {
    title: `About ${STORE_NAME}`,
    body: [
      `${STORE_NAME} makes MagSafe-compatible cases for the phones people in Pakistan actually use — iPhone, Samsung Galaxy and Google Pixel.`,
      "We built the store so you can see the exact case on your exact phone in 3D before you buy, and pay only when it arrives.",
    ],
  },
  contact: {
    title: "Contact Us",
    body: ["The fastest way to reach us is WhatsApp — we usually reply within minutes during working hours (10am – 8pm, Mon–Sat)."],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/help/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: PAGES[slug]?.title ?? "Help" };
}

export default function HelpPage(props: PageProps<"/help/[slug]">) {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-80 max-w-3xl rounded-[28px]" />}>
      <Content params={props.params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <article className="card mx-auto max-w-3xl p-6 sm:p-10">
      <h1 className="text-[30px] font-bold tracking-tight">{page.title}</h1>
      <div className="mt-5 space-y-3 leading-relaxed text-muted">
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {(slug === "contact" || slug === "returns") && (
        <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="btn mt-6 bg-[#25d366] text-white">
          Message us on WhatsApp
        </a>
      )}
      <p className="mt-8 text-sm">
        <Link href="/shop" className="font-semibold text-accent">← Back to shop</Link>
      </p>
    </article>
  );
}
