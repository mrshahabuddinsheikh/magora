const nf = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
export const money = (n: number) => `Rs.${nf.format(n)}`;
export const pctOff = (price: number, compare?: number | null) =>
  compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const materialLabel: Record<string, string> = {
  clear: "Clear", frosted: "Frosted", silicone: "Silicone", leather: "Leather", carbon: "Aramid Carbon",
  "skin-custom": "Your Photo", "skin-solid": "Matte", "skin-carbon": "Carbon", "skin-marble": "Marble", "skin-wood": "Wood", "skin-metal": "Metal",
  "glass-clear": "Tempered Glass", "glass-privacy": "Privacy", "glass-matte": "Matte Glass", lens: "Lens Guard",
  "gadget-cable": "Cable", "gadget-charger": "Charger", "gadget-earbuds": "Earbuds", "gadget-handsfree": "Handsfree", "gadget-watch": "Smart Watch", "gadget-powerbank": "Power Bank",
};
/** materials shown in the case-only hero / filters */
export const caseMaterials = ["clear", "frosted", "silicone", "leather", "carbon"];
export const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Model name inside a brand group: "Galaxy S25 Ultra" → "S25 Ultra", "vivo X300 Pro" → "X300 Pro" */
export const shortModel = (name: string) => name.replace(/^(Galaxy|Xiaomi|vivo|OPPO|Motorola) /, "");
