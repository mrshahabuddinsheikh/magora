import { config } from "../config";

/** Tell the Next.js site to refresh cached pages after catalogue/admin changes. */
export async function revalidateWeb(tags: string[]) {
  if (!config.webRevalidateUrl) return;
  try {
    await fetch(config.webRevalidateUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": config.webRevalidateSecret ?? "" },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* site may be offline in dev — not fatal */
  }
}
