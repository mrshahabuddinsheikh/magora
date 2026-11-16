"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  kind?: "rider" | "home";
}

/** OpenStreetMap + Leaflet (no API key). Loaded only where a live position exists. */
export function LiveMap({ points, height = 260 }: { points: MapPoint[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      layer.current!.clearLayers();
      const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      for (const p of valid) {
        const html =
          p.kind === "home"
            ? `<div style="width:30px;height:30px;border-radius:50%;background:#0b0d12;color:#fff;display:grid;place-items:center;font-size:15px;box-shadow:0 6px 14px rgba(0,0,0,.3)">⌂</div>`
            : `<div style="position:relative;width:38px;height:38px"><span style="position:absolute;inset:0;border-radius:50%;background:rgba(54,83,255,.25);animation:mgpulse 1.8s ease-out infinite"></span><span style="position:absolute;inset:7px;border-radius:50%;background:linear-gradient(180deg,#4a65ff,#2f49f0);border:3px solid #fff;box-shadow:0 6px 14px rgba(54,83,255,.6);display:grid;place-items:center;color:#fff;font-size:12px">🛵</span></div>`;
        L.marker([p.lat, p.lng], { icon: L.divIcon({ html, className: "", iconSize: [38, 38], iconAnchor: [19, 19] }) })
          .bindTooltip(p.label, { direction: "top", offset: [0, -16] })
          .addTo(layer.current!);
      }
      if (valid.length === 1) map.current.setView([valid[0].lat, valid[0].lng], 15);
      else if (valid.length > 1) map.current.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
      else map.current.setView([30.3753, 69.3451], 5); // Pakistan
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <>
      <style>{`@keyframes mgpulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.8);opacity:0}}`}</style>
      <div ref={el} style={{ height }} className="isolate z-0 w-full overflow-hidden rounded-[20px] border border-white/80 bg-[#e9ecf2]" />
    </>
  );
}
