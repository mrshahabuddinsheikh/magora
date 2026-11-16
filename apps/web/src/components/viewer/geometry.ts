import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CameraSpec, Lens, PhoneButton, PhoneDetails, PhoneSpec } from "@/lib/types";

/**
 * Procedural phone + case geometry, built from real dimensions in millimetres.
 * Nothing is downloaded: a new phone model only needs its size & camera layout.
 *
 * Coordinate system: the BACK of the phone faces +Z (towards the default camera),
 * the screen faces −Z. Camera positions in the spec are measured on the back,
 * from its top-left corner as you look at it.
 */

export function roundedRect(w: number, h: number, r: number, cx?: number, cy?: number): THREE.Shape;
export function roundedRect<T extends THREE.Path>(w: number, h: number, r: number, cx: number, cy: number, path: T): T;
export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0, path: THREE.Path = new THREE.Shape()) {
  const rr = Math.max(0.01, Math.min(r, w / 2, h / 2));
  const x = cx - w / 2;
  const y = cy - h / 2;
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - rr);
  path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x + rr, y + h);
  path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + rr);
  path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

const holeRect = (w: number, h: number, r: number, cx: number, cy: number) => roundedRect(w, h, r, cx, cy, new THREE.Path());

const holeCircle = (cx: number, cy: number, r: number) => {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
};

/** spec mm (from back top-left) → centred world mm */
export const toWorld = (spec: PhoneSpec, x: number, y: number) => ({
  x: -spec.widthMm / 2 + x,
  y: spec.heightMm / 2 - y,
});

/** Extrude a shape so it spans exactly z0 → z0+depth, with a soft bevel. */
export function extrudeBetween(shape: THREE.Shape, z0: number, depth: number, bevel: number, curveSegments = 24) {
  const b = Math.min(bevel, depth / 2 - 0.01);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - 2 * b),
    bevelEnabled: b > 0.02,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments,
  });
  geo.translate(0, 0, z0 + b);
  return geo;
}

export interface Cutout { kind: "rect"; cx: number; cy: number; w: number; h: number; r: number }
export interface CircleCut { kind: "circle"; cx: number; cy: number; r: number }

/** Where the case must be open around the camera. */
export function cameraCutouts(spec: PhoneSpec): (Cutout | CircleCut)[] {
  const cam = spec.camera;
  const m = 1.4; // clearance margin
  if (cam.cutout) {
    const c = toWorld(spec, cam.cutout.x + cam.cutout.w / 2, cam.cutout.y + cam.cutout.h / 2);
    return [{ kind: "rect", cx: c.x, cy: c.y, w: cam.cutout.w, h: cam.cutout.h, r: cam.cutout.r }];
  }
  if (cam.type === "plateau" || cam.type === "bar") {
    const c = toWorld(spec, cam.x! + cam.w! / 2, cam.y! + cam.h! / 2);
    return [{ kind: "rect", cx: c.x, cy: c.y, w: cam.w! + m * 2, h: cam.h! + m * 2, r: (cam.r ?? 8) + m }];
  }
  return cam.lenses.map((l) => {
    const c = toWorld(spec, l.x, l.y);
    return { kind: "circle", cx: c.x, cy: c.y, r: l.d / 2 + (l.kind && l.kind !== "lens" ? 0.8 : 1.1) };
  });
}

/**
 * A rounded-rect ring with a gap in the middle of its bottom edge — a single
 * C-shaped outline (outer edge one way, inner edge back), so it extrudes cleanly.
 */
