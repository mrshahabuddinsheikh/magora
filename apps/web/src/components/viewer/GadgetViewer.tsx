"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * Procedural 3D gadgets (earbuds, watch, power bank, charger, cable,
 * handsfree) built from primitives — no model files to download, any colour
 * instantly. Same lighting / controls as the phone viewer so the store feels
 * like one product.
 */
export type GadgetView = "angle" | "front" | "back" | "side";
export interface GadgetViewerProps {
  /** the product's own 3D model (.glb) — replaces the drawn model when set */
  modelUrl?: string | null;
  material: string;
  color: string;
  accent?: string | null;
  autoRotate?: boolean;
  view?: GadgetView;
  viewNonce?: number;
  interactive?: boolean;
  onInteract?: () => void;
}

const VIEWS: Record<GadgetView, [number, number, number]> = {
  angle: [2.4, 1.1, 3.6],
  front: [0, 0.2, 4.4],
  back: [0, 0.2, -4.4],
  side: [4.4, 0.4, 0.2],
};

function useMats(color: string, accent?: string | null) {
  return useMemo(() => {
    const c = new THREE.Color(color);
    const dark = c.getHSL({ h: 0, s: 0, l: 0 }).l < 0.3;
    const a = new THREE.Color(accent ?? (dark ? "#3b3e45" : "#d5d8dd"));
    return {
      body: new THREE.MeshPhysicalMaterial({ color: c, roughness: dark ? 0.38 : 0.24, metalness: 0.04, clearcoat: 0.85, clearcoatRoughness: 0.15 }),
      matte: new THREE.MeshStandardMaterial({ color: c, roughness: 0.72 }),
      strap: new THREE.MeshStandardMaterial({ color: a, roughness: 0.65, metalness: 0.06 }),
      accent: new THREE.MeshPhysicalMaterial({ color: a, roughness: 0.42, clearcoat: 0.35 }),
      metal: new THREE.MeshStandardMaterial({ color: "#d1d5db", roughness: 0.20, metalness: 0.94 }),
      gold: new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.18, metalness: 0.95 }),
      blackRing: new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.85 }),
      port: new THREE.MeshStandardMaterial({ color: "#090a0d", roughness: 0.65 }),
      mesh: new THREE.MeshStandardMaterial({ color: "#1f2228", roughness: 0.92 }),
      siliconeTip: new THREE.MeshPhysicalMaterial({ color: a, roughness: 0.36, transmission: 0.24, thickness: 0.12, clearcoat: 0.2 }),
      led: new THREE.MeshStandardMaterial({ color: "#34d399", emissive: "#34d399", emissiveIntensity: 2.2 }),
      sensorRed: new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#ef4444", emissiveIntensity: 1.8 }),
      ledOff: new THREE.MeshStandardMaterial({ color: dark ? "#4b5059" : "#c3c7cd", roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#06080e", roughness: 0.04, clearcoat: 1, metalness: 0.2 }),
      ceramic: new THREE.MeshPhysicalMaterial({ color: dark ? "#181a20" : "#e5e7eb", roughness: 0.16, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
      screenGlass: new THREE.MeshPhysicalMaterial({ color: "#04060a", roughness: 0.02, clearcoat: 1.0, clearcoatRoughness: 0.03, reflectivity: 0.95 }),
      dark,
    };
  }, [color, accent]);
}

