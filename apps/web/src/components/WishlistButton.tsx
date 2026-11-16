"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/format";

export function WishlistButton({ productId }: { productId: number }) {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ data: { id: number }[] }>("/me/wishlist")
      .then((r) => setOn(r.data.some((p) => p.id === productId)))
      .catch(() => {});
  }, [user, productId]);

  return (
    <button
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={on}
      onClick={async () => {
        if (!user) return router.push(`/account?next=${encodeURIComponent(location.pathname)}`);
        setOn(!on);
        await api(`/me/wishlist/${productId}`, { method: on ? "DELETE" : "PUT" }).catch(() => setOn(on));
      }}
      className={cn("grid h-10 w-10 place-items-center rounded-full border transition", on ? "border-[#ffd0de] bg-[#ffe4ef] text-[#e11d74]" : "border-black/10 bg-white/80 text-muted hover:text-[#e11d74]")}
    >
      <Heart size={18} className={on ? "fill-current" : ""} />
    </button>
  );
}