export function ringWithBottomGap(W: number, H: number, R: number, w: number, h: number, r: number, g: number) {
  const s = new THREE.Shape();
  const P = Math.PI;
  s.moveTo(g, -H / 2);
  s.lineTo(W / 2 - R, -H / 2);
  s.absarc(W / 2 - R, -H / 2 + R, R, -P / 2, 0, false);
  s.lineTo(W / 2, H / 2 - R);
  s.absarc(W / 2 - R, H / 2 - R, R, 0, P / 2, false);
  s.lineTo(-W / 2 + R, H / 2);
  s.absarc(-W / 2 + R, H / 2 - R, R, P / 2, P, false);
  s.lineTo(-W / 2, -H / 2 + R);
  s.absarc(-W / 2 + R, -H / 2 + R, R, P, P * 1.5, false);
  s.lineTo(-g, -H / 2);
  s.lineTo(-g, -h / 2);
  s.lineTo(-w / 2 + r, -h / 2);
  s.absarc(-w / 2 + r, -h / 2 + r, r, P * 1.5, P, true);
  s.lineTo(-w / 2, h / 2 - r);
  s.absarc(-w / 2 + r, h / 2 - r, r, P, P / 2, true);
  s.lineTo(w / 2 - r, h / 2);
  s.absarc(w / 2 - r, h / 2 - r, r, P / 2, 0, true);
  s.lineTo(w / 2, -h / 2 + r);
  s.absarc(w / 2 - r, -h / 2 + r, r, 0, -P / 2, true);
  s.lineTo(g, -h / 2);
  s.closePath();
  return s;
}

export interface CaseDims {
  t: number; // side wall thickness
  back: number; // back plate thickness
  lip: number; // front lip beyond screen
  W: number;
  H: number;
  R: number;
}

export function caseDims(spec: PhoneSpec, thin = false): CaseDims {
  const t = thin ? 0.9 : 1.4;
  return {
    t,
    back: thin ? 0.8 : 1.3,
    lip: thin ? 0.5 : 0.9,
    W: spec.widthMm + 2 * t,
    H: spec.heightMm + 2 * t,
    R: spec.cornerRadiusMm + t,
  };
}

