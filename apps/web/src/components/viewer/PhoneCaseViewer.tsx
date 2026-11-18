"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Material, PhoneSpec } from "@/lib/types";
import {
  buildCaseGeometries,
  buildIsland,
  buildPhoneGeometries,
  carbonTexture,
  leatherGrain,
  lensBaseZ,
  lensWorld,
  buildSkinGeometries,
  buildProtectorGeometry,
  marbleTexture,
  woodTexture,
  brushedTexture,
  photoPlaceholder,
  coverFit,
  viewModeOf,
  lockScreenTexture,
  buildPortGeometries,
  detailsOf,
  sideX,
  isRoundIsland,
  lensTexture,
  buildPrintGeometry,
  composeDesign,
} from "./geometry";

/** Dynamic Island: a flat pill (fully rounded ends), ~19.5 × 5.9 mm like the real one */
const PILL = (() => {
  const w = 19.5, h = 5.9, r = h / 2;
  const s = new THREE.Shape();
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.closePath();
  return new THREE.ShapeGeometry(s, 24);
})();

export type ViewAngle = "back" | "side" | "front" | "angle" | "bottom";

export interface ViewerProps {
  spec: PhoneSpec;
  brand: string;
  material: Material;
  color: string;
  accent?: string | null;
  /** printed design (flat image) drawn on the case / skin back */
  design?: { url: string; fit?: "cover" | "contain" | "logo" } | null;
  /** skins: "back" or "back_sides" */
  coverage?: "back" | "back_sides";
  /** custom photo skins: object URL or uploaded URL */
  imageUrl?: string | null;
  autoRotate?: boolean;
  view?: ViewAngle;
  /** bumps when the same view is requested again */
  viewNonce?: number;
  interactive?: boolean;
  onInteract?: () => void;
}

const S = 0.01; // mm → scene units (phone ≈ 1.6 units tall)

function useCaseMaterial(material: Material, color: string, accent?: string | null) {
  return useMemo(() => {
    const c = new THREE.Color(color);
    switch (material) {
      case "clear": {
        const tinted = c.getHSL({ h: 0, s: 0, l: 0 }).s > 0.15 || c.getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;
        return {
          shell: new THREE.MeshPhysicalMaterial({
            color: c,
            transparent: true,
            opacity: tinted ? 0.4 : 0.18,
            roughness: 0.02,
            metalness: 0.06,
            clearcoat: 1,
            clearcoatRoughness: 0.015,
            reflectivity: 0.95,
            ior: 1.52,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
          edge: new THREE.MeshPhysicalMaterial({
            color: c,
            transparent: true,
            opacity: tinted ? 0.58 : 0.32,
            roughness: 0.05,
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            reflectivity: 0.92,
            depthWrite: false,
          }),
          ring: new THREE.MeshPhysicalMaterial({
            color: "#ffffff",
            roughness: 0.12,
            metalness: 0.88,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            reflectivity: 0.95,
          }),
          ringVisible: "full" as const,
        };
      }
      case "frosted":
        return {
          shell: new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.86, roughness: 0.78, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color("#ffffff"), depthWrite: true }),
          edge: new THREE.MeshStandardMaterial({ color: new THREE.Color(accent ?? color), roughness: 0.55 }),
          ring: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, 0.12), roughness: 0.6, transparent: true, opacity: 0.55 }),
          ringVisible: "full" as const,
        };
      case "silicone":
        return {
          shell: new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.9, metalness: 0, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.2) }),
          edge: new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.85, sheen: 0.5 }),
          ring: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.06), roughness: 0.9 }),
          ringVisible: "outline" as const,
        };
      case "leather": {
        const grain = leatherGrain();
        return {
          shell: new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0, bumpMap: grain, bumpScale: 0.35 }),
          edge: new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, bumpMap: grain, bumpScale: 0.2 }),
          ring: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08), roughness: 0.7 }),
          ringVisible: "outline" as const,
        };
      }
      case "carbon": {
        const tex = carbonTexture();
        return {
          shell: new THREE.MeshPhysicalMaterial({ color: c.clone().lerp(new THREE.Color("#ffffff"), 0.25), map: tex, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, bumpMap: tex, bumpScale: 0.05 }),
          edge: new THREE.MeshPhysicalMaterial({ color: c, map: tex, roughness: 0.35, clearcoat: 0.8 }),
          ring: new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }),
          ringVisible: "none" as const,
        };
      }
    }
  }, [material, color, accent]);
}

