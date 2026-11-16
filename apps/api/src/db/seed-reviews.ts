import { and, avg, count, eq, sql } from "drizzle-orm";
import { db, client, tuneDatabase } from "./client";
import * as s from "./schema";

await tuneDatabase();

interface ReviewTemplate {
  title: string;
  body: string;
  rating: number;
  adminReply?: string;
}

const PAKISTANI_NAMES = [
  "Hamza Tariq", "Bilal Ahmed", "Usman Farooq", "Muhammad Ali", "Ayesha Malik",
  "Saad Khan", "Fatima Zahra", "Zainab Imran", "Omer Siddiqui", "Hassan Raza",
  "Daniyal Sheikh", "Taha Qureshi", "Shahmeer Khan", "Abdullah Rehman", "Haris Mehmood",
  "Waleed Khalid", "Zeeshan Ali", "Mahnoor Shah", "Sana Javed", "Farhan Butt",
  "Arham Asif", "Ahmed Raza", "Kashif Niaz", "Raza Abbas", "Marium Noor",
  "Shahid Afridi", "Mustafa Kamal", "Ali Hamza", "Saim Ayub", "Hammad Munir",
  "Naveed Ashraf", "Rehan Baig", "Adeel Chaudhry", "Nimra Tariq", "Iqra Aziz",
  "Shehroz Sabzwari", "Fahad Mustafa", "Babar Azam", "Shaheen Shah", "Shadab Khan",
  "Haseeb Amjad", "Talha Anjum", "Umair Jaswal", "Asim Azhar", "Zubair Hashmi",
  "Faizan Haider", "Noman Ijaz", "Waqas Younas", "Sheryar Munawar", "Danish Taimoor"
];

const CASE_REVIEWS: ReviewTemplate[] = [
  {
    title: "Magnet strength is insane! 🔥",
    body: "Main ne car mount ke saath test kiya, bilkul bhi nahi hilta even on bumpy roads in Karachi. Material quality is top notch.",
    rating: 5,
    adminReply: "JazakAllah Hamza! Glad the N52 magnets are working great for you ❤️",
  },
  {
    title: "Perfect fit & clicky buttons",
    body: "Phone par bilkul snug fit hai aur buttons dabane mein bilkul original feel aati hai. Camera protection lip bhi kaafi raised hai.",
    rating: 5,
  },
  {
    title: "Best MagSafe case in Pakistan so far",
    body: "I was skeptical before ordering on COD, but parcel khol kar check kiya to dil khush ho gaya. Premium packaging and finish.",
    rating: 5,
    adminReply: "Thank you for trusting Magora! Glad you loved the packaging ✨",
  },
  {
    title: "Clean look, solid protection",
    body: "Dropped my phone once from desk height, not even a scratch. Corner cushions actually work.",
    rating: 5,
  },
  {
    title: "Bahut achi quality hai",
    body: "Lahore mein 2 din mein deliver ho gaya. Rider bohot cooperative tha. Case ka colour aur texture exactly website jaisa hai.",
    rating: 5,
  },
  {
    title: "Snaps perfectly onto my Qi2 charger",
    body: "Fast charging works without any extra heating. The magnetic alignment is 100% accurate.",
    rating: 5,
  },
  {
    title: "Value for money",
    body: "Market mein local shops 4000-5000 maang rahi theen aisi quality ka. Magora's price with COD is unmatched.",
    rating: 5,
  },
  {
    title: "Really good grip",
    body: "Haath se fisalta nahi hai bilkul. Matte finish feels silky yet grippy.",
    rating: 4,
  },
  {
    title: "Satisfied with purchase",
    body: "Camera ring is metal which looks really classy. Overall 9/10 experience.",
    rating: 4,
  },
  {
    title: "Bohot pyara case hai",
    body: "Islamabad delivery within 48 hours. Phone bilkul slim lagta hai case ke andar bhi, bulky nahi lagta.",
    rating: 5,
    adminReply: "Thank you for the kind words! Enjoy your new case 🚀",
  },
  {
    title: "Superb quality!",
    body: "Case fits like a glove. MagSafe wallet locks firmly onto the back, zero wobble.",
    rating: 5,
  },
  {
    title: "Worth every rupee",
    body: "Pehele Daraz se mangwaya tha local case jo yellow ho gaya tha. Yeh wala anti-yellowing coating ke saath genuinely premium hai.",
    rating: 5,
  },
  {
    title: "Solid build quality",
    body: "Corners have subtle air pockets for impact. Raised lip gives full confidence laying phone face-down.",
    rating: 5,
  },
  {
    title: "Good delivery speed",
    body: "Delivered to Faisalabad in 3 days. Rider allowed me to check the parcel before payment.",
    rating: 4,
  },
  {
    title: "Looks sleek and minimal",
    body: "Logo cut-out and finish are very clean. Texture prevents fingerprints.",
    rating: 5,
  },
  {
    title: "Strong magnet & premium feel",
    body: "Charges at full speed on my Apple MagSafe puck. Doesn't get hot.",
    rating: 5,
  },
  {
    title: "Accurate camera cutouts",
    body: "Har lens ke ird gird proper clearance hai. Flash or mic hole bilkul accurate hain.",
    rating: 5,
  },
  {
    title: "Decent case for daily use",
    body: "Edges could be slightly softer but overall protection and MagSafe snap are 10/10.",
    rating: 4,
  },
  {
    title: "Excellent customer service",
    body: "WhatsApp support helped me confirm my model before dispatch. Very polite team.",
    rating: 5,
    adminReply: "Our WhatsApp team is always here to help! Shukriya for shopping with us 😊",
  },
  {
    title: "Paisa wasool product",
    body: "Design 3D preview se 100% match karta hai jo site pe dekha tha. Will buy again for my brother.",
    rating: 5,
  },
  {
    title: "A+ Quality and finish",
    body: "Doesn't interfere with my edge-to-edge tempered glass. Great engineering.",
    rating: 5,
  },
  {
    title: "Very satisfied",
    body: "Rawalpindi COD delivered on time. Case feels durable and light.",
    rating: 5,
  },
  {
    title: "Pretty good cover",
    body: "Slight delay by courier in Multan (took 4 days), but product itself is immaculate.",
    rating: 4,
    adminReply: "Sorry for the slight courier delay in Multan! Glad the product met your expectations 🙌",
  },
  {
    title: "Strong grip, high quality",
    body: "Doesn't collect pocket lint. Perfect daily driver case.",
    rating: 5,
  },
];