/** All case meshes' geometries. */
export function buildCaseGeometries(spec: PhoneSpec, thin = false) {
  const D = spec.depthMm;
  const d = caseDims(spec, thin);
  const cuts = cameraCutouts(spec);

  // side wall: a ring around the phone with a gap along the bottom edge…
  const inW = spec.widthMm + 1.25,
    inH = spec.heightMm + 1.25,
    inR = spec.cornerRadiusMm + 0.55; // + bevel compensation
  const gap = Math.max(8, Math.min(d.W / 2 - d.R - 1.2, inW / 2 - inR - 0.6, 27));
  const wallGeo = extrudeBetween(ringWithBottomGap(d.W, d.H, d.R, inW, inH, inR, gap), -D / 2 - d.lip, D + d.lip, 0.55, 40);

  // …filled by a plate that has the opening for USB-C, speaker and mic
  const z0 = -D / 2 - d.lip + 0.15,
    z1 = D / 2 - 0.15;
  const plate = new THREE.Shape();
  plate.moveTo(-gap - 0.3, -z1);
  plate.lineTo(gap + 0.3, -z1);
  plate.lineTo(gap + 0.3, -z0);
  plate.lineTo(-gap - 0.3, -z0);
  plate.closePath();
  const slotH = Math.min(D * 0.55, 4.6);
  const slotW = gap * 2 - 5;
  plate.holes.push(holeRect(slotW, slotH, slotH / 2, 0, 0));
  const bottomGeo = new THREE.ExtrudeGeometry(plate, { depth: (d.H - inH) / 2 + 0.05, bevelEnabled: false, curveSegments: 16 });
  bottomGeo.rotateX(-Math.PI / 2); // shape y → −z, extrusion → +y
  bottomGeo.translate(0, -d.H / 2, 0);

  // front lip that curls over the screen edge
  const lip = roundedRect(d.W, d.H, d.R);
  lip.holes.push(holeRect(spec.widthMm - 1.1, spec.heightMm - 1.1, spec.cornerRadiusMm - 0.5, 0, 0));
  const lipGeo = extrudeBetween(lip, -D / 2 - d.lip - 0.01, 0.6, 0.25);

  // back plate with camera opening(s)
  const back = roundedRect(d.W, d.H, d.R);
  for (const c of cuts) back.holes.push(c.kind === "rect" ? holeRect(c.w, c.h, c.r, c.cx, c.cy) : holeCircle(c.cx, c.cy, c.r));
  const backGeo = extrudeBetween(back, D / 2, d.back, 0.6, 32);

  // raised camera bezel — protects lenses when the phone lies flat
  const bezelShapes: THREE.Shape[] = [];
  for (const c of cuts) {
    const g = 1.3;
    if (c.kind === "rect") {
      const s = roundedRect(c.w + g * 2, c.h + g * 2, c.r + g, c.cx, c.cy);
      s.holes.push(holeRect(c.w, c.h, c.r, c.cx, c.cy));
      bezelShapes.push(s);
    } else {
      const s = new THREE.Shape();
      s.absarc(c.cx, c.cy, c.r + (c.r > 4 ? 1.1 : 0.7), 0, Math.PI * 2, false);
      s.holes.push(holeCircle(c.cx, c.cy, c.r));
      bezelShapes.push(s);
    }
  }
  const bezelRise = (spec.camera.rise ?? 1.4) + 0.4;
  const bezelGeos = bezelShapes.map((s) => extrudeBetween(s, D / 2 + d.back - 0.2, bezelRise + 0.2, 0.35, 32));

  // MagSafe ring (Ø ~55 mm) + orientation notch: centred, or lower when a big camera island needs the room
  const camBottom = Math.min(...cuts.map((c) => (c.kind === "rect" ? c.cy - c.h / 2 : c.cy - c.r))) - 1.6;
  const ringY = Math.min(0, camBottom - 3 - 27.6);
  const ringZ = D / 2 + d.back + 0.03;
  const ringGeo = new THREE.RingGeometry(23.2, 27.6, 96);
  ringGeo.translate(0, ringY, ringZ);
  const notchGeo = new THREE.PlaneGeometry(3.4, 8);
  notchGeo.translate(0, ringY - 27.6 - 5.5, ringZ);
  const ringOutline = new THREE.RingGeometry(27.1, 27.6, 96);
  ringOutline.translate(0, ringY, ringZ);

  return { wallGeo, bottomGeo, lipGeo, backGeo, bezelGeos, ringGeo, notchGeo, ringOutline, dims: d, backSurfaceZ: D / 2 + d.back };
}

/** Edge bevel of the phone frame — modern flagships have flat sides with a small round-over. */
export const frameBevel = (spec: PhoneSpec) => Math.min(spec.depthMm * 0.2, 1.3);

/** Phone body pieces. */
export function buildPhoneGeometries(spec: PhoneSpec) {
  const { widthMm: W, heightMm: H, depthMm: D, cornerRadiusMm: R } = spec;
  const b = frameBevel(spec);
  const body = roundedRect(W - 2 * b, H - 2 * b, Math.max(1, R - b));
  const frameGeo = new THREE.ExtrudeGeometry(body, {
    depth: D - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 6,
    curveSegments: 40,
  });
  frameGeo.translate(0, 0, -D / 2 + b);

  const backGlass = new THREE.ShapeGeometry(roundedRect(W - 1.4, H - 1.4, R - 0.7), 40);
  backGlass.translate(0, 0, D / 2 + 0.02);

  // front: black cover glass edge to edge, the lit display inset by a thin bezel
  const coverGlass = new THREE.ShapeGeometry(roundedRect(W - 0.8, H - 0.8, R - 0.4), 40);
  coverGlass.rotateY(Math.PI);
  coverGlass.translate(0, 0, -D / 2 - 0.02);
  const bz = 1.35;
  const screen = new THREE.ShapeGeometry(roundedRect(W - 0.8 - bz * 2, H - 0.8 - bz * 2, R - 0.4 - bz * 0.8), 40);
  remapUV(screen, W - 0.8 - bz * 2, H - 0.8 - bz * 2);
  screen.rotateY(Math.PI);
  screen.translate(0, 0, -D / 2 - 0.035);

  return { frameGeo, backGlass, coverGlass, screen };
}