function Phone({ spec, brand }: { spec: PhoneSpec; brand: string }) {
  const g = useMemo(() => buildPhoneGeometries(spec), [spec]);
  const island = useMemo(() => buildIsland(spec), [spec]);
  const det = useMemo(() => detailsOf(spec, brand), [spec, brand]);
  const ports = useMemo(() => buildPortGeometries(spec, det), [spec, det]);
  const body = useMemo(() => new THREE.Color(spec.bodyHex), [spec.bodyHex]);
  const mats = useMemo(() => {
    const dark = body.getHSL({ h: 0, s: 0, l: 0 }).l < 0.3;
    return {
      // polished / brushed metal frame
      frame: new THREE.MeshPhysicalMaterial({ color: body, metalness: 0.85, roughness: 0.26, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.2 }),
      // frosted glass back
      back: new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.42, metalness: 0.08, clearcoat: 0.8, clearcoatRoughness: 0.35 }),
      // antenna bands: same colour, plastic, a touch darker
      line: new THREE.MeshStandardMaterial({ color: body.clone().offsetHSL(0, -0.05, dark ? 0.06 : -0.12), roughness: 0.7, metalness: 0.1 }),
      hole: new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.85, metalness: 0 }),
      button: new THREE.MeshStandardMaterial({ color: body.clone().offsetHSL(0, 0, dark ? 0.05 : -0.04), metalness: 0.9, roughness: 0.22 }),
      sapphire: new THREE.MeshPhysicalMaterial({ color: "#1a1c22", roughness: 0.08, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }),
      trim: new THREE.MeshStandardMaterial({ color: "#d7d9de", metalness: 1, roughness: 0.18 }),
    };
  }, [body]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const z = lensBaseZ(spec);
  const isApple = brand === "apple";
  const islandColor = spec.camera.hex ?? spec.bodyHex;
  const round = isRoundIsland(spec.camera);
  const cam = spec.camera;
  const { widthMm: W, heightMm: H, depthMm: D } = spec;
  const lensMap = lensTexture();

  return (
    <group>
      <mesh geometry={g.frameGeo} material={mats.frame} />
      <mesh geometry={g.backGlass} material={mats.back} />
      <mesh geometry={ports.lines} material={mats.line} />
      <mesh geometry={ports.holes} material={mats.hole} />

      {/* side buttons */}
      {det.buttons.map((bt, i) => {
        const x = sideX(bt.side, W / 2);
        const out = x > 0 ? 1 : -1;
        if (bt.kind === "camera")
          return <RoundedBox key={i} args={[0.5, bt.len, D * 0.42]} radius={0.2} position={[x + out * 0.1, H / 2 - bt.y, 0]} material={mats.sapphire} />;
        return (
          <RoundedBox
            key={i}
            args={[bt.kind === "slider" ? 1.4 : 1.1, bt.len, bt.kind === "slider" ? D * 0.36 : D * 0.42]}
            radius={0.42}
            smoothness={3}
            position={[x + out * 0.3, H / 2 - bt.y, 0]}
            material={mats.button}
          />
        );
      })}

      {/* front: cover glass + display */}
      <mesh geometry={g.coverGlass}>
        <meshPhysicalMaterial color="#030304" roughness={0.06} clearcoat={1} metalness={0.1} />
      </mesh>
      <mesh geometry={g.screen}>
        <meshStandardMaterial map={lockScreenTexture()} roughness={0.12} metalness={0} emissive="#ffffff" emissiveIntensity={0.08} />
      </mesh>
      {/* Dynamic Island / punch-hole */}
      {det.frontCam === "island" || (isApple && !spec.details) ? (
        <mesh geometry={PILL} position={[0, H / 2 - 7, -D / 2 - 0.07]} rotation={[0, Math.PI, 0]}>
          <meshBasicMaterial color="#050505" />
        </mesh>
      ) : (
        <mesh position={[0, H / 2 - 6, -D / 2 - 0.07]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[1.7, 32]} />
          <meshBasicMaterial color="#050505" />
        </mesh>
      )}

      {island && (
        <mesh geometry={island}>
          <meshPhysicalMaterial color={islandColor} roughness={round ? 0.3 : 0.22} metalness={round ? 0.55 : 0.4} clearcoat={1} />
        </mesh>
      )}
      {/* polished trim around round islands */}
      {round && (
        <mesh
          position={[toWorldX(spec, cam.x! + cam.w! / 2), toWorldY(spec, cam.y! + cam.h! / 2), D / 2 + (cam.rise ?? 1.4) - 0.35]}
          material={mats.trim}
        >
          <torusGeometry args={[cam.w! / 2 - 0.7, 0.75, 16, 96]} />
        </mesh>
      )}
      {cam.lenses.map((l, i) => {
        const p = lensWorld(spec, l);
        if (l.kind === "flash")
          return (
            <mesh key={i} position={[p.x, p.y, z + 0.05]}>
              <circleGeometry args={[l.d / 2, 32]} />
              <meshStandardMaterial color="#f3ead2" roughness={0.3} emissive="#6b5a2a" emissiveIntensity={0.2} />
            </mesh>
          );
        if (l.kind === "sensor")
          return (
            <mesh key={i} position={[p.x, p.y, z + 0.05]}>
              <circleGeometry args={[l.d / 2, 32]} />
              <meshStandardMaterial color="#141416" roughness={0.2} />
            </mesh>
          );
        const ringH = cam.type === "floating" ? (cam.rise ?? 1.4) : 1.3;
        return (
          <group key={i} position={[p.x, p.y, z]}>
            {/* metal barrel */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, ringH / 2]}>
              <cylinderGeometry args={[l.d / 2, l.d / 2, ringH, 64]} />
              <meshStandardMaterial color={isApple ? spec.bodyHex : "#2a2b2e"} metalness={0.92} roughness={0.18} />
            </mesh>
            {/* chamfered rim */}
            <mesh position={[0, 0, ringH + 0.01]}>
              <ringGeometry args={[l.d * 0.4, l.d / 2, 64]} />
              <meshStandardMaterial color={isApple ? spec.bodyHex : "#3a3b3f"} metalness={0.95} roughness={0.12} />
            </mesh>
            {/* coated glass with element reflections */}
            <mesh position={[0, 0, ringH + 0.02]}>
              <circleGeometry args={[l.d * 0.4, 64]} />
              <meshPhysicalMaterial map={lensMap} roughness={0.04} metalness={0.25} clearcoat={1} clearcoatRoughness={0} iridescence={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

const toWorldX = (spec: PhoneSpec, x: number) => -spec.widthMm / 2 + x;
const toWorldY = (spec: PhoneSpec, y: number) => spec.heightMm / 2 - y;

/** The design image, printed on the back of the case or skin. */
function PrintLayer({ spec, kind, thin, design, material }: { spec: PhoneSpec; kind: "case" | "skin"; thin?: boolean; design: NonNullable<ViewerProps["design"]>; material: string }) {
  const g = useMemo(() => buildPrintGeometry(spec, kind, thin), [spec, kind, thin]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => alive && setImg(im);
    im.src = design.url;
    return () => {
      alive = false;
    };
  }, [design.url]);
  const tex = useMemo(() => (img ? composeDesign(img, g.w, g.h, design.fit ?? "cover") : null), [img, g.w, g.h, design.fit]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  // printed ink: glossy on clear / glass-like cases, satin on soft-touch ones
  const glossy = material === "clear" || material === "frosted" || material.startsWith("skin-");
  return (
    <mesh geometry={g.geo} renderOrder={5}>
      <meshPhysicalMaterial map={tex} transparent alphaTest={0.02} roughness={glossy ? 0.25 : 0.6} clearcoat={glossy ? 0.8 : 0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function Case({ spec, brand, material, color, accent, design }: Omit<ViewerProps, "autoRotate" | "view" | "interactive">) {
  const thin = material === "carbon";
  const g = useMemo(() => buildCaseGeometries(spec, thin), [spec, thin]);
  const m = useCaseMaterial(material, color, accent)!;
  const bezelMat = useMemo(() => {
    if (material === "leather" && accent) return new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.25 });
    if (material === "clear") return m.edge;
    return m.shell;
  }, [material, accent, m]);
  const buttonMat = useMemo(() => {
    if (material === "leather" && accent) return new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.25 });
    if (material === "clear") return m.edge;
    return m.edge;
  }, [material, accent, m]);

  const { W } = g.dims;
  const det = useMemo(() => detailsOf(spec, brand), [spec, brand]);
  const windowMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#16171b", roughness: 0.1, clearcoat: 1, metalness: 0.2 }), []);
  // raised covers over the phone's buttons; the camera button & slider get an open window
  const buttons = det.buttons.map((b) => ({ ...b, x: sideX(b.side, W / 2), y: spec.heightMm / 2 - b.y }));

  return (
    <group>
      <mesh geometry={g.wallGeo} material={m.edge} renderOrder={2} />
      <mesh geometry={g.bottomGeo} material={m.edge} renderOrder={2} />
      <mesh geometry={g.lipGeo} material={m.edge} renderOrder={2} />
      <mesh geometry={g.backGeo} material={m.shell} renderOrder={3} />
      {g.bezelGeos.map((bg, i) => (
        <mesh key={i} geometry={bg} material={bezelMat} renderOrder={3} />
      ))}
      {m.ringVisible === "full" && (
        <>
          <mesh geometry={g.ringGeo} material={m.ring} renderOrder={4} />
          <mesh geometry={g.notchGeo} material={m.ring} renderOrder={4} />
        </>
      )}
      {m.ringVisible === "outline" && <mesh geometry={g.ringOutline} material={m.ring} renderOrder={4} />}
      {design && <PrintLayer spec={spec} kind="case" thin={thin} design={design} material={material} />}
      {buttons.map((b, i) => {
        const out = b.x > 0 ? 1 : -1;
        return b.kind === "camera" || b.kind === "slider" ? (
          <RoundedBox key={i} args={[0.4, b.len + 1.5, spec.depthMm * 0.5]} radius={0.18} position={[b.x + out * 0.22, b.y, 0]} material={windowMat} />
        ) : (
          <RoundedBox key={i} args={[1.3, b.len + 2.4, spec.depthMm * 0.48]} radius={0.6} smoothness={3} position={[b.x + out * 0.4, b.y, 0]} material={buttonMat} />
        );
      })}
    </group>
  );
}

/* ───────── skin: thin vinyl on the back (+ sides) ───────── */
function useImageTexture(url?: string | null) {
  const [tex, setTex] = useState<{ t: THREE.Texture; aspect: number } | null>(null);
  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setTex(null));
      return;
    }
    let alive = true;
    new THREE.TextureLoader().load(url, (t) => {
      if (!alive) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      const img = t.image as { width: number; height: number };
      setTex({ t, aspect: img.width / img.height });
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return tex;
}

function Skin({ spec, material, color, accent, coverage, imageUrl, design }: ViewerProps) {
  const g = useMemo(() => buildSkinGeometries(spec, coverage === "back_sides"), [spec, coverage]);
  const photo = useImageTexture(material === "skin-custom" ? imageUrl : null);

  const mats = useMemo(() => {
    const c = new THREE.Color(color);
    switch (material) {
      case "skin-carbon": {
        const tex = carbonTexture();
        const m = new THREE.MeshPhysicalMaterial({ color: c.clone().lerp(new THREE.Color("#ffffff"), 0.3), map: tex, bumpMap: tex, bumpScale: 0.08, roughness: 0.4, clearcoat: 0.6 });
        return { back: m, side: m };
      }
      case "skin-marble": {
        const tex = marbleTexture(color, accent ?? "#9aa1ab");
        const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
        return { back: m, side: m };
      }
      case "skin-wood": {
        const tex = woodTexture(color);
        const m = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.12, roughness: 0.62 });
        return { back: m, side: m };
      }
      case "skin-metal": {
        const tex = brushedTexture();
        const m = new THREE.MeshStandardMaterial({ color: c, map: tex, metalness: 0.85, roughness: 0.32 });
        return { back: m, side: m };
      }
      case "skin-custom": {
        const m = new THREE.MeshPhysicalMaterial({ map: photoPlaceholder(), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 });
        const side = new THREE.MeshPhysicalMaterial({ color: "#f4f5f7", roughness: 0.4, clearcoat: 0.5 });
        return { back: m, side };
      }
      default: {
        const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.85, sheen: 0.4, sheenRoughness: 0.8, sheenColor: c.clone().offsetHSL(0, 0, 0.15) });
        return { back: m, side: m };
      }
    }
  }, [material, color, accent]);

  // photo / placeholder UV fit
  const matsRef = useRef(mats);
  useEffect(() => {
    matsRef.current = mats;
  }, [mats]);
  useEffect(() => {
    if (material !== "skin-custom") return;
    const currentMats = matsRef.current;
    const m = currentMats.back as THREE.MeshPhysicalMaterial;
    if (photo) {
      const t = photo.t.clone();
      coverFit(t, g.W, g.H, photo.aspect);
      m.map = t;
      if (currentMats.side !== m) (currentMats.side as THREE.MeshPhysicalMaterial).color.set("#ffffff");
    } else {
      const t = photoPlaceholder().clone();
      coverFit(t, g.W, g.H, 0.5);
      m.map = t;
    }
    m.needsUpdate = true;
  }, [photo, material, g.W, g.H]);

  return (
    <group>
      <mesh geometry={g.backGeo} material={mats.back} />
      {g.sideGeo && <mesh geometry={g.sideGeo} material={mats.side} />}
      {design && material !== "skin-custom" && <PrintLayer spec={spec} kind="skin" design={design} material={material} />}
    </group>
  );
}

