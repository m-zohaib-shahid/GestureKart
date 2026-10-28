import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface RoadRepairHazardProps {
  position: [number, number, number]; // [laneX, Y, Z]
  cones: { id: string; offsetX: number; offsetZ: number; hit: boolean }[];
  laneName: 'LEFT' | 'CENTER' | 'RIGHT';
}

export function RoadRepairHazard({ position, cones, laneName }: RoadRepairHazardProps) {
  const amberBeaconRef = useRef<THREE.PointLight>(null);
  const amberMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    // Flashing amber construction beacon (2 Hz flash)
    const isFlashing = Math.floor(state.clock.elapsedTime * 4) % 2 === 0;
    if (amberBeaconRef.current) {
      amberBeaconRef.current.intensity = isFlashing ? 5.5 : 0.4;
    }
    if (amberMatRef.current) {
      amberMatRef.current.emissiveIntensity = isFlashing ? 4.5 : 0.2;
    }
  });

  return (
    <group position={position}>
      {/* 1. Flashing Construction Arrow Barricade Board at the start of zone */}
      <group position={[0, 0, 5.0]}>
        {/* Support A-Frame Legs */}
        <mesh position={[-1.1, 0.6, 0]} castShadow>
          <boxGeometry args={[0.08, 1.2, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
        <mesh position={[1.1, 0.6, 0]} castShadow>
          <boxGeometry args={[0.08, 1.2, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>

        {/* Diagonal Cross Braces */}
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.4, 0.45, 0.08]} />
          <meshStandardMaterial color="#ea580c" roughness={0.4} />
        </mesh>

        {/* Hazard Stripes (White & Orange) */}
        <mesh position={[0, 0.9, 0.05]}>
          <planeGeometry args={[2.3, 0.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>

        {/* Flashing Amber Warning LED Light */}
        <mesh position={[0, 1.35, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial
            ref={amberMatRef}
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={4.5}
            roughness={0.2}
          />
        </mesh>
        <pointLight
          ref={amberBeaconRef}
          position={[0, 1.4, 0.5]}
          color="#f59e0b"
          intensity={5.5}
          distance={18}
        />
      </group>

      {/* 2. Series of Highway Traffic Cones along the Hazard Lane */}
      {cones.map((cone) => (
        <group
          key={cone.id}
          position={[cone.offsetX, 0, cone.offsetZ]}
          rotation={cone.hit ? [0.4, 0.6, 1.2] : [0, 0, 0]}
        >
          {/* Cone Square Base */}
          <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.55, 0.06, 0.55]} />
            <meshStandardMaterial color="#ea580c" roughness={0.5} />
          </mesh>

          {/* Orange Cone Body */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.22, 0.85, 16]} />
            <meshStandardMaterial color="#f97316" roughness={0.35} />
          </mesh>

          {/* Retro-Reflective White Collar Band */}
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.13, 0.16, 0.22, 16]} />
            <meshStandardMaterial
              color="#f8fafc"
              emissive="#f8fafc"
              emissiveIntensity={1.2}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