const SKIN_REVIEWS: ReviewTemplate[] = [
  {
    title: "Precision cuts are perfection!",
    body: "Hair dryer se edges heat karke lagaya, bilkul seamless finish aayi hai. Feels like a custom factory paint job.",
    rating: 5,
    adminReply: "Heat gun / hair dryer trick works wonders! Glad you enjoyed the installation 💯",
  },
  {
    title: "Texture feel is amazing",
    body: "Hands down the best skin in Pakistan. Carbon / matte texture gives solid grip without any bulk.",
    rating: 5,
  },
  {
    title: "No sticky residue",
    body: "Maine purani skin utaar kar check kiya, zero glue left on the glass back. 3M vinyl quality is genuine.",
    rating: 5,
  },
  {
    title: "Camera cutouts 100% accurate",
    body: "Har camera lens aur flash ke ird gird bilkul millimeter perfect cut hai. Very satisfied.",
    rating: 5,
  },
  {
    title: "Bohot zabardast skin hai",
    body: "Custom print skin mangwayi thi, print quality is razor sharp. Colours didn't wash out at all.",
    rating: 5,
    adminReply: "Our high-res print lab ensures vivid colours! Thank you for the awesome review ❤️",
  },
  {
    title: "Looks super stealthy",
    body: "Matte black skin transformed my phone completely. Everyone asks where I got it from.",
    rating: 5,
  },
  {
    title: "Takes patience to apply but result is worth it",
    body: "Thoda time lagta hai align karne mein, but once heated and pressed it locks in permanently.",
    rating: 4,
  },
  {
    title: "Sides coverage is a game changer",
    body: "Wrapped the sides as well. Now no scratches on the glossy aluminum frame.",
    rating: 5,
  },
  {
    title: "Top quality 3M vinyl",
    body: "Air release channels make it virtually impossible to get bubbles. Extremely easy install.",
    rating: 5,
  },
  {
    title: "Fast COD delivery to Peshawar",
    body: "Delivered in sturdy envelope packaging so no folds or creases. 10/10.",
    rating: 5,
  },
  {
    title: "Sleek and scratch proof",
    body: "Keys ke saath pocket mein phone rehta hai, skin has taken all scratches bravely.",
    rating: 5,
  },
  {
    title: "Marble texture looks luxurious",
    body: "Gold veins on matte white marble look so realistic. Feels like real stone under fingers.",
    rating: 5,
  },
  {
    title: "Great protection without weight",
    body: "Hate thick cases so skins are my go-to. This one fits the bill effortlessly.",
    rating: 4,
  },
  {
    title: "Reapplied twice during install with zero issues",
    body: "The adhesive is forgiving. You can lift it up and reposition if misaligned on first try.",
    rating: 5,
  },
  {
    title: "Solid product from Magora",
    body: "Delivery rider in Karachi was prompt. Packaging was clean and included cleaning wipes.",
    rating: 5,
  },
  {
    title: "Clean look",
    body: "Logo cutout aligned on point. Gives phone a completely fresh aesthetic.",
    rating: 5,
  },
  {
    title: "Best vinyl skins in PK",
    body: "Quality beats Dbrand imported ones which cost 3x with customs. Support local!",
    rating: 5,
    adminReply: "JazakAllah for supporting local Pakistani craftsmanship! 🇵🇰❤️",
  },
  {
    title: "Nice texture",
    body: "Feels good in hand, not slippery anymore.",
    rating: 4,
  },
  {
    title: "Edges stayed down",
    body: "Been 3 weeks now, edges haven't peeled even with tight jeans pockets.",
    rating: 5,
  },
  {
    title: "Very impressed",
    body: "Ordered two designs, both arrived pristine. Easy to apply with heat.",
    rating: 5,
  },
  {
    title: "5 stars all the way",
    body: "The back and frame look brand new now. Total protection from everyday scratches.",
    rating: 5,
  },
  {
    title: "Good value",
    body: "Affordable and looks high end. Fast dispatch.",
    rating: 4,
  },
];