/* ───────── screen protector glass / camera lens guards ───────── */
function Protector({ spec, material, color }: ViewerProps) {
  const glass = useMemo(() => buildProtectorGeometry(spec), [spec]);
  const z = lensBaseZ(spec);
  const mat = useMemo(() => {
    if (material === "glass-privacy")
      return new THREE.MeshPhysicalMaterial({ color: "#0b0d12", transparent: true, opacity: 0.55, roughness: 0.04, clearcoat: 1, metalness: 0.2 });
    if (material === "glass-matte")
      return new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, roughness: 0.7, clearcoat: 0.2 });
    return new THREE.MeshPhysicalMaterial({ color: "#eaf4ff", transparent: true, opacity: 0.2, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, metalness: 0.1, iridescence: 0.3 });
  }, [material]);

  if (material === "lens") {
    const ringH = spec.camera.type === "floating" ? (spec.camera.rise ?? 1.4) + 0.9 : 2.2;
    return (
      <group>
        {spec.camera.lenses
          .filter((l) => !l.kind || l.kind === "lens")
          .map((l, i) => {
            const p = lensWorld(spec, l);
            return (
              <group key={i} position={[p.x, p.y, z]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, ringH / 2]}>
                  <cylinderGeometry args={[l.d / 2 + 0.7, l.d / 2 + 0.7, ringH, 48, 1, true]} />
                  <meshStandardMaterial color={color} metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, 0, ringH + 0.02]}>
                  <circleGeometry args={[l.d / 2 + 0.7, 48]} />
                  <meshPhysicalMaterial color="#dfe9ff" transparent opacity={0.22} roughness={0.02} clearcoat={1} />
                </mesh>
              </group>
            );
          })}
      </group>
    );
  }
  return <mesh geometry={glass} material={mat} renderOrder={5} />;
}