/** Defaults when an older API doesn't send details */
export function detailsOf(spec: PhoneSpec, brand: string): PhoneDetails {
  if (spec.details) return spec.details;
  const H = spec.heightMm;
  const apple = brand === "apple";
  return {
    buttons: apple
      ? [
          { side: "left", y: H * 0.205, len: 7, kind: "action" },
          { side: "left", y: H * 0.29, len: 11, kind: "volume" },
          { side: "left", y: H * 0.38, len: 11, kind: "volume" },
          { side: "right", y: H * 0.31, len: 17, kind: "power" },
        ]
      : [
          { side: "right", y: H * 0.26, len: 20, kind: "volume" },
          { side: "right", y: H * 0.4, len: 11, kind: "power" },
        ],
    bottom: apple ? { speaker: "both", sim: "none" } : { speaker: "right", sim: "left" },
    top: apple ? {} : { mic: true },
    frontCam: apple ? "island" : "punch",
  };
}

/** x of a side ("left"/"right" as seen from the screen) — the screen faces −Z, so its right is −X */
export const sideX = (side: PhoneButton["side"], halfW: number) => (side === "right" ? -halfW : halfW);

/**
 * Small details on the frame: USB-C, speaker & mic holes, SIM tray, IR blaster
 * and antenna lines. Everything of one material is merged into a single
 * geometry, so all the detail costs only a few draw calls.
 */
export function buildPortGeometries(spec: PhoneSpec, det: PhoneDetails) {
  const { widthMm: W, heightMm: H, depthMm: D, cornerRadiusMm: R } = spec;
  const b = frameBevel(spec);
  const flat = D - 2 * b; // flat band of the frame
  const straight = W / 2 - R; // straight part of top/bottom edges
  const holes: THREE.BufferGeometry[] = [];
  const lines: THREE.BufferGeometry[] = [];

  // flat shapes on the bottom (normal −Y) or top (normal +Y) edge; shape x → x, shape y → depth
  const onEdge = (shape: THREE.Shape | THREE.Shape[], edge: "bottom" | "top", list: THREE.BufferGeometry[]) => {
    const g = new THREE.ShapeGeometry(shape, 16);
    g.rotateX(edge === "bottom" ? Math.PI / 2 : -Math.PI / 2);
    g.translate(0, edge === "bottom" ? -H / 2 - 0.03 : H / 2 + 0.03, 0);
    list.push(g);
  };
  const circle = (x: number, r: number, y = 0) => {
    const c = new THREE.Shape();
    c.absarc(x, y, r, 0, Math.PI * 2, false);
    return c;
  };

  // USB-C
  const usbX = det.bottom.usbOffset ?? 0;
  onEdge(roundedRect(8.6, Math.min(3.0, flat * 0.7), 1.45, usbX, 0), "bottom", holes);

  // speaker / mic grilles
  const grille = (dir: 1 | -1, count: number) => {
    const out: THREE.Shape[] = [];
    for (let i = 0; i < count; i++) out.push(circle(dir * (9.8 + i * 1.75), 0.62));
    return out;
  };
  const room = Math.max(2, Math.min(7, Math.floor((straight - 11) / 1.75) + 1));
  const sp = det.bottom.speaker ?? "right";
  // "right" as seen from the screen is −X
  if (sp === "both") {
    onEdge(grille(1, room), "bottom", holes);
    onEdge(grille(-1, room), "bottom", holes);
  } else {
    const dir = sp === "right" ? -1 : 1;
    onEdge(grille(dir, room), "bottom", holes);
    onEdge(circle(-dir * 7.4, 0.6), "bottom", holes); // mic on the other side
  }

  // SIM tray: outline + eject pin hole
  if (det.bottom.sim && det.bottom.sim !== "none") {
    const dir = det.bottom.sim === "right" ? -1 : 1;
    const cx = dir * Math.min(straight - 9, 21);
    const tray = roundedRect(15, Math.min(2.6, flat * 0.6), 1.2, cx, 0);
    tray.holes.push(holeRect(14.4, Math.min(2.0, flat * 0.6 - 0.6), 0.9, cx, 0));
    onEdge(tray, "bottom", lines);
    onEdge(circle(cx - dir * 9.6, 0.45), "bottom", holes);
  }

  // top edge
  if (det.top.mic) onEdge(circle(-5.5, 0.55), "top", holes);
  if (det.top.ir) {
    const ir = new THREE.Shape();
    ir.absellipse(7, 0, 1.6, 1.05, 0, Math.PI * 2, false, 0);
    onEdge(ir, "top", holes);
  }
  if (det.top.speaker) onEdge(roundedRect(9, 0.9, 0.45, 0, 0), "top", holes);

  // antenna lines: two on each long side, one near each end of top & bottom
  const sideStrip = (x: number, y: number) => {
    const g = new THREE.PlaneGeometry(flat, 0.75);
    g.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(x > 0 ? x + 0.03 : x - 0.03, y, 0);
    lines.push(g);
  };
  for (const side of [1, -1]) {
    sideStrip(side * (W / 2), H / 2 - R - 5);
    sideStrip(side * (W / 2), -H / 2 + R + 5);
  }
  for (const side of [1, -1]) {
    onEdge(roundedRect(0.75, flat, 0.01, side * (straight - 1.6), 0), "top", lines);
    onEdge(roundedRect(0.75, flat, 0.01, side * (straight - 1.6), 0), "bottom", lines);
  }

  return {
    holes: mergeGeometries(holes.map(clean)),
    lines: mergeGeometries(lines.map(clean)),
  };
}