const PROTECTOR_REVIEWS: ReviewTemplate[] = [
  {
    title: "Crystal clear & super smooth",
    body: "Finger glides effortlessly across the surface. Oleophobic coating is genuine, fingerprints wipe off with one swipe.",
    rating: 5,
  },
  {
    title: "Privacy filter actually works!",
    body: "Metro ya public transport mein koi side se nahi dekh sakta screen. Straight view is 100% bright and clear.",
    rating: 5,
    adminReply: "Privacy protectors are a must for commuters! Glad it's doing its job 🛡️",
  },
  {
    title: "Edge to edge coverage with no lift",
    body: "Compatible with MagSafe cases. Doesn't get pushed up by the case lips.",
    rating: 5,
  },
  {
    title: "Saved my screen already!",
    body: "Phone fell face first on ceramic tiles. Protector cracked slightly but original display was 100% safe. Reordering another one right now.",
    rating: 5,
    adminReply: "Phew! That's what a 9H sacrificial glass is for. Stay safe! 🙌",
  },
  {
    title: "Touch sensitivity unchanged",
    body: "Ultrasonic fingerprint unlock works instantly. No delay in typing or gaming.",
    rating: 5,
  },
  {
    title: "Easy bubble-free installation",
    body: "Included alignment wipes made installation foolproof. Zero dust bubbles.",
    rating: 5,
  },
  {
    title: "Matte finish is perfect for gaming",
    body: "Zero glare under sunlight and no sticky thumbs while playing PUBG.",
    rating: 5,
  },
  {
    title: "Camera lens protector is clear",
    body: "Night mode photos mein lens flare nahi aata. Glass quality is very optical grade.",
    rating: 5,
  },
  {
    title: "Good product",
    body: "Covers the whole display nicely. Very smooth rounded 2.5D edges.",
    rating: 4,
  },
  {
    title: "Very durable 9H glass",
    body: "Been using for 2 months, zero micro-scratches. Top quality.",
    rating: 5,
  },
  {
    title: "Worth the price",
    body: "Much better than local market 200-300 rupee glass that shatters in two days.",
    rating: 5,
  },
  {
    title: "Smooth feel",
    body: "Display colors remain punchy and vibrant. High transparency.",
    rating: 4,
  },
  {
    title: "Delivered safely in Islamabad",
    body: "Hard box packing ensured glass didn't arrive broken. Thanks team Magora.",
    rating: 5,
  },
  {
    title: "Full glue coverage",
    body: "No rainbow effect in the center. Full adhesive stick.",
    rating: 5,
  },
  {
    title: "Awesome privacy angle",
    body: "From 28 degrees onwards the screen goes pitch black for prying eyes.",
    rating: 5,
  },
  {
    title: "Solid purchase",
    body: "Applied easily, feels like the naked screen.",
    rating: 5,
  },
  {
    title: "Case friendly",
    body: "Leaves just enough sub-millimeter gap on edges so case doesn't pop it.",
    rating: 5,
  },
  {
    title: "Good oleophobic layer",
    body: "Oil and sweat from fingers don't smudge the display.",
    rating: 4,
  },
  {
    title: "Highly recommended",
    body: "Best screen protector I have used on this phone.",
    rating: 5,
  },
  {
    title: "Fast shipping",
    body: "Arrived in 2 days via COD. Quality is as promised.",
    rating: 5,
  },
  {
    title: "Top tier protector",
    body: "Clear, responsive, robust. 5/5 stars.",
    rating: 5,
  },
  {
    title: "Nice protection",
    body: "Clean look and smooth gestures.",
    rating: 4,
  },
];