const VIEWS: Record<ViewAngle, [number, number, number]> = {
  back: [0, 0.05, 4.9],
  angle: [2.6, 0.65, 4.0],
  side: [4.9, 0.2, 0.2],
  front: [0, 0.05, -4.9],
  bottom: [1.3, -3.6, 3.0],
};

function CameraRig({ view, nonce, controls }: { view: ViewAngle; nonce: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, invalidate } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    target.current = new THREE.Vector3(...VIEWS[view]);
    invalidate();
  }, [view, nonce, invalidate]);
  useFrame((_, dt) => {
    if (!target.current) return;
    camera.position.lerp(target.current, 1 - Math.pow(0.0015, dt));
    controls.current?.update();
    if (camera.position.distanceTo(target.current) < 0.01) target.current = null;
  });
  return null;
}

function Invalidator(props: ViewerProps) {
  const { invalidate } = useThree();
  useEffect(() => {
    invalidate();
  }, [props.spec, props.color, props.material, props.accent, props.coverage, props.design, props.brand, invalidate]);
  return null;
}

function Scene(props: ViewerProps & { spin: boolean; onStart: () => void; onEnd: () => void }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const floorY = 0.1 - (props.spec.heightMm / 2) * S - 0.012;
  return (
    <>
      <Invalidator {...props} />
      <group scale={S} rotation={[0, -0.35, 0]} position={[0, 0.1, 0]}>
        <Phone spec={props.spec} brand={props.brand} />
        {viewModeOf(props.material) === "case" && <Case {...props} />}
        {viewModeOf(props.material) === "skin" && <Skin {...props} />}
        {viewModeOf(props.material) === "protector" && <Protector {...props} />}
      </group>
      {/* soft contact shadow, rendered once (the camera moves, the phone doesn't) */}
      <ContactShadows key={props.spec.heightMm} position={[0, floorY, 0]} scale={2.2} far={0.9} blur={2.6} opacity={0.32} resolution={256} frames={1} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 4, 3]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[5, 0, -1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" color="#b9c7ff" intensity={1.2} position={[0, -2, -5]} scale={4} />
      </Environment>
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.4}
        maxDistance={6.5}
        maxPolarAngle={Math.PI * 0.86}
        autoRotate={props.spin}
        autoRotateSpeed={1.6}
        enableZoom={props.interactive !== false}
        enableRotate={props.interactive !== false}
        onStart={() => {
          props.onStart();
          props.onInteract?.();
        }}
        onEnd={props.onEnd}
      />
      <CameraRig view={props.view ?? "angle"} nonce={props.viewNonce ?? 0} controls={controls} />
    </>
  );
}