function watchFaceTexture() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 640;
  cv.height = 760;
  const g = cv.getContext("2d");
  if (!g) return null;

  // 1. OLED dark gradient background
  const grad = g.createRadialGradient(320, 380, 40, 320, 380, 460);
  grad.addColorStop(0, "#0e1320");
  grad.addColorStop(0.65, "#06080f");
  grad.addColorStop(1, "#020306");
  g.fillStyle = grad;
  g.fillRect(0, 0, 640, 760);

  // 2. Bezel tick marks
  const cx = 320;
  const cy = 380;
  const rx = 290;
  const ry = 350;
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const isQuarter = i % 15 === 0;
    const len = isQuarter ? 14 : isMajor ? 9 : 4;
    const x1 = cx + Math.cos(angle) * (rx - len);
    const y1 = cy + Math.sin(angle) * (ry - len);
    const x2 = cx + Math.cos(angle) * rx;
    const y2 = cy + Math.sin(angle) * ry;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = isQuarter ? "#38bdf8" : isMajor ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)";
    g.lineWidth = isQuarter ? 3.5 : isMajor ? 2.5 : 1.5;
    g.stroke();
  }

  // 3. Top date badge
  g.fillStyle = "rgba(255, 255, 255, 0.08)";
  g.beginPath();
  if (typeof g.roundRect === "function") {
    g.roundRect(220, 52, 200, 38, 19);
  } else {
    g.rect(220, 52, 200, 38);
  }
  g.fill();
  g.font = "bold 22px system-ui, -apple-system, sans-serif";
  g.fillStyle = "#38bdf8";
  g.textAlign = "center";
  g.fillText("WED 14 NOV", 320, 78);

  // 4. Large Glowing Digital Time
  g.font = "bold 136px system-ui, -apple-system, sans-serif";
  g.textAlign = "center";
  g.shadowColor = "rgba(56, 189, 248, 0.4)";
  g.shadowBlur = 18;
  g.fillStyle = "#ffffff";
  g.fillText("10:09", 320, 225);
  g.shadowBlur = 0;

  // Seconds subtitle
  g.font = "600 24px system-ui, -apple-system, sans-serif";
  g.fillStyle = "#38bdf8";
  g.fillText("38 SEC", 320, 266);

  // 5. Activity Rings (Move, Exercise, Stand)
  const ringX = 320;
  const ringY = 445;
  const rings = [
    { r: 105, width: 18, color: "#ff2e63", bg: "rgba(255, 46, 99, 0.2)", progress: 0.82 },
    { r: 82, width: 18, color: "#a3e635", bg: "rgba(163, 230, 53, 0.2)", progress: 0.65 },
    { r: 59, width: 18, color: "#00f0ff", bg: "rgba(0, 240, 255, 0.2)", progress: 0.90 },
  ];
  rings.forEach((ring) => {
    // Background track
    g.beginPath();
    g.arc(ringX, ringY, ring.r, 0, Math.PI * 2);
    g.strokeStyle = ring.bg;
    g.lineWidth = ring.width;
    g.lineCap = "round";
    g.stroke();

    // Progress arc
    g.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + ring.progress * Math.PI * 2;
    g.arc(ringX, ringY, ring.r, startAngle, endAngle);
    g.strokeStyle = ring.color;
    g.lineWidth = ring.width;
    g.lineCap = "round";
    g.stroke();
  });

  // 6. Bottom metrics cards
  // Left: Heart rate
  g.fillStyle = "rgba(255, 255, 255, 0.07)";
  g.beginPath();
  if (typeof g.roundRect === "function") g.roundRect(65, 595, 235, 96, 18);
  else g.rect(65, 595, 235, 96);
  g.fill();
  g.fillStyle = "#ef4444";
  g.font = "bold 28px system-ui, sans-serif";
  g.textAlign = "left";
  g.fillText("♥ 78", 90, 638);
  g.fillStyle = "#94a3b8";
  g.font = "500 18px system-ui, sans-serif";
  g.fillText("BPM · Rest", 90, 668);

  // Right: Steps
  g.fillStyle = "rgba(255, 255, 255, 0.07)";
  g.beginPath();
  if (typeof g.roundRect === "function") g.roundRect(340, 595, 235, 96, 18);
  else g.rect(340, 595, 235, 96);
  g.fill();
  g.fillStyle = "#f59e0b";
  g.font = "bold 28px system-ui, sans-serif";
  g.fillText("⚡ 8,420", 365, 638);
  g.fillStyle = "#94a3b8";
  g.font = "500 18px system-ui, sans-serif";
  g.fillText("STEPS · 5.8 km", 365, 668);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function PowerBank({ m }: { m: ReturnType<typeof useMats> }) {
  return (
    <group>
      <RoundedBox args={[0.76, 1.14, 0.14]} radius={0.06} smoothness={6} material={m.body} />
      {/* MagSafe magnetic alignment ring on the back */}
      <mesh position={[0, 0.08, -0.072]} material={m.accent}>
        <torusGeometry args={[0.25, 0.018, 16, 64]} />
      </mesh>
      {/* Alignment pill magnet */}
      <RoundedBox args={[0.035, 0.11, 0.012]} radius={0.01} position={[0, -0.22, -0.072]} material={m.accent} />
      {/* Side tactile power button */}
      <RoundedBox args={[0.02, 0.12, 0.035]} radius={0.008} position={[0.385, 0.22, 0]} material={m.accent} />
      {/* LEDs on the front */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.09 + i * 0.06, -0.42, 0.073]} material={i < 3 ? m.led : m.ledOff}>
          <circleGeometry args={[0.014, 16]} />
        </mesh>
      ))}
      {/* Bottom ports: USB-C and USB-A */}
      <RoundedBox args={[0.14, 0.032, 0.05]} radius={0.014} position={[-0.10, -0.571, 0]} material={m.port} />
      <RoundedBox args={[0.14, 0.032, 0.05]} radius={0.014} position={[0.10, -0.571, 0]} material={m.metal} />
    </group>
  );
}