const GADGET_REVIEWS: ReviewTemplate[] = [
  {
    title: "Blazing fast charging speed!",
    body: "Tested with my fast charger, shows rapid/turbo charging immediately. Cable doesn't get warm.",
    rating: 5,
    adminReply: "GaN circuitry and thick copper cores make sure power delivers efficiently! ⚡",
  },
  {
    title: "Heavy duty braided quality",
    body: "Bending strain relief collars look indestructible. Cat can't chew through this one.",
    rating: 5,
  },
  {
    title: "MagSafe power bank snaps firmly",
    body: "Holds on tightly to the back of the case. Enough juice for a full day emergency backup.",
    rating: 5,
  },
  {
    title: "Compact & powerful",
    body: "GaN charger is so small compared to my laptop brick yet charges both phone and iPad simultaneously.",
    rating: 5,
  },
  {
    title: "Crystal clear audio & deep bass",
    body: "Earbuds have great noise cancellation for the price. Mic picks up voice clearly on WhatsApp calls.",
    rating: 5,
    adminReply: "Glad the ANC and call clarity are serving you well! 🎵",
  },
  {
    title: "Very convenient",
    body: "Magnetic wireless charging while watching videos in landscape is super handy.",
    rating: 5,
  },
  {
    title: "Solid battery life",
    body: "Lasts almost 6 hours continuous playback on a single charge.",
    rating: 4,
  },
  {
    title: "Premium matte build",
    body: "Doesn't feel cheap or hollow. Has good weight and feels durable.",
    rating: 5,
  },
  {
    title: "Fast delivery on COD",
    body: "Received in Karachi within 24 hours. Sealed original box.",
    rating: 5,
  },
  {
    title: "Works seamlessly with MagSafe cases",
    body: "Magnets align instantly with that satisfying snap sound.",
    rating: 5,
  },
  {
    title: "Paisa wasool gadget",
    body: "Daily essential for my office desk and bedside table.",
    rating: 5,
  },
  {
    title: "Charges cool",
    body: "Doesn't overheat like cheap unbranded chargers in local markets.",
    rating: 5,
  },
  {
    title: "Good soundstage",
    body: "Comfortable ear tips included in box. Doesn't fall out during morning jog.",
    rating: 4,
  },
  {
    title: "Excellent build quality",
    body: "Reinforced aluminum connector housings. Feels built to last years.",
    rating: 5,
  },
  {
    title: "Display is bright and responsive",
    body: "AMOLED screen is easily visible under outdoor sunlight. Notifications sync instantly.",
    rating: 5,
  },
  {
    title: "Top tier wireless charger",
    body: "Supports 15W MagSafe wireless speed. Clean cable management.",
    rating: 5,
  },
  {
    title: "Very happy with purchase",
    body: "Ordered on WhatsApp guidance, arrived exactly as specified.",
    rating: 5,
  },
  {
    title: "High speed data transfer",
    body: "Works for fast file backups from phone to Mac/PC without disconnects.",
    rating: 5,
  },
  {
    title: "Reliable power bank",
    body: "Slim enough to fit in pocket while attached to phone.",
    rating: 4,
  },
  {
    title: "Awesome accessory",
    body: "Must have for anyone using magnetic accessories.",
    rating: 5,
  },
  {
    title: "Great value for money",
    body: "Quality beats high-end retail brands costing double.",
    rating: 5,
  },
  {
    title: "Solid performance",
    body: "No issues so far after 3 weeks of daily use.",
    rating: 4,
  },
];

