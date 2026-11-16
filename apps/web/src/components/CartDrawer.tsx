"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShoppingBag, X, ArrowRight, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useCurrentSection, getEmptyBagConfig } from "@/stores/section";
import { cn } from "@/lib/format";
import { CartItems, CouponBox, FreeShippingBar, Totals } from "./CartLines";

export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  const pathname = usePathname();
  const section = useCurrentSection();
  const emptyConfig = getEmptyBagConfig(section.slug);

  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, setOpen]);

  const empty = !cart || cart.items.length === 0;

  return (
    <div className={cn("fixed inset-0 z-[55]", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div className={cn("absolute inset-0 bg-[#0b0d12]/25 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
      <aside
        role="dialog"
        aria-label="Shopping bag"
        className={cn(
          "glass-strong absolute bottom-2 right-2 top-2 flex w-[calc(100%-16px)] max-w-[430px] flex-col rounded-[30px] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          open ? "translate-x-0" : "translate-x-[110%]",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-lg font-bold">Your bag {cart?.itemCount ? <span className="text-muted">({cart.itemCount})</span> : null}</h2>
          <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/80" aria-label="Close bag">
            <X size={18} />
          </button>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/80">
              <ShoppingBag size={26} className="text-muted" />
            </span>
            <p className="font-semibold">Your bag is empty</p>
            <p className="text-sm text-muted">{emptyConfig.subtitle}</p>
            <Link href={emptyConfig.href} className="btn btn-primary mt-2" onClick={() => setOpen(false)}>
              {emptyConfig.buttonText} <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              <FreeShippingBar cart={cart} />
              <CartItems cart={cart} compact />
            </div>
            <div className="space-y-3 border-t border-white/60 px-5 pb-5 pt-4">
              <CouponBox cart={cart} />
              <Totals cart={cart} />
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className={cn("btn btn-primary h-[52px] w-full text-[16px]", cart.hasIssues && "pointer-events-none opacity-50")}
              >
                Checkout · Cash on Delivery <ArrowRight size={18} />
              </Link>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                <ShieldCheck size={14} /> Pay when it arrives. 7-day easy returns.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