function Charger({ m }: { m: ReturnType<typeof useMats> }) {
  return (
    <group rotation={[0, 0, 0]}>
      <RoundedBox args={[0.74, 0.74, 0.64]} radius={0.12} smoothness={6} material={m.body} />
      {/* Folding plug prongs on the back */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0, -0.52]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 24]} />
        </mesh>
      ))}
      {/* Dual fast-charge USB-C ports on the front */}
      {[0.11, -0.11].map((y) => (
        <group key={y} position={[0, y, 0.321]}>
          <RoundedBox args={[0.26, 0.08, 0.03]} radius={0.03} material={m.port} />
          <RoundedBox args={[0.14, 0.012, 0.032]} radius={0.005} material={m.gold} />
        </group>
      ))}
    </group>
  );
}

function Earbuds({ m }: { m: ReturnType<typeof useMats> }) {
  // Flagship contoured in-ear buds with acoustic nozzle, silicone tip, and force-sensor stem
  const bud = (side: 1 | -1) => (
    <group
      position={[side * 0.78, -0.06, 0.14]}
      rotation={[0.1, side * -0.42, side * 0.12]}
    >
      {/* Acoustic head housing */}
      <mesh scale={[1.15, 1.25, 0.98]} material={m.body}>
        <sphereGeometry args={[0.12, 32, 24]} />
      </mesh>
      {/* Outward ANC acoustic microphone mesh */}
      <RoundedBox
        args={[0.035, 0.08, 0.015]}
        radius={0.012}
        position={[side * 0.12, 0.02, 0.01]}
        material={m.mesh}
      />
      {/* Angled sound nozzle */}
      <group position={[side * -0.075, 0.02, 0.055]} rotation={[0, side * 0.45, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.body}>
          <cylinderGeometry args={[0.05, 0.06, 0.055, 24]} />
        </mesh>
        {/* Soft silicone ear-tip */}
        <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]} material={m.siliconeTip}>
          <cylinderGeometry args={[0.042, 0.08, 0.07, 28]} />
        </mesh>
        {/* Acoustic mesh grille on tip */}
        <mesh position={[0, 0, 0.071]} material={m.mesh}>
          <circleGeometry args={[0.038, 20]} />
        </mesh>
      </group>
      {/* In-ear optical detection sensor */}
      <mesh position={[side * -0.045, -0.035, 0.08]} material={m.port}>
        <circleGeometry args={[0.012, 16]} />
      </mesh>
      {/* Ergonomic contoured stem */}
      <mesh position={[0, -0.20, 0]} material={m.body}>
        <capsuleGeometry args={[0.038, 0.25, 12, 24]} />
      </mesh>
      {/* Force touch sensor groove */}
      <RoundedBox
        args={[0.014, 0.10, 0.018]}
        radius={0.006}
        position={[side * 0.034, -0.20, 0.01]}
        material={m.accent}
      />
      {/* Bottom dual charging contact terminal */}
      <mesh position={[0, -0.34, 0]} material={m.metal}>
        <cylinderGeometry args={[0.034, 0.030, 0.035, 24]} />
      </mesh>
      {/* Bottom microphone hole */}
      <mesh position={[0, -0.359, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.port}>
        <circleGeometry args={[0.012, 16]} />
      </mesh>
    </group>
  );

  return (
    <group position={[0, -0.05, 0]}>
      {/* Pebble charging case: base + lid with realistic magnetic seam */}
      {/* Base: height = 0.58, radius = 0.16 (radius * 2 = 0.32 < 0.58 -> perfectly smooth, no ear artifacts) */}
      <RoundedBox
        args={[1.04, 0.58, 0.42]}
        radius={0.16}
        smoothness={8}
        position={[0, -0.16, -0.05]}
        material={m.body}
      />
      {/* Lid: height = 0.32, radius = 0.13 (radius * 2 = 0.26 < 0.32 -> perfectly smooth, no ear artifacts) */}
      <RoundedBox
        args={[1.04, 0.32, 0.42]}
        radius={0.13}
        smoothness={8}
        position={[0, 0.295, -0.05]}
        material={m.body}
      />
      {/* Front thumb scoop opening notch */}
      <RoundedBox
        args={[0.22, 0.03, 0.025]}
        radius={0.012}
        position={[0, 0.13, 0.162]}
        material={m.accent}
      />
      {/* Front status LED indicator */}
      <mesh position={[0, 0.01, 0.162]} material={m.led}>
        <circleGeometry args={[0.016, 16]} />
      </mesh>
      {/* Rear metallic hinge */}
      <RoundedBox
        args={[0.34, 0.07, 0.025]}
        radius={0.012}
        position={[0, 0.13, -0.262]}
        material={m.metal}
      />
      {/* Rear pairing button */}
      <mesh position={[0, -0.12, -0.262]} rotation={[0, Math.PI, 0]} material={m.accent}>
        <circleGeometry args={[0.06, 24]} />
      </mesh>
      {/* Bottom USB-C port */}
      <group position={[0, -0.451, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <RoundedBox args={[0.18, 0.065, 0.02]} radius={0.022} material={m.metal} />
        <RoundedBox args={[0.13, 0.034, 0.03]} radius={0.012} material={m.port} />
        <RoundedBox args={[0.07, 0.008, 0.02]} material={m.gold} />
      </group>
      {bud(-1)}
      {bud(1)}
    </group>
  );
}

function Watch({ m }: { m: ReturnType<typeof useMats> }) {
  const [face, setFace] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const t = watchFaceTexture();
    if (t) queueMicrotask(() => setFace(t));
    return () => {
      if (t) t.dispose();
    };
  }, []);

  const metal = useMemo(() => {
    const b = m.body.clone();
    b.metalness = 0.82;
    b.roughness = 0.24;
    b.clearcoat = 0.6;
    b.clearcoatRoughness = 0.15;
    return b;
  }, [m.body]);

  // Smooth parametric extruded strap geometries (no jagged box blocks)
  const { topStrapGeom, bottomStrapGeom } = useMemo(() => {
    const createStrap = (dir: 1 | -1) => {
      const pts = [
        new THREE.Vector3(0, dir * 0.49, -0.01),
        new THREE.Vector3(0, dir * 0.66, -0.04),
        new THREE.Vector3(0, dir * 0.82, -0.15),
        new THREE.Vector3(0, dir * 0.90, -0.36),
        new THREE.Vector3(0, dir * 0.82, -0.58),
        new THREE.Vector3(0, dir * 0.58, -0.74),
        new THREE.Vector3(0, dir * 0.28, -0.82),
        new THREE.Vector3(0, dir * 0.02, -0.84),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const shape = new THREE.Shape();
      const w = 0.27;
      const h = 0.022;
      const r = 0.008;
      shape.moveTo(-w + r, -h);
      shape.lineTo(w - r, -h);
      shape.quadraticCurveTo(w, -h, w, -h + r);
      shape.lineTo(w, h - r);
      shape.quadraticCurveTo(w, h, w - r, h);
      shape.lineTo(-w + r, h);
      shape.quadraticCurveTo(-w, h, -w, h - r);
      shape.lineTo(-w, -h + r);
      shape.quadraticCurveTo(-w, -h, -w + r, -h);
      const geom = new THREE.ExtrudeGeometry(shape, { extrudePath: curve, steps: 36, bevelEnabled: false });
      geom.computeVertexNormals();
      return geom;
    };
    return {
      topStrapGeom: createStrap(1),
      bottomStrapGeom: createStrap(-1),
    };
  }, []);

  useEffect(() => {
    return () => {
      topStrapGeom.dispose();
      bottomStrapGeom.dispose();
    };
  }, [topStrapGeom, bottomStrapGeom]);

  return (
    <group>
      {/* Organic continuous curved straps */}
      <mesh geometry={topStrapGeom} material={m.strap} />
      <mesh geometry={bottomStrapGeom} material={m.strap} />

      {/* Titanium lug connectors linking strap to watch chassis */}
      <RoundedBox args={[0.54, 0.04, 0.06]} radius={0.015} position={[0, 0.505, -0.01]} material={metal} />
      <RoundedBox args={[0.54, 0.04, 0.06]} radius={0.015} position={[0, -0.505, -0.01]} material={metal} />

      {/* Top strap buckle & keeper loop */}
      <RoundedBox args={[0.56, 0.07, 0.05]} radius={0.016} position={[0, 0.45, -0.76]} rotation={[0.8, 0, 0]} material={metal} />
      <RoundedBox args={[0.56, 0.05, 0.05]} radius={0.014} position={[0, 0.28, -0.82]} rotation={[0.4, 0, 0]} material={m.accent} />

      {/* Bottom strap pin/tuck stud */}
      <mesh position={[0, -0.22, -0.83]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 20]} />
      </mesh>

      {/* Main Watch Chassis: beveled curved body */}
      <RoundedBox args={[0.84, 1.02, 0.20]} radius={0.16} smoothness={8} material={metal} />

      {/* Inner ceramic screen bezel lip */}
      <RoundedBox args={[0.74, 0.92, 0.204]} radius={0.12} smoothness={6} material={m.port} />

      {/* High-res Glowing AMOLED Watch Face Display */}
      {face && (
        <mesh position={[0, 0, 0.104]}>
          <planeGeometry args={[0.70, 0.86]} />
          <meshStandardMaterial
            map={face}
            emissiveMap={face}
            emissive="#ffffff"
            emissiveIntensity={0.92}
            roughness={0.12}
          />
        </mesh>
      )}

      {/* Digital Crown on right side: knurled wheel with accent center dot */}
      <group position={[0.435, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={metal}>
          <cylinderGeometry args={[0.068, 0.068, 0.045, 32]} />
        </mesh>
        <mesh position={[0, 0.025, 0]} material={m.accent}>
          <cylinderGeometry args={[0.046, 0.046, 0.01, 24]} />
        </mesh>
      </group>

      {/* Flush side action button */}
      <RoundedBox args={[0.03, 0.24, 0.06]} radius={0.015} position={[0.428, -0.16, 0]} material={metal} />

      {/* Microphone pinhole */}
      <mesh position={[0.425, 0.0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.port}>
        <cylinderGeometry args={[0.012, 0.012, 0.02, 16]} />
      </mesh>

      {/* Left speaker grilles */}
      <RoundedBox args={[0.02, 0.10, 0.025]} radius={0.01} position={[-0.425, 0.06, 0]} material={m.port} />
      <RoundedBox args={[0.02, 0.10, 0.025]} radius={0.01} position={[-0.425, -0.06, 0]} material={m.port} />

      {/* Rear Ceramic Sensor Cluster */}
      <group position={[0, 0, -0.102]}>
        {/* Ceramic dome */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.ceramic}>
          <cylinderGeometry args={[0.26, 0.28, 0.02, 32]} />
        </mesh>
        {/* Dark sensor window */}
        <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
          <cylinderGeometry args={[0.18, 0.18, 0.006, 32]} />
        </mesh>
        {/* Optical Green Heart Rate LEDs */}
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0, -0.016]} material={m.led}>
            <circleGeometry args={[0.022, 16]} />
          </mesh>
        ))}
        {/* Infrared SpO2 sensor diodes */}
        {[-0.06, 0.06].map((y) => (
          <mesh key={y} position={[0, y, -0.016]} material={m.sensorRed}>
            <circleGeometry args={[0.022, 16]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Cable({ m }: { m: ReturnType<typeof useMats> }) {
  const tube = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    pts.push(new THREE.Vector3(-0.55, -0.75, 0.15));
    pts.push(new THREE.Vector3(-0.6, -0.2, 0.2));
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * Math.PI * 2 * 1.5;
      pts.push(new THREE.Vector3(Math.cos(t + Math.PI) * 0.55, 0.15 + Math.sin(t) * 0.42, Math.sin(t * 0.5) * 0.18 - i * 0.004));
    }
    pts.push(new THREE.Vector3(0.6, -0.2, -0.05));
    pts.push(new THREE.Vector3(0.5, -0.75, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 260, 0.028, 12, false);
  }, []);
  const head = (x: number, z: number) => (
    <group position={[x, -0.9, z]}>
      <RoundedBox args={[0.11, 0.26, 0.07]} radius={0.03} material={m.accent} />
      <RoundedBox args={[0.085, 0.12, 0.03]} radius={0.012} position={[0, -0.18, 0]} material={m.metal} />
    </group>
  );
  return (
    <group position={[0, 0.15, 0]}>
      <mesh geometry={tube} material={m.matte} />
      {head(-0.55, 0.15)}
      {head(0.5, 0)}
    </group>
  );
}

function Handsfree({ m }: { m: ReturnType<typeof useMats> }) {
  const metal = useMemo(() => {
    const b = m.body.clone();
    b.metalness = 0.88;
    b.roughness = 0.22;
    return b;
  }, [m.body]);

  const { leftWireGeom, rightWireGeom, trunkWireGeom } = useMemo(() => {
    const mkTube = (pts: [number, number, number][], radius: number, steps: number) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const geom = new THREE.TubeGeometry(curve, steps, radius, 12, false);
      return geom;
    };
    return {
      leftWireGeom: mkTube(
        [
          [-0.46, 0.58, 0.0],
          [-0.42, 0.35, 0.04],
          [-0.26, 0.10, 0.03],
          [-0.10, -0.12, 0.01],
          [0, -0.22, 0.0],
        ],
        0.016,
        64
      ),
      rightWireGeom: mkTube(
        [
          [0.46, 0.58, 0.0],
          [0.40, 0.38, -0.03],
          [0.32, 0.16, 0.04],
          [0.18, -0.06, 0.03],
          [0, -0.22, 0.0],
        ],
        0.016,
        64
      ),
      trunkWireGeom: mkTube(
        [
          [0, -0.32, 0.0],
          [0.03, -0.55, 0.03],
          [-0.04, -0.85, -0.02],
          [0.02, -1.10, 0.02],
          [0, -1.25, 0.0],
        ],
        0.022,
        80
      ),
    };
  }, []);

  useEffect(() => {
    return () => {
      leftWireGeom.dispose();
      rightWireGeom.dispose();
      trunkWireGeom.dispose();
    };
  }, [leftWireGeom, rightWireGeom, trunkWireGeom]);

  const ear = (side: 1 | -1) => (
    <group
      position={[side * 0.46, 0.68, 0]}
      rotation={[0.2, side * 0.45, side * -0.2]}
    >
      {/* CNC machined aluminum rear driver chamber */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={metal}>
        <cylinderGeometry args={[0.09, 0.09, 0.13, 32]} />
      </mesh>
      {/* Chamfered polished bevel ring */}
      <mesh position={[0, 0, -0.066]} material={m.metal}>
        <torusGeometry args={[0.082, 0.01, 16, 32]} />
      </mesh>
      {/* Back glass face with dark metallic depth */}
      <mesh position={[0, 0, -0.068]} rotation={[Math.PI, 0, 0]} material={m.glass}>
        <circleGeometry args={[0.075, 24]} />
      </mesh>
      {/* Audiophile channel identification ring (Blue for L, Red for R) */}
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.092, 0.092, 0.018, 32]} />
        <meshStandardMaterial
          color={side === -1 ? "#3b82f6" : "#ef4444"}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Angled front acoustic nozzle */}
      <group position={[side * -0.06, 0, 0.06]} rotation={[0, side * 0.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={metal}>
          <cylinderGeometry args={[0.055, 0.07, 0.08, 24]} />
        </mesh>
        {/* Soft silicone ear tip */}
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} material={m.siliconeTip}>
          <cylinderGeometry args={[0.045, 0.085, 0.075, 28]} />
        </mesh>
        {/* Acoustic mesh grille on tip */}
        <mesh position={[0, 0, 0.078]} material={m.mesh}>
          <circleGeometry args={[0.042, 20]} />
        </mesh>
      </group>
      {/* Flexible ribbed rubber strain relief boot */}
      <mesh position={[0, -0.10, -0.01]} material={m.matte}>
        <cylinderGeometry args={[0.025, 0.035, 0.10, 16]} />
      </mesh>
    </group>
  );

  return (
    <group position={[0, 0.18, 0]}>
      {/* Natural hanging cables */}
      <mesh geometry={leftWireGeom} material={m.matte} />
      <mesh geometry={rightWireGeom} material={m.matte} />
      <mesh geometry={trunkWireGeom} material={m.matte} />

      {/* Audiophile IEM Earphones */}
      {ear(-1)}
      {ear(1)}

      {/* In-Line 3-Button Controller & Mic on right cable */}
      <group position={[0.32, 0.16, 0.04]} rotation={[0, 0, -0.15]}>
        <RoundedBox args={[0.07, 0.28, 0.038]} radius={0.018} material={m.body} />
        {/* Tactile + button */}
        <RoundedBox args={[0.045, 0.055, 0.012]} radius={0.006} position={[0, 0.08, 0.018]} material={m.accent} />
        {/* Tactile center button */}
        <RoundedBox args={[0.045, 0.055, 0.012]} radius={0.006} position={[0, 0, 0.018]} material={m.metal} />
        {/* Tactile - button */}
        <RoundedBox args={[0.045, 0.055, 0.012]} radius={0.006} position={[0, -0.08, 0.018]} material={m.accent} />
        {/* Microphone hole on back */}
        <mesh position={[0, 0, -0.02]} rotation={[Math.PI, 0, 0]} material={m.port}>
          <circleGeometry args={[0.012, 16]} />
        </mesh>
      </group>

      {/* Aluminum Y-Splitter Junction */}
      <group position={[0, -0.27, 0]}>
        <RoundedBox args={[0.07, 0.12, 0.048]} radius={0.022} material={metal} />
        <mesh position={[0, 0.065, 0]} material={m.matte}>
          <cylinderGeometry args={[0.028, 0.032, 0.02, 16]} />
        </mesh>
        <mesh position={[0, -0.065, 0]} material={m.matte}>
          <cylinderGeometry args={[0.032, 0.028, 0.02, 16]} />
        </mesh>
      </group>

      {/* 4-Pole Gold-Plated TRRS 3.5mm Headphone Jack */}
      <group position={[0, -1.36, 0]}>
        {/* Stepped rubber strain-relief boot */}
        <mesh position={[0, 0.11, 0]} material={m.matte}>
          <cylinderGeometry args={[0.032, 0.046, 0.08, 16]} />
        </mesh>
        {/* Knurled aluminum connector barrel */}
        <mesh position={[0, 0.01, 0]} material={metal}>
          <cylinderGeometry args={[0.054, 0.054, 0.18, 32]} />
        </mesh>
        {/* Gold-plated 4-pole TRRS pin */}
        {/* Sleeve (pole 1) */}
        <mesh position={[0, -0.11, 0]} material={m.gold}>
          <cylinderGeometry args={[0.025, 0.025, 0.05, 20]} />
        </mesh>
        {/* Black insulator ring 1 */}
        <mesh position={[0, -0.138, 0]} material={m.blackRing}>
          <cylinderGeometry args={[0.0255, 0.0255, 0.008, 20]} />
        </mesh>
        {/* Ring 2 (pole 2) */}
        <mesh position={[0, -0.156, 0]} material={m.gold}>
          <cylinderGeometry args={[0.025, 0.025, 0.028, 20]} />
        </mesh>
        {/* Black insulator ring 2 */}
        <mesh position={[0, -0.173, 0]} material={m.blackRing}>
          <cylinderGeometry args={[0.0255, 0.0255, 0.008, 20]} />
        </mesh>
        {/* Ring 1 (pole 3) */}
        <mesh position={[0, -0.191, 0]} material={m.gold}>
          <cylinderGeometry args={[0.025, 0.025, 0.028, 20]} />
        </mesh>
        {/* Black insulator ring 3 */}
        <mesh position={[0, -0.208, 0]} material={m.blackRing}>
          <cylinderGeometry args={[0.0255, 0.0255, 0.008, 20]} />
        </mesh>
        {/* Tip (pole 4) */}
        <mesh position={[0, -0.225, 0]} material={m.gold}>
          <cylinderGeometry args={[0.022, 0.025, 0.026, 20]} />
        </mesh>
      </group>
    </group>
  );
}

