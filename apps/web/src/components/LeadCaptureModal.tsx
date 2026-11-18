"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Gift, Sparkles, X, MessageCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { WHATSAPP } from "@/lib/config";

const POPULAR_MODELS = [
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 15 Pro Max",
  "Galaxy S25 Ultra",
  "Galaxy S24 Ultra",
  "iPhone 14 Pro Max",
  "Google Pixel 9 Pro",
  "Other Model",
];

export function LeadCaptureModal() {
  return null;
}