/** How long the showcase spin runs before the phone settles (ms) */
const SPIN_FOR = 25_000;

export default function PhoneCaseViewer(props: ViewerProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [spin, setSpin] = useState(!!props.autoRotate);
  const [hot, setHot] = useState(true);
  const cool = useRef<ReturnType<typeof setTimeout> | null>(null);

  // stop rendering when scrolled off-screen → saves battery on phones
  useEffect(() => {
    if (!wrap.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  // the showcase spin stops after a while; then frames are only drawn when something changes
  useEffect(() => {
    if (!spin) return;
    const t = setTimeout(() => setSpin(false), SPIN_FOR);
    return () => clearTimeout(t);
  }, [spin]);

  const keepAlive = (ms: number) => {
    setHot(true);
    if (cool.current) clearTimeout(cool.current);
    cool.current = setTimeout(() => setHot(false), ms);
  };
  useEffect(() => {
    queueMicrotask(() => keepAlive(1800)); // camera glides to a new view or updates on model/spec/color change
  }, [props.view, props.viewNonce, props.spec, props.color, props.material, props.brand]);
  useEffect(() => () => void (cool.current && clearTimeout(cool.current)), []);

  return (
    <div ref={wrap} className="h-full w-full touch-none select-none">
      <Canvas
        frameloop={!visible ? "never" : spin || hot ? "always" : "demand"}
        dpr={[1, 2]}
        shadows={false}
        camera={{ position: VIEWS.angle, fov: 32, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
        aria-label="3D preview of the case on your phone — drag to rotate"
      >
        <Scene
          {...props}
          spin={spin}
          onStart={() => {
            setSpin(false);
            if (cool.current) clearTimeout(cool.current);
            setHot(true);
          }}
          onEnd={() => keepAlive(1500)}
        />
      </Canvas>
    </div>
  );
}
