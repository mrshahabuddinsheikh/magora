"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { ProductThumb } from "../CaseThumb";
import type { ViewerProps } from "./PhoneCaseViewer";
import type { GadgetViewerProps } from "./GadgetViewer";
import { GadgetThumb } from "../GadgetThumb";
import { layoutOf } from "@/lib/layout";

const Viewer = lazy(() => import("./PhoneCaseViewer"));

/** Instant SVG poster in the case colour while the three.js bundle streams in. */
function Poster(p: ViewerProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <ProductThumb
        material={p.material}
        color={p.color}
        accent={p.accent}
        imageUrl={p.imageUrl}
        design={p.design}
        phoneHex={p.spec.bodyHex}
        layout={layoutOf(p.spec.camera, p.spec.widthMm)}
        className="h-[72%] w-auto animate-pulse"
      />
    </div>
  );
}

export function LazyViewer(props: ViewerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // start loading 3D right after first paint, without blocking it
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!mounted) return <Poster {...props} />;
  return (
    <Suspense fallback={<Poster {...props} />}>
      <Viewer {...props} />
    </Suspense>
  );
}

/* ───────── gadgets ───────── */

const Gadget = lazy(() => import("./GadgetViewer"));

export function LazyGadgetViewer(props: GadgetViewerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const poster = (
    <div className="flex h-full w-full items-center justify-center">
      <GadgetThumb material={props.material} color={props.color} accent={props.accent} className="h-[62%] w-auto animate-pulse" />
    </div>
  );
  if (!mounted) return poster;
  return (
    <Suspense fallback={poster}>
      <Gadget {...props} />
    </Suspense>
  );
}