/** keep only position + normal so mixed geometries can be merged */
function clean(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k);
  return n;
}

/** True for round camera islands (vivo X, OPPO Find X, Xiaomi Ultra, OnePlus 13). */
export const isRoundIsland = (cam: CameraSpec) => cam.type === "plateau" && !!cam.w && !!cam.r && cam.r >= cam.w / 2 - 0.5;

let lensTex: THREE.CanvasTexture | null = null;
/** Lens glass: deep blue-violet coating with concentric element reflections. */
export function lensTexture() {
  if (lensTex) return lensTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const bg = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  bg.addColorStop(0, "#0b0f22");
  bg.addColorStop(0.55, "#06070d");
  bg.addColorStop(0.8, "#151a33");
  bg.addColorStop(1, "#05060a");
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  for (const [r, a] of [[96, 0.22], [70, 0.16], [44, 0.2], [24, 0.3]] as const) {
    g.strokeStyle = `rgba(120,140,255,${a})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(128, 128, r, 0, Math.PI * 2);
    g.stroke();
  }
  // coating reflections
  const hl = g.createRadialGradient(92, 86, 2, 92, 86, 46);
  hl.addColorStop(0, "rgba(190,170,255,0.75)");
  hl.addColorStop(1, "rgba(120,90,255,0)");
  g.fillStyle = hl;
  g.fillRect(0, 0, 256, 256);
  const hl2 = g.createRadialGradient(170, 172, 1, 170, 172, 24);
  hl2.addColorStop(0, "rgba(90,220,200,0.55)");
  hl2.addColorStop(1, "rgba(90,220,200,0)");
  g.fillStyle = hl2;
  g.fillRect(0, 0, 256, 256);
  lensTex = new THREE.CanvasTexture(c);
  lensTex.colorSpace = THREE.SRGBColorSpace;
  return lensTex;
}

/** Normalise ShapeGeometry UVs (which are in mm) into 0..1 */
export function remapUV(geo: THREE.BufferGeometry, w: number, h: number) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

/** Camera island (plateau / bar) geometry, sits on the phone's back */
export function buildIsland(spec: PhoneSpec) {
  const cam = spec.camera;
  if (cam.type === "floating") return null;
  const c = toWorld(spec, cam.x! + cam.w! / 2, cam.y! + cam.h! / 2);
  const s = roundedRect(cam.w!, cam.h!, cam.r ?? 8, c.x, c.y);
  const round = isRoundIsland(cam);
  return extrudeBetween(s, spec.depthMm / 2, cam.rise ?? 1.4, round ? 0.8 : 0.5, round ? 72 : 40);
}

export function lensBaseZ(spec: PhoneSpec) {
  const cam: CameraSpec = spec.camera;
  return spec.depthMm / 2 + (cam.type === "floating" ? 0 : cam.rise ?? 1.4);
}

export function lensWorld(spec: PhoneSpec, l: Lens) {
  return toWorld(spec, l.x, l.y);
}

/* ───────── procedural textures (no image downloads) ───────── */

let carbonTex: THREE.CanvasTexture | null = null;
export function carbonTexture() {
  if (carbonTex) return carbonTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const cell = 32;
  for (let y = 0; y < 256; y += cell) {
    for (let x = 0; x < 256; x += cell) {
      const twill = ((x / cell + y / cell) % 2) === 0;
      const grad = twill ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell);
      grad.addColorStop(0, "#5a5a5a");
      grad.addColorStop(0.5, "#ffffff");
      grad.addColorStop(1, "#4a4a4a");
      g.fillStyle = grad;
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }
  carbonTex = new THREE.CanvasTexture(c);
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(1 / 26, 1 / 26);
  carbonTex.anisotropy = 4;
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  return carbonTex;
}

let grainTex: THREE.CanvasTexture | null = null;
export function leatherGrain() {
  if (grainTex) return grainTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 1 + Math.random() * 3.2;
    const v = 90 + Math.random() * 110;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set(1 / 22, 1 / 22);
  return grainTex;
}

let screenTex: THREE.CanvasTexture | null = null;
export function lockScreenTexture() {
  if (screenTex) return screenTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 512, 1024);
  bg.addColorStop(0, "#1b1f4b");
  bg.addColorStop(0.55, "#5b2a86");
  bg.addColorStop(1, "#f0773c");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.textAlign = "center";
  g.font = "600 34px -apple-system, Segoe UI, sans-serif";
  g.fillText("Thursday, 12 November", 256, 190);
  g.font = "700 150px -apple-system, Segoe UI, sans-serif";
  g.fillText("9:41", 256, 340);
  screenTex = new THREE.CanvasTexture(c);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  return screenTex;
}

/* ───────── skins & screen protectors ───────── */

export type ViewMode = "case" | "skin" | "protector";
export const viewModeOf = (material: string): ViewMode =>
  material.startsWith("skin-") ? "skin" : material.startsWith("glass-") || material === "lens" ? "protector" : "case";

/** Skin geometry: a thin vinyl sheet on the back (camera cut-outs) and, optionally, a band around the sides. */
export function buildSkinGeometries(spec: PhoneSpec, sides: boolean) {
  const { widthMm: W, heightMm: H, depthMm: D, cornerRadiusMm: R } = spec;
  const back = roundedRect(W - 0.9, H - 0.9, R - 0.45);
  const cam = spec.camera;
  if (cam.type === "floating") {
    for (const l of cam.lenses) {
      const c = toWorld(spec, l.x, l.y);
      back.holes.push(holeCircle(c.x, c.y, l.d / 2 + (l.kind && l.kind !== "lens" ? 0.5 : 0.7)));
    }
  } else {
    const c = toWorld(spec, cam.x! + cam.w! / 2, cam.y! + cam.h! / 2);
    const m = 0.7;
    // bar islands that touch the edges are cut as a band
    back.holes.push(holeRect(Math.min(cam.w! + m * 2, W - 2.2), cam.h! + m * 2, (cam.r ?? 8) + m, c.x, c.y));
  }
  const backGeo = new THREE.ExtrudeGeometry(back, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 32 });
  backGeo.translate(0, 0, D / 2 + 0.06);

  let sideGeo: THREE.ExtrudeGeometry | null = null;
  if (sides) {
    // open at the bottom so USB-C, speaker & mic stay uncovered
    const ring = ringWithBottomGap(W + 0.5, H + 0.5, R + 0.25, W - 0.1, H - 0.1, R, Math.min(W / 2 - R - 1, 26));
    sideGeo = new THREE.ExtrudeGeometry(ring, { depth: Math.max(1, D - 2.6), bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.12, bevelSegments: 2, curveSegments: 32 });
    sideGeo.translate(0, 0, -(D - 2.6) / 2);
  }
  return { backGeo, sideGeo, W: W - 0.9, H: H - 0.9 };
}

/** Front glass protector */
export function buildProtectorGeometry(spec: PhoneSpec) {
  const { widthMm: W, heightMm: H, depthMm: D, cornerRadiusMm: R } = spec;
  const g = new THREE.ExtrudeGeometry(roundedRect(W - 1.8, H - 1.8, R - 0.9), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.25, bevelSegments: 3, curveSegments: 32 });
  g.translate(0, 0, -D / 2 - 0.6);
  return g;
}

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 512, repeatMm = 40) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / repeatMm, 1 / repeatMm);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const texCache = new Map<string, THREE.Texture>();
const cachedTex = (key: string, make: () => THREE.Texture) => {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key)!;
};

export const marbleTexture = (base: string, vein: string) =>
  cachedTex(`marble${base}${vein}`, () =>
    canvasTex((g, s) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      // soft clouds
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * s, y = Math.random() * s, r = 40 + Math.random() * 120;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, vein + "22");
        gr.addColorStop(1, vein + "00");
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // veins
      g.strokeStyle = vein;
      for (let v = 0; v < 9; v++) {
        g.globalAlpha = 0.25 + Math.random() * 0.5;
        g.lineWidth = 0.6 + Math.random() * 2.2;
        g.beginPath();
        let x = Math.random() * s, y = 0;
        g.moveTo(x, y);
        while (y < s) {
          x += (Math.random() - 0.5) * 60;
          y += 20 + Math.random() * 40;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }, 512, 70),
  );

export const woodTexture = (base: string) =>
  cachedTex(`wood${base}`, () =>
    canvasTex((g, s) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 140; i++) {
        const y = Math.random() * s;
        g.strokeStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.08)";
        g.lineWidth = 0.5 + Math.random() * 2.5;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin((x + i * 13) / 40) * 6);
        g.stroke();
      }
    }, 512, 55),
  );

export const brushedTexture = () =>
  cachedTex("brushed", () =>
    canvasTex((g, s) => {
      g.fillStyle = "#bfbfbf";
      g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        const v = 170 + Math.random() * 70;
        g.fillStyle = `rgba(${v},${v},${v},0.55)`;
        g.fillRect(0, y, s, 1);
      }
    }, 512, 30),
  );

export const photoPlaceholder = () =>
  cachedTex("photo-ph", () => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1024;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 512, 1024);
    gr.addColorStop(0, "#c7d2fe");
    gr.addColorStop(0.5, "#f5d0fe");
    gr.addColorStop(1, "#fecdd3");
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 1024);
    g.strokeStyle = "rgba(15,23,42,0.35)";
    g.setLineDash([18, 14]);
    g.lineWidth = 6;
    g.strokeRect(40, 260, 432, 500);
    g.fillStyle = "rgba(15,23,42,0.6)";
    g.textAlign = "center";
    g.font = "700 54px -apple-system, Segoe UI, sans-serif";
    g.fillText("Your photo", 256, 520);
    g.font = "500 30px -apple-system, Segoe UI, sans-serif";
    g.fillText("upload to preview", 256, 570);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

/** Fit an image texture over the back like CSS object-fit: cover (UVs are in mm, centred). */
export function coverFit(tex: THREE.Texture, w: number, h: number, imgAspect: number) {
  const back = w / h;
  let tw = w, th = h;
  if (imgAspect > back) tw = h * imgAspect;
  else th = w / imgAspect;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / tw, 1 / th);
  tex.offset.set(0.5, 0.5);
  tex.needsUpdate = true;
}

/* ───────── print layer: a design drawn on the case / skin back ───────── */

export type DesignFit = "cover" | "contain" | "logo";

/**
 * Flat surface that follows the back outline (camera opening cut out) a hair
 * above the case or skin, UVs 0..1 across the whole back.
 */
export function buildPrintGeometry(spec: PhoneSpec, kind: "case" | "skin", thin = false) {
  if (kind === "case") {
    const d = caseDims(spec, thin);
    const w = d.W - 1.2,
      h = d.H - 1.2;
    const shape = roundedRect(w, h, d.R - 0.6);
    for (const c of cameraCutouts(spec)) {
      const g = 1.6; // keep the print off the raised camera bezel
      shape.holes.push(c.kind === "rect" ? holeRect(c.w + g * 2, c.h + g * 2, c.r + g, c.cx, c.cy) : holeCircle(c.cx, c.cy, c.r + g));
    }
    const geo = new THREE.ShapeGeometry(shape, 40);
    remapUV(geo, w, h);
    geo.translate(0, 0, spec.depthMm / 2 + d.back + 0.02);
    return { geo, w, h };
  }
  const { widthMm: W, heightMm: H, depthMm: D, cornerRadiusMm: R } = spec;
  const w = W - 0.9,
    h = H - 0.9;
  const shape = roundedRect(w, h, R - 0.45);
  const cam = spec.camera;
  if (cam.type === "floating") {
    for (const l of cam.lenses) {
      const c = toWorld(spec, l.x, l.y);
      shape.holes.push(holeCircle(c.x, c.y, l.d / 2 + (l.kind && l.kind !== "lens" ? 0.5 : 0.7)));
    }
  } else {
    const c = toWorld(spec, cam.x! + cam.w! / 2, cam.y! + cam.h! / 2);
    shape.holes.push(holeRect(Math.min(cam.w! + 1.4, W - 2.2), cam.h! + 1.4, (cam.r ?? 8) + 0.7, c.x, c.y));
  }
  const geo = new THREE.ShapeGeometry(shape, 40);
  remapUV(geo, w, h);
  geo.translate(0, 0, D / 2 + 0.36);
  return { geo, w, h };
}

/**
 * Lays an image out on a canvas shaped like the phone back, so one texture
 * handles every fit: cover (fills the back), contain (whole design visible)
 * or logo (a smaller print centred on the MagSafe ring area).
 */
export function composeDesign(img: HTMLImageElement | ImageBitmap, backW: number, backH: number, fit: DesignFit) {
  const H = 1400;
  const W = Math.round((H * backW) / backH);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const iw = img.width,
    ih = img.height;
  const cx = W / 2;
  let dw: number, dh: number, cy = H / 2;
  if (fit === "cover") {
    const s = Math.max(W / iw, H / ih);
    dw = iw * s;
    dh = ih * s;
  } else if (fit === "contain") {
    const s = Math.min(W / iw, H / ih);
    dw = iw * s;
    dh = ih * s;
  } else {
    const s = Math.min((W * 0.5) / iw, (H * 0.28) / ih);
    dw = iw * s;
    dh = ih * s;
    cy = H * 0.55;
  }
  g.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
