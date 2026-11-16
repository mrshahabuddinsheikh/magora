import { client } from "./client";

async function main() {
  console.log("Creating push_subscriptions table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      phone TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cart_id TEXT,
      device_info TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_notified_at INTEGER
    )
  `);

  console.log("Creating customer_leads table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS customer_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      name TEXT,
      email TEXT,
      city TEXT,
      source TEXT NOT NULL DEFAULT 'lead_popup',
      preferred_model TEXT,
      interests TEXT,
      cart_value INTEGER DEFAULT 0,
      cart_items_summary TEXT,
      last_visited_page TEXT,
      visit_count INTEGER NOT NULL DEFAULT 1,
      converted_order INTEGER NOT NULL DEFAULT 0,
      whatsapp_community_opt_in INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Seed sample leads so admin table has data to view & export immediately
  console.log("Seeding sample leads...");
  const sampleLeads = [
    {
      phone: "03001234567",
      name: "Ahmed Ali",
      city: "Lahore",
      source: "lead_popup",
      preferred_model: "iPhone 16 Pro Max",
      interests: "Crystal Clear MagSafe Case, Screen Protector",
      cart_value: 3499,
      cart_items_summary: "Crystal Clear MagSafe Case (16 Pro Max)",
      whatsapp_community_opt_in: 1,
    },
    {
      phone: "03219876543",
      name: "Hamza Sheikh",
      city: "Karachi",
      source: "cart_abandoned",
      preferred_model: "Galaxy S25 Ultra",
      interests: "Frosted Matte MagSafe Case, 65W GaN Charger",
      cart_value: 6998,
      cart_items_summary: "Frosted Matte Case + 65W GaN Fast Charger",
      whatsapp_community_opt_in: 1,
    },
    {
      phone: "03335558899",
      name: "Zainab Malik",
      city: "Islamabad",
      source: "whatsapp_community",
      preferred_model: "iPhone 15 Pro",
      interests: "Carbon Fiber 3D Textured Skin",
      cart_value: 1499,
      cart_items_summary: "Carbon Fiber 3D Skin",
      whatsapp_community_opt_in: 1,
    },
    {
      phone: "03124443322",
      name: "Usman Tariq",
      city: "Faisalabad",
      source: "checkout",
      preferred_model: "iPhone 14 Pro Max",
      interests: "9H Tempered Glass Protector, MagSafe Leather Wallet",
      cart_value: 2999,
      cart_items_summary: "9H Glass + MagSafe Wallet",
      whatsapp_community_opt_in: 1,
    },
  ];

  for (const lead of sampleLeads) {
    const existing = await client.execute({
      sql: "SELECT id FROM customer_leads WHERE phone = ?",
      args: [lead.phone],
    });
    if (existing.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO customer_leads 
          (phone, name, city, source, preferred_model, interests, cart_value, cart_items_summary, whatsapp_community_opt_in)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          lead.phone,
          lead.name,
          lead.city,
          lead.source,
          lead.preferred_model,
          lead.interests,
          lead.cart_value,
          lead.cart_items_summary,
          lead.whatsapp_community_opt_in,
        ],
      });
    }
  }

  console.log("✓ Leads and Push tables migrated successfully.");
  client.close();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
