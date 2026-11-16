import type { Metadata } from "next";
import { Banknote, Box, Crosshair, Eye, Fingerprint, RotateCcw, ShieldCheck, Smartphone, Truck } from "lucide-react";
import { PhoneSectionHome } from "@/components/home/PhoneSectionHome";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Screen Protectors — 9H Tempered, Privacy & Matte Glass",
  description: "9H tempered glass, privacy and matte screen protectors plus camera lens guards for iPhone, Samsung and Pixel. Alignment frame included. Cash on delivery.",
  alternates: { canonical: "/screen-protectors" },
};

export default function ProtectorsHome() {
  return (
    <PhoneSectionHome
      section={CATEGORIES[2]}
      copy={{
        eyebrow: "9H tempered glass · alignment frame included",
        h1: ["Drop it.", "Not the screen."],
        intro: "Tempered, privacy and matte glass cut for your exact iPhone, Samsung or Pixel — plus lens guards for the camera. Bubble-free install in seconds, pay cash on delivery.",
        pills: [
          [Banknote, "Cash on Delivery"],
          [ShieldCheck, "9H hardness"],
          [Crosshair, "Alignment frame"],
        ],
        steps: [
          [Smartphone, "Pick your phone", "Every protector is cut for one model so it covers edge to edge, with the right sensor cut-outs."],
          [Box, "Choose your glass", "Clear, privacy or matte — single or 2-pack. Add a lens guard for the camera."],
          [Truck, "Pay on delivery", "No advance payment. It arrives in 2–4 days with an alignment frame and wipes."],
        ],
        quality: {
          accent: "Protection",
          title: "you can’t see",
          items: [
            [ShieldCheck, "9H glass", "Scratch & drop resistant"],
            [Fingerprint, "Oleophobic", "Fewer fingerprints"],
            [Eye, "HD clarity", "Full touch & Face ID"],
            [RotateCcw, "7-day exchange", "Wrong model? No problem"],
          ],
        },
        faq: [
          ["Will it fit my exact phone?", "Yes. Each protector is cut for one specific model. Pick your phone on the product page."],
          ["Does it work with Face ID and the fingerprint sensor?", "Yes — 100% touch sensitivity, and Face ID / in-screen fingerprint sensors keep working."],
          ["What does the privacy glass do?", "The screen looks dark from the sides but clear from the front, so people next to you can’t read it."],
          ["Is it case friendly?", "Yes. The glass sits just inside the curved edges so it works with our MagSafe cases and most others."],
          ["How do I install it?", "Clean the screen with the wipes, place the alignment frame on your phone and drop the glass in. Takes about a minute."],
        ],
        cta: { title: "Protect what you paid for.", text: "Pick your model — the right glass arrives in 2–4 days, pay cash at your door.", label: "Shop all protectors" },
      }}
    />
  );
}
