"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/stores/cart";
import { useCurrentSection, getEmptyBagConfig } from "@/stores/section";
import { CartItems, CouponBox, FreeShippingBar, Totals } from "@/components/CartLines";

export default function CartPage() {
  const cart = useCart((s) => s.cart);
  const section = useCurrentSection();
  const emptyConfig = getEmptyBagConfig(section.slug);

  if (!cart || cart.items.length === 0)
    return (
      <div className="card mx-auto mt-6 max-w-lg p-10 text-center">
        <ShoppingBag className="mx-auto text-muted" size={36} />
        <h1 className="mt-3 text-2xl font-bold">Your bag is empty</h1>
        <p className="mt-1 text-muted">{emptyConfig.subtitle}</p>
        <Link href={emptyConfig.href} className="btn btn-primary mt-6">
          {emptyConfig.buttonText} <ArrowRight size={17} />
        </Link>
      </div>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h1 className="mb-4 text-[30px] font-bold tracking-tight">Your bag</h1>
        <div className="space-y-3">
          <FreeShippingBar cart={cart} />
          <CartItems cart={cart} />
        </div>
      </div>
      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-[92px] lg:mt-[60px]">
        <CouponBox cart={cart} />
        <Totals cart={cart} />
        <Link href="/checkout" className="btn btn-primary h-[52px] w-full">Checkout · Cash on Delivery <ArrowRight size={18} /></Link>
      </aside>
    </div>
  );
}
