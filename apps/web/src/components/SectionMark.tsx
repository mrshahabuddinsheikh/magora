"use client";
import { useEffect } from "react";
import { useSection } from "@/stores/section";
import type { CategorySlug } from "@/lib/types";

/** Drop on a page to switch the whole storefront chrome to that section. */
export function SectionMark({ section }: { section: CategorySlug }) {
  const set = useSection((s) => s.setSection);
  useEffect(() => {
    set(section);
  }, [section, set]);
  return null;
}
