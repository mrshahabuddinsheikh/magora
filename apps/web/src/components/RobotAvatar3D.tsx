"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function CuteRobotMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const antennaGlowRef = useRef<THREE.MeshStandardMaterial>(null);

  const materials = useMemo(() => {
    return {
      body: new THREE.MeshPhysicalMaterial({
        color: "#f8fafc",
        roughness: 0.18,
        metalness: 0.12,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
      }),
      visor: new THREE.MeshPhysicalMaterial({
        color: "#0f172a",
        roughness: 0.05,
        metalness: 0.3,
        clearcoat: 1.0,
      }),
      cyanGlow: new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#00f0ff",
        emissiveIntensity: 2.8,
        roughness: 0.1,
      }),
      pinkAccent: new THREE.MeshPhysicalMaterial({
        color: "#f43f5e",
        emissive: "#f43f5e",
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
      earPods: new THREE.MeshStandardMaterial({
        color: "#6366f1",
        roughness: 0.3,
        metalness: 0.6,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        roughness: 0.2,
        metalness: 0.9,
      }),
      halo: new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#38bdf8",
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.65,
      }),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 1.8) * 0.2;
      headRef.current.rotation.x = Math.sin(t * 1.2) * 0.1;
      headRef.current.rotation.z = Math.sin(t * 1.5) * 0.05;
    }
    if (antennaGlowRef.current) {
      antennaGlowRef.current.emissiveIntensity = 2.0 + Math.sin(t * 5) * 1.2;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      {/* Subtle floating holographic ring beneath robot */}
      <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.halo}>
        <torusGeometry args={[0.75, 0.035, 16, 40]} />
      </mesh>

      {/* Head Group */}
      <group ref={headRef}>
        {/* Main Cute Head Sphere */}
        <mesh scale={[1.15, 1.05, 1.05]} material={materials.body}>
          <sphereGeometry args={[0.78, 32, 28]} />
        </mesh>

        {/* OLED Glass Visor Faceplate */}
        <mesh position={[0, 0.05, 0.46]} scale={[1.05, 0.85, 0.65]} material={materials.visor}>
          <sphereGeometry args={[0.55, 32, 20]} />
        </mesh>

        {/* Glowing Digital Cyan Eyes */}
        {[-0.22, 0.22].map((x, i) => (
          <group key={i} position={[x, 0.08, 0.77]}>
            {/* Eye shape: pill / rounded oval */}
            <mesh scale={[1.2, 1.5, 0.5]} material={materials.cyanGlow}>
              <sphereGeometry args={[0.075, 20, 16]} />
            </mesh>
          </group>
        ))}

        {/* Cute blushing cheeks */}
        {[-0.32, 0.32].map((x, i) => (
          <mesh key={i} position={[x, -0.12, 0.68]} material={materials.pinkAccent}>
            <circleGeometry args={[0.065, 16]} />
          </mesh>
        ))}

        {/* Top Antenna Pole & Glowing Tip */}
        <mesh position={[0, 0.98, 0]} material={materials.metal}>
          <cylinderGeometry args={[0.032, 0.045, 0.32, 16]} />
        </mesh>
        <mesh position={[0, 1.18, 0]}>
          <sphereGeometry args={[0.11, 24, 20]} />
          <primitive object={materials.cyanGlow} ref={antennaGlowRef} attach="material" />
        </mesh>

        {/* Side Earphone Pods (Left & Right) */}
        {[-1, 1].map((dir, i) => (
          <group key={i} position={[dir * 0.88, 0.02, 0]} rotation={[0, 0, dir * (Math.PI / 2)]}>
            {/* Base cylinder */}
            <mesh material={materials.earPods}>
              <cylinderGeometry args={[0.26, 0.26, 0.18, 24]} />
            </mesh>
            {/* Glowing outer ring */}
            <mesh position={[0, 0.1, 0]} material={materials.cyanGlow}>
              <torusGeometry args={[0.2, 0.03, 12, 24]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function RobotAvatar3D({ size = 76 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="pointer-events-none relative select-none drop-shadow-[0_12px_24px_rgba(56,189,248,0.45)]"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0.2, 3.2], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 4]} intensity={1.8} />
        <directionalLight position={[-2, -1, 2]} intensity={0.6} color="#60a5fa" />
        <pointLight position={[0, 1.5, 1]} intensity={2.2} color="#00f0ff" distance={3} />
        <Float speed={2.5} rotationIntensity={0.2} floatIntensity={0.6}>
          <CuteRobotMesh />
        </Float>
      </Canvas>
    </div>
  );
}