function Model({ material, color, accent }: { material: string; color: string; accent?: string | null }) {
  const m = useMats(color, accent);
  switch (material) {
    case "gadget-powerbank":
      return <PowerBank m={m} />;
    case "gadget-charger":
      return <Charger m={m} />;
    case "gadget-earbuds":
      return <Earbuds m={m} />;
    case "gadget-watch":
      return <Watch m={m} />;
    case "gadget-cable":
      return <Cable m={m} />;
    case "gadget-handsfree":
      return <Handsfree m={m} />;
    default:
      return <RoundedBox args={[0.8, 0.8, 0.3]} radius={0.1} material={m.body} />;
  }
}

/** Loads a compressed .glb, centres it and scales it to the same size as the drawn models. */
function ModelFile({ url, onError }: { url: string; onError: () => void }) {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three/examples/jsm/libs/meshopt_decoder.module.js"),
        ]);
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.loadAsync(url);
        if (!alive) return;
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const k = 1.75 / Math.max(size.x, size.y, size.z, 1e-6);
        root.position.sub(centre);
        const wrap = new THREE.Group();
        wrap.add(root);
        wrap.scale.setScalar(k);
        setScene(wrap);
        invalidate();
      } catch {
        if (alive) onError();
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, onError, invalidate]);
  return scene ? <primitive object={scene} /> : null;
}

