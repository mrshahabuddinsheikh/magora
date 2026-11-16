import "dotenv/config";

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`Missing env var ${k}`);
  return v;
};

function parseDbConfig() {
  const urlStr = process.env.DATABASE_URL;
  if (urlStr && (urlStr.startsWith("mysql:") || urlStr.startsWith("mysql2:"))) {
    try {
      const u = new URL(urlStr);
      return {
        host: u.hostname || "localhost",
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || "officialhayafoun_magora"),
        password: decodeURIComponent(u.password || "Shahab@1122"),
        database: u.pathname.replace(/^\//, "") || "officialhayafoun_magora",
      };
    } catch {}
  }
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "officialhayafoun_magora",
    password: process.env.DB_PASSWORD || "Shahab@1122",
    database: process.env.DB_NAME || "officialhayafoun_magora",
  };
}

export const config = {
  port: Number(env("PORT", "4000")),
  host: env("HOST", "0.0.0.0"),
  db: parseDbConfig(),
  databaseUrl: env("DATABASE_URL", "mysql://officialhayafoun_magora:Shahab%401122@localhost:3306/officialhayafoun_magora"),
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
  jwtSecret: env("JWT_SECRET", "change-me-in-production-please"),
  corsOrigins: env("CORS_ORIGINS", "*")
    .split(",")
    .map((s) => s.trim()),
  /** Next.js revalidation webhook — called after admin edits so pages refresh instantly */
  webRevalidateUrl: process.env.WEB_REVALIDATE_URL,
  webRevalidateSecret: process.env.WEB_REVALIDATE_SECRET,
  publicWebUrl: env("PUBLIC_WEB_URL", "http://localhost:3000"),
  /** Public address of this API — used to build links to uploaded photos */
  publicApiUrl: env("PUBLIC_API_URL", "http://localhost:4000"),
  uploadDir: env("UPLOAD_DIR", "./uploads"),
  isProd: process.env.NODE_ENV === "production",
};

/**
 * Refuse to start a LIVE server with the sample secrets — anyone could forge admin logins with them.
 * (Local development keeps working with the defaults.)
 */
if (config.isProd) {
  const weak: string[] = [];
  if (config.jwtSecret.startsWith("change-me") || config.jwtSecret.length < 32) weak.push("JWT_SECRET (min 32 random characters)");
  if (!process.env.WEB_REVALIDATE_SECRET || process.env.WEB_REVALIDATE_SECRET.startsWith("dev-")) weak.push("WEB_REVALIDATE_SECRET");
  if (config.corsOrigins.includes("*")) weak.push("CORS_ORIGINS (your real website address)");
  if (config.publicApiUrl.includes("localhost")) weak.push("PUBLIC_API_URL (your real API address)");
  if (weak.length) {
    console.error(`\n✗ Not starting in production. Please set these in apps/api/.env:\n  - ${weak.join("\n  - ")}\n`);
    process.exit(1);
  }
}

/** Store-level settings exposed to apps via GET /api/v1/store */
export const store = {
  name: env("STORE_NAME", "Magora"),
  tagline: "MagSafe cases, made to snap.",
  currency: "PKR",
  currencySymbol: "Rs.",
  locale: "en-PK",
  supportPhone: env("SUPPORT_PHONE", "+92 300 0000000"),
  supportWhatsapp: env("SUPPORT_WHATSAPP", "923000000000"),
  supportEmail: env("SUPPORT_EMAIL", "support@example.com"),
  shipping: {
    flatRate: 200,
    freeAbove: 3000,
    etaDays: "2–4 working days",
    /** delivery time shown on product pages, per city (working days) */
    etaByCity: {
      Karachi: [1, 2], Lahore: [2, 3], Islamabad: [2, 3], Rawalpindi: [2, 3], Hyderabad: [2, 3],
      Faisalabad: [2, 4], Multan: [2, 4], Peshawar: [2, 4],
    } as Record<string, [number, number]>,
    etaDefault: [3, 5] as [number, number],
  },
  /** "Frequently bought together": % off when a case, skin and/or protector for the SAME phone are in the cart */
  bundle: { percent: 10, sections: ["magsafe-cases", "skins", "screen-protectors"] },
  cod: { enabled: true, fee: 0, maxOrderTotal: 50000 },
  /** printed on parcel labels as the sender / return address */
  pickupAddress: env("STORE_ADDRESS", "Your warehouse address, Karachi"),
  /** label defaults: can the customer open the parcel before paying? weight of one item (grams) */
  labels: { openParcelDefault: env("OPEN_PARCEL_DEFAULT", "true") !== "false", gramsPerItem: 150, packagingGrams: 60, contents: "Mobile accessories" },
  /** reasons offered when marking a parcel as returned */
  returnReasons: [
    "Refused at door",
    "Customer not answering / phone off",
    "Customer not available at address",
    "Wrong or incomplete address",
    "Changed mind / ordered by mistake",
    "Fake order",
    "Delivery took too long",
    "Wrong / damaged item",
    "Did not like the product",
    "Courier lost or damaged",
    "Other",
  ],
  returnsDays: 7,
  /** extra charge for wrapping the sides too (skins) */
  skinSidesPrice: 300,
  cities: [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar",
    "Quetta", "Hyderabad", "Sialkot", "Gujranwala", "Bahawalpur", "Sargodha", "Sukkur",
    "Abbottabad", "Mardan", "Sahiwal", "Rahim Yar Khan", "Larkana", "Gujrat", "Okara",
    "Jhelum", "Sheikhupura", "Mirpur (AJK)", "Muzaffarabad", "Gilgit", "Other",
  ],
};
