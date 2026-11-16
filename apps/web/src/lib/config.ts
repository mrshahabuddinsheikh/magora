/** Server-side URL of the API (can be an internal address in production) */
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
/** Browser-side URL of the API: in the browser, always use relative /api/v1 so it works on any domain without CORS */
export const PUBLIC_API_URL = typeof window !== "undefined" ? "/api/v1" : (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:4000/api/v1");
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "https://new.officialhayafoundation.com");
export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? "Magora";
export const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? "923000000000";