function CameraRig({ view, nonce, controls }: { view: GadgetView; nonce: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
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

function Scene(props: GadgetViewerProps & { spin: boolean; onStart: () => void; onEnd: () => void; modelFailed: boolean; onModelError: () => void }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  return (
    <>
      <group rotation={[0, -0.3, 0]}>
        {props.modelUrl && !props.modelFailed ? (
          <ModelFile url={props.modelUrl} onError={props.onModelError} />
        ) : (
          <Model material={props.material} color={props.color} accent={props.accent} />
        )}
      </group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
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
        minDistance={2.2}
        maxDistance={6.5}
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

export default function GadgetViewer(props: GadgetViewerProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [spin, setSpin] = useState(!!props.autoRotate);
  const [hot, setHot] = useState(true);
  const cool = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modelFailed, setModelFailed] = useState(false);
  const onModelError = useCallback(() => setModelFailed(true), []);
  useEffect(() => {
    queueMicrotask(() => setModelFailed(false));
  }, [props.modelUrl]);
  useEffect(() => {
    if (!wrap.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  // showcase spin for a while, then only draw frames when something changes
  useEffect(() => {
    if (!spin) return;
    const t = setTimeout(() => setSpin(false), 25_000);
    return () => clearTimeout(t);
  }, [spin]);
  const keepAlive = (ms: number) => {
    setHot(true);
    if (cool.current) clearTimeout(cool.current);
    cool.current = setTimeout(() => setHot(false), ms);
  };
  useEffect(() => {
    queueMicrotask(() => keepAlive(1800));
  }, [props.view, props.viewNonce]);
  useEffect(() => () => void (cool.current && clearTimeout(cool.current)), []);
  return (
    <div ref={wrap} className="h-full w-full touch-none select-none">
      <Canvas
        frameloop={!visible ? "never" : spin || hot ? "always" : "demand"}
        dpr={[1, 2]}
        camera={{ position: VIEWS.angle, fov: 32, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
        aria-label="3D preview — drag to rotate"
      >
        <Scene
          {...props}
          modelFailed={modelFailed}
          onModelError={onModelError}
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
