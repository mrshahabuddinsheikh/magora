/**
 * Ads & analytics events: Google Analytics 4, Meta / Facebook Pixel, and TikTok Pixel.
 * Synchronized seamlessly across all 3 platforms.
 */
type W = Window & {
  gtag?: (...a: unknown[]) => void;
  fbq?: (...a: unknown[]) => void;
  ttq?: {
    track: (event: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => void;
    page: () => void;
  };
};

export function track(
  event: "view_content" | "add_to_cart" | "begin_checkout" | "purchase",
  d: {
    value: number;
    items?: { id: string | number; name: string; price: number; qty: number; category?: string }[];
    orderId?: string;
  },
) {
  if (typeof window === "undefined") return;
  const w = window as W;

  try {
    // 1. Google Analytics 4 / Google Ads (gtag)
    w.gtag?.("event", event, {
      currency: "PKR",
      value: d.value,
      transaction_id: d.orderId,
      items: d.items?.map((i) => ({
        item_id: String(i.id),
        item_name: i.name,
        price: i.price,
        quantity: i.qty,
        item_category: i.category,
      })),
    });

    // 2. Meta / Facebook Pixel (fbq)
    const fbEvent = {
      view_content: "ViewContent",
      add_to_cart: "AddToCart",
      begin_checkout: "InitiateCheckout",
      purchase: "Purchase",
    }[event];

    if (fbEvent) {
      w.fbq?.(
        "track",
        fbEvent,
        {
          currency: "PKR",
          value: d.value,
          content_type: "product",
          content_ids: d.items?.map((i) => String(i.id)),
          num_items: d.items?.reduce((a, i) => a + i.qty, 0),
        },
        d.orderId ? { eventID: d.orderId } : undefined,
      );
    }

    // 3. TikTok Pixel (ttq)
    const ttEvent = {
      view_content: "ViewContent",
      add_to_cart: "AddToCart",
      begin_checkout: "InitiateCheckout",
      purchase: "CompletePayment",
    }[event];

    if (ttEvent) {
      w.ttq?.track(ttEvent, {
        content_type: "product",
        quantity: d.items?.reduce((a, i) => a + i.qty, 0) || 1,
        price: d.value,
        value: d.value,
        currency: "PKR",
        contents: d.items?.map((i) => ({
          content_id: String(i.id),
          content_name: i.name,
          quantity: i.qty,
          price: i.price,
        })),
      }, d.orderId ? { event_id: d.orderId } : undefined);
    }
  } catch {
    /* never break the storefront because of tracking */
  }
}
