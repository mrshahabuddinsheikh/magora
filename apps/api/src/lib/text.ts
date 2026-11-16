/** "Galaxy S25 Ultra" -> "galaxys25ultra" */
export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Search text for a phone model: full name, name without the family word, brand, aliases */
export function phoneSearchText(name: string, brandName: string, aliases: string) {
  const short = name.replace(/^(iphone|galaxy|pixel)\s*/i, "");
  const parts = [
    name,
    short,
    `${brandName} ${name}`,
    short.replace(/pro max/i, "pm"),
    short.replace(/ultra/i, "u"),
    short.replace(/plus|\+/i, "plus"),
    ...aliases.split(/\s+/),
  ];
  return Array.from(new Set(parts.map(normalize).filter(Boolean))).join(" ");
}