async function seedReviews() {
  console.log("🌱 Seeding realistic customer reviews for all products...");

  const allProducts = await db
    .select({
      id: s.products.id,
      slug: s.products.slug,
      name: s.products.name,
      material: s.products.material,
      categoryId: s.products.categoryId,
    })
    .from(s.products);

  const categories = await db.select().from(s.categories);
  const catById = new Map(categories.map((c) => [c.id, c]));

  let totalInserted = 0;

  for (const prod of allProducts) {
    const cat = catById.get(prod.categoryId);
    const section = cat?.section ?? "magsafe-cases";

    // Choose relevant pool
    let pool = CASE_REVIEWS;
    if (section === "skins") pool = SKIN_REVIEWS;
    else if (section === "screen-protectors") pool = PROTECTOR_REVIEWS;
    else if (section === "gadgets") pool = GADGET_REVIEWS;

    // Check existing reviews
    const existing = await db
      .select({ id: s.reviews.id })
      .from(s.reviews)
      .where(eq(s.reviews.productId, prod.id));

    // Desired: between 20 and 22 reviews
    // Deterministic target based on product ID so rerunning is consistent
    const targetCount = 20 + (prod.id % 3); // 20, 21, or 22
    const needed = Math.max(0, targetCount - existing.length);

    if (needed > 0) {
      // Shuffle names and pool for this product
      const shuffledNames = [...PAKISTANI_NAMES].sort(
        (a, b) => ((a.charCodeAt(0) + prod.id * 7) % 19) - ((b.charCodeAt(0) + prod.id * 7) % 19)
      );
      const shuffledPool = [...pool].sort(
        (a, b) => ((a.title.length * 13 + prod.id * 5) % 23) - ((b.title.length * 13 + prod.id * 5) % 23)
      );

      const rowsToInsert = [];
      const now = Date.now();

      for (let i = 0; i < needed; i++) {
        const template = shuffledPool[i % shuffledPool.length];
        const reviewerName = shuffledNames[(i + prod.id * 3) % shuffledNames.length];
        // Spread dates over the last 75 days
        const daysAgo = Math.floor(1 + ((i * 3.4 + prod.id * 2.1) % 72));
        const createdAt = new Date(now - daysAgo * 864e5 - (i * 3700e3));

        rowsToInsert.push({
          productId: prod.id,
          name: reviewerName,
          rating: template.rating,
          title: template.title,
          body: template.body,
          verified: true,
          approved: true,
          photos: [],
          adminReply: i % 5 === 0 && template.adminReply ? template.adminReply : null,
          createdAt,
        });
      }

      await db.insert(s.reviews).values(rowsToInsert);
      totalInserted += rowsToInsert.length;
    }

    // Refresh rating average & count on products table
    const [stats] = await db
      .select({
        avgRating: avg(s.reviews.rating),
        totalCount: count(),
      })
      .from(s.reviews)
      .where(and(eq(s.reviews.productId, prod.id), eq(s.reviews.approved, true)));

    const countNum = stats?.totalCount ?? 0;
    const avgNum = stats?.avgRating ? Math.round(Number(stats.avgRating) * 10) / 10 : 0;

    await db
      .update(s.products)
      .set({
        ratingAvg: avgNum,
        ratingCount: countNum,
        updatedAt: new Date(),
      })
      .where(eq(s.products.id, prod.id));

    console.log(`  ✓ ${prod.name} (${prod.slug}): ${countNum} reviews, rating: ${avgNum}★`);
  }

  console.log(`\n🎉 Finished! Seeded ${totalInserted} new reviews across ${allProducts.length} products.`);
  client.close();
}

seedReviews().catch((err) => {
  console.error("Error seeding reviews:", err);
  process.exit(1);
});
