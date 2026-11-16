import type { Metadata } from "next";
import { Box, Brush, Banknote, ImagePlus, Layers, RotateCcw, Scissors, Smartphone } from "lucide-react";
import { PhoneSectionHome } from "@/components/home/PhoneSectionHome";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Phone Skins & Custom Photo Skins — iPhone, Samsung, Pixel",
  description: "Laser-cut vinyl skins for the back and sides of your phone — matte, carbon, marble, wood, metal or your own photo. See it in 3D, pay cash on delivery.",
  alternates: { canonical: "/skins" },
};

export default function SkinsHome() {
  return (
    <PhoneSectionHome
      section={CATEGORIES[1]}
      copy={{
        eyebrow: "New · Print your own photo on a skin",
        h1: ["Make it yours.", "Skin it."],
        intro: "Laser-cut vinyl skins for iPhone, Samsung & Pixel — matte, carbon, marble, wood, metal or your own photo. Spin it on your exact phone in 3D, pay cash when it arrives.",
        pills: [
          [Banknote, "Cash on Delivery"],
          [Layers, "Back or back + sides"],
          [ImagePlus, "Your own photo"],
        ],
        steps: [
          [Smartphone, "Pick your phone", "Every skin is cut for one exact model — camera cut-out included."],
          [Box, "See it in 3D", "Switch designs, choose back only or back + sides, or upload your photo and check it on the phone."],
          [Banknote, "Pay on delivery", "No advance payment. Your skin arrives in 2–4 days (custom photos are printed in 2–3)."],
        ],
        quality: {
          accent: "Thin, tough,",
          title: "bubble-free",
          items: [
            [Scissors, "Laser-cut", "Exact fit for your model"],
            [Layers, "Air-release vinyl", "No bubbles, no residue"],
            [Brush, "HD print", "Sharp, fade-resistant colour"],
            [RotateCcw, "7-day exchange", "Wrong model? No problem"],
          ],
        },
        faq: [
          ["Will the skin fit my exact phone?", "Yes. Each skin is laser-cut for one specific model, including the camera cut-out. Pick your phone on the product page to see it in 3D."],
          ["What’s the difference between back only and back + sides?", "Back only covers the back panel. Back + sides also wraps the frame edges for a full look and a little extra grip (+Rs.300)."],
          ["How does the custom photo skin work?", "Upload your photo on the product page, check it on your phone in 3D and order. We print it in HD and cut it for your model in 2–3 days."],
          ["Can I use a skin with a case?", "Yes — skins are only 0.2 mm thick and work under most cases, including our MagSafe cases."],
          ["Will it leave marks when I remove it?", "No. The air-release adhesive peels off cleanly without residue."],
        ],
        cta: { title: "Your phone, your style.", text: "Pick your model and try every design in 3D — it takes 10 seconds.", label: "Shop all skins" },
      }}
    />
  );
}
