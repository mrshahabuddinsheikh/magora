import { createClient } from "@libsql/client";

const client = createClient({ url: "file:apps/api/data/store.db" });

async function migrateAndSeed() {
  console.log("Creating shoppable_reels table...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS shoppable_reels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      caption TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      product_id INTEGER,
      product_name TEXT,
      product_price INTEGER,
      product_compare_at_price INTEGER,
      product_slug TEXT,
      product_image TEXT,
      phone_model TEXT,
      likes_count INTEGER NOT NULL DEFAULT 18500,
      views_count INTEGER NOT NULL DEFAULT 45200,
      comments_count INTEGER NOT NULL DEFAULT 64,
      shares_count INTEGER NOT NULL DEFAULT 2300,
      comments TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  console.log("Table shoppable_reels created or already exists.");

  const check = await client.execute("SELECT count(*) as count FROM shoppable_reels");
  if ((check.rows[0].count as number) === 0) {
    console.log("Seeding sample TikTok / Instagram reels...");

    const sampleComments1 = [
      {
        id: "c1",
        author: "Zainab Malik",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
        city: "Lahore",
        rating: 5,
        text: "Ordered this yesterday for my 16 Pro Max and got it today! Magnets are genuinely super strong. 10/10 recommend! 🔥",
        likes: 142,
        timeAgo: "2h ago",
        verifiedBuyer: true,
      },
      {
        id: "c2",
        author: "Hamza Tariq",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
        city: "Karachi",
        rating: 5,
        text: "Crystal clarity is insane. Doesn't turn yellow at all like cheap market cases. Best in Pakistan.",
        likes: 89,
        timeAgo: "5h ago",
        verifiedBuyer: true,
      },
      {
        id: "c3",
        author: "Daniyal Sheikh",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
        city: "Islamabad",
        rating: 5,
        text: "Car mount par direct chipak jata hai bilkul nahi girta! Worth every rupee.",
        likes: 54,
        timeAgo: "1d ago",
        verifiedBuyer: true,
      },
    ];

    const sampleComments2 = [
      {
        id: "c4",
        author: "Bilal Ahmed",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
        city: "Rawalpindi",
        rating: 5,
        text: "Bhai yeh drop test dekh kar foran buy now kar liya! Phone bacha liya case ne 👌",
        likes: 210,
        timeAgo: "1h ago",
        verifiedBuyer: true,
      },
      {
        id: "c5",
        author: "Ayesha Khan",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
        city: "Faisalabad",
        rating: 5,
        text: "Titanium corner air cushions are actually legit. Hands down best protection.",
        likes: 76,
        timeAgo: "3h ago",
        verifiedBuyer: true,
      },
    ];

    const sampleComments3 = [
      {
        id: "c6",
        author: "Saad Rehman",
        avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
        city: "Lahore",
        rating: 5,
        text: "Frosted matte texture feels exactly like the back glass of iPhone 16 Pro! Zero fingerprints.",
        likes: 184,
        timeAgo: "4h ago",
        verifiedBuyer: true,
      },
      {
        id: "c7",
        author: "Omar Farooq",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
        city: "Multan",
        rating: 5,
        text: "Fast delivery by TCS in 24 hours. COD packaging was premium box.",
        likes: 67,
        timeAgo: "8h ago",
        verifiedBuyer: true,
      },
    ];

    // High quality vertical webm/mp4 samples
    await client.execute({
      sql: `INSERT INTO shoppable_reels (
        title, caption, video_url, thumbnail_url,
        product_id, product_name, product_price, product_compare_at_price,
        product_slug, product_image, phone_model,
        likes_count, views_count, comments_count, shares_count,
        comments, active, sort
      ) VALUES 
      (
        'Crystal Clear MagSafe Case — Real Unboxing & Snap Test',
        'Watch the unboxing of our best-selling Crystal Clear MagSafe Case for iPhone 16 Pro Max. 38x N52 Neodymium magnets with anti-yellowing German Bayer polycarbonate!',
        '/videos/reel-1.mp4',
        'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=1000&fit=crop',
        1, 'Crystal Clear MagSafe Case', 2499, 3499,
        'crystal-clear-magsafe-case', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop', 'iPhone 16 Pro Max',
        24850, 68900, 128, 4210,
        ?, 1, 1
      ),
      (
        '10-Foot Drop Test: Titanium Corner Armor in Action! 💥',
        'Can your case survive a 10-foot drop onto solid concrete? Watch our military-grade corner airbags absorb impact without a single scratch on the screen.',
        '/videos/reel-2.mp4',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&h=1000&fit=crop',
        1, 'Heavy-Duty Armor MagSafe Case', 2999, 4499,
        'crystal-clear-magsafe-case', 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=400&h=400&fit=crop', 'iPhone 16 Pro Max',
        38420, 92100, 215, 6850,
        ?, 1, 2
      ),
      (
        'Frosted Matte Smoke Edition — The Ultimate Stealth Look 🖤',
        'Silky matte touch that resists grease, sweat, and fingerprints completely. Built-in aerospace aluminum camera ring that doubles as a kickstand!',
        '/videos/reel-3.mp4',
        'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&h=1000&fit=crop',
        1, 'Frosted Matte MagSafe Case', 2699, 3699,
        'crystal-clear-magsafe-case', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&h=400&fit=crop', 'iPhone 16 Pro / Max',
        19840, 51300, 94, 3120,
        ?, 1, 3
      )`,
      args: [
        JSON.stringify(sampleComments1),
        JSON.stringify(sampleComments2),
        JSON.stringify(sampleComments3),
      ],
    });

    console.log("Seeded 3 shoppable reels with authentic comments, likes, and product attachments.");
  }
}

migrateAndSeed().catch(console.error);
