import Link from "next/link";
import { Logo } from "./Header";
import { STORE_NAME } from "@/lib/config";

const cols = [
  { title: "Shop", links: [["MagSafe Cases", "/"], ["Skins", "/skins"], ["Custom Photo Skin", "/product/custom-photo-skin"], ["Screen Protectors", "/screen-protectors"], ["Gadgets", "/gadgets"]] },
  { title: "Help", links: [["Track Your Order", "/track"], ["Shipping Policy", "/help/shipping"], ["Returns & Exchange", "/help/returns"], ["Contact Us", "/help/contact"]] },
  { title: "Company", links: [["About Us", "/help/about"], ["Privacy Policy", "/help/privacy"], ["Terms & Conditions", "/help/terms"], ["My Account", "/account"]] },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-20 max-w-7xl px-3 pb-6 sm:px-5">
      <div className="glass rounded-[32px] p-6 sm:p-10">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              MagSafe cases, skins, screen protectors and gadgets for iPhone, Samsung and Pixel. See everything in 3D before you buy.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              {["Cash on Delivery", "JazzCash · soon", "Easypaisa · soon", "Cards · soon"].map((p) => (
                <span key={p} className="rounded-full bg-white/80 px-3 py-1.5">{p}</span>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-muted">
                {c.links.map(([l, h]) => (
                  <li key={h}>
                    <Link href={h} className="hover:text-ink">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row">
          <p>© {STORE_NAME}. All rights reserved.</p>
          <p>MagSafe is a trademark of Apple Inc. Our cases are MagSafe-compatible.</p>
        </div>
      </div>
    </footer>
  );
}
