/**
 * Ads & analytics events (Google Analytics 4 + Meta/Facebook Pixel).
 * Does nothing until NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID are set.
 */
type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

export function track(
  event: "add_to_cart" | "begin_checkout" | "purchase",
  d: { value: number; items?: { id: string | number; name: string; price: number; qty: number }[]; orderId?: string },
) {
  if (typeof window === "undefined") return;
  const w = window as W;
  try {
    w.gtag?.("event", event, {
      currency: "PKR",
      value: d.value,
      transaction_id: d.orderId,
      items: d.items?.map((i) => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })),
    });
    const fb = { add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" }[event];
    w.fbq?.("track", fb, {
      currency: "PKR",
      value: d.value,
      content_type: "product",
      content_ids: d.items?.map((i) => String(i.id)),
      num_items: d.items?.reduce((a, i) => a + i.qty, 0),
    }, d.orderId ? { eventID: d.orderId } : undefined);
  } catch {
    /* never break the shop because of tracking */
  }
}
