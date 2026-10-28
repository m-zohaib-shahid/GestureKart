import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface CarModelProps {
  steerOffset: number;
  isStopping: boolean;
  speedKmH: number;
}

export function CarModel({ steerOffset, isStopping, speedKmH }: CarModelProps) {
  const frontLeftWheelRef = useRef<THREE.Group>(null);
  const frontRightWheelRef = useRef<THREE.Group>(null);
  const rearLeftWheelRef = useRef<THREE.Mesh>(null);
  const rearRightWheelRef = useRef<THREE.Mesh>(null);
  const brakeLightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const brakePointLightRef = useRef<THREE.PointLight>(null);
  const leftHeadlightTargetRef = useRef<THREE.Object3D>(null);
  const rightHeadlightTargetRef = useRef<THREE.Object3D>(null);
  const tailStreakLeftRef = useRef<THREE.Mesh>(null);
  const tailStreakRightRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const rollSpeed = (speedKmH / 3.6) * delta * 3.5;

    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.y = -steerOffset * 0.42;
    }
    if (frontRightWheelRef.current) {
      frontRightWheelRef.current.rotation.y = -steerOffset * 0.42;
    }

    if (rearLeftWheelRef.current) {
      rearLeftWheelRef.current.rotation.x += rollSpeed;
    }
    if (rearRightWheelRef.current) {
      rearRightWheelRef.current.rotation.x += rollSpeed;
    }

    // Dynamic brake light emission and point light intensity
    const targetBrakeIntensity = isStopping ? 5.5 : 1.2;
    if (brakeLightMatRef.current) {
      brakeLightMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        brakeLightMatRef.current.emissiveIntensity,
        targetBrakeIntensity,
        0.25
      );
    }

    if (brakePointLightRef.current) {
      const targetLight = isStopping ? 6.0 : 1.5;
      brakePointLightRef.current.intensity = THREE.MathUtils.lerp(
        brakePointLightRef.current.intensity,
        targetLight,
        0.25
      );
    }

    // Dynamic GTA/NFS Red Tail-light light streaks that stretch with velocity
    const streakLength = Math.max(0.6, (speedKmH / 80) * 3.2);
    if (tailStreakLeftRef.current) {
      tailStreakLeftRef.current.scale.z = streakLength;
      tailStreakLeftRef.current.position.z = -2.15 - streakLength * 0.5;
    }
    if (tailStreakRightRef.current) {
      tailStreakRightRef.current.scale.z = streakLength;
      tailStreakRightRef.current.position.z = -2.15 - streakLength * 0.5;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Dynamic Forward Xenon Headlights casting onto Wet Asphalt */}
      <object3D ref={leftHeadlightTargetRef} position={[-0.8, -0.4, 34]} />
      <object3D ref={rightHeadlightTargetRef} position={[0.8, -0.4, 34]} />

      {/* Left Projected Headlight */}
      {leftHeadlightTargetRef.current && (
        <spotLight
          position={[-0.7, 0.45, 2.2]}
          target={leftHeadlightTargetRef.current}
          angle={0.38}
          penumbra={0.7}
          intensity={6.5}
          distance={48}
          color="#f8fafc"
          castShadow
        />
      )}

      {/* Right Projected Headlight */}
      {rightHeadlightTargetRef.current && (
        <spotLight
          position={[0.7, 0.45, 2.2]}
          target={rightHeadlightTargetRef.current}
          angle={0.38}
          penumbra={0.7}
          intensity={6.5}
          distance={48}
          color="#f8fafc"
          castShadow
        />
      )}

      {/* Subtle Volumetric Headlight Dust / Fog Cones */}
      <group position={[-0.7, 0.45, 2.3]} rotation={[Math.PI / 2 + 0.03, 0, 0]}>
        <mesh position={[0, 8.5, 0]}>
          <cylinderGeometry args={[1.3, 0.15, 17, 16, 1, true]} />
          <meshBasicMaterial
            color="#e2e8f0"
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group position={[0.7, 0.45, 2.3]} rotation={[Math.PI / 2 + 0.03, 0, 0]}>
        <mesh position={[0, 8.5, 0]}>
          <cylinderGeometry args={[1.3, 0.15, 17, 16, 1, true]} />
          <meshBasicMaterial
            color="#e2e8f0"
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Rear Red Taillight Wet Ground Reflection Light */}
      <pointLight
        ref={brakePointLightRef}
        position={[0, 0.4, -2.4]}
        color="#ef4444"
        intensity={isStopping ? 6.0 : 1.5}
        distance={12}
      />

      {/* Dynamic Red Taillight Streaks (Need for Speed / GTA Night Long-Exposure Style) */}
      <mesh
        ref={tailStreakLeftRef}
        position={[-0.7, 0.5, -2.4]}
        rotation={[0, 0, 0]}
      >
        <boxGeometry args={[0.08, 0.04, 1]} />
        <meshBasicMaterial
          color="#ff1744"
          transparent
          opacity={speedKmH > 15 ? 0.75 : 0.25}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={tailStreakRightRef}
        position={[0.7, 0.5, -2.4]}
        rotation={[0, 0, 0]}
      >
        <boxGeometry args={[0.08, 0.04, 1]} />
        <meshBasicMaterial
          color="#ff1744"
          transparent
          opacity={speedKmH > 15 ? 0.75 : 0.25}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Main Aerodynamic Chassis: Deep Midnight Graphite Metallic (GTA V Sports Car Finish) */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.45, 4.2]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.88}
          roughness={0.22}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Front Nose Hood Slope */}
      <mesh position={[0, 0.35, 1.85]} rotation={[0.2, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.3, 1.0]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.88}
          roughness={0.2}
        />
      </mesh>

      {/* Matte Carbon Fiber Splitter */}
      <mesh position={[0, 0.18, 1.6]} castShadow>
        <boxGeometry args={[2.0, 0.08, 1.4]} />
        <meshStandardMaterial
          color="#0a0e17"
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>

      {/* 3. Cockpit Tinted Smoked Glass */}
      <mesh position={[0, 0.85, -0.2]} castShadow>
        <boxGeometry args={[1.4, 0.5, 2.0]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.06}
          metalness={0.92}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Roof Vent */}
      <mesh position={[0, 1.15, -0.3]} castShadow>
        <boxGeometry args={[0.5, 0.15, 0.9]} />
        <meshStandardMaterial color="#0a0e17" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* 4. Rear GT Wing / Spoiler */}
      <group position={[0, 0.95, -1.9]}>
        <mesh castShadow>
          <boxGeometry args={[2.1, 0.08, 0.5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[-0.7, -0.25, 0]}>
          <boxGeometry args={[0.08, 0.5, 0.2]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
        <mesh position={[0.7, -0.25, 0]}>
          <boxGeometry args={[0.08, 0.5, 0.2]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
      </group>

      {/* 5. Headlights: Crisp Modern Xenon LED Fixtures */}
      <mesh position={[-0.7, 0.45, 2.25]}>
        <boxGeometry args={[0.35, 0.14, 0.1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3.5}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0.7, 0.45, 2.25]}>
        <boxGeometry args={[0.35, 0.14, 0.1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3.5}
          roughness={0.1}
        />
      </mesh>

      {/* 6. Rear Taillight Cluster (Realistic Red LED Bars) */}
      <mesh position={[-0.7, 0.5, -2.12]}>
        <boxGeometry args={[0.45, 0.14, 0.05]} />
        <meshStandardMaterial
          ref={brakeLightMatRef}
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={isStopping ? 5.5 : 1.2}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0.7, 0.5, -2.12]}>
        <boxGeometry args={[0.45, 0.14, 0.05]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={isStopping ? 5.5 : 1.2}
          roughness={0.2}
        />
      </mesh>

      {/* High-mount Center Third Brake Light */}
      <mesh position={[0, 0.72, -2.0]}>
        <boxGeometry args={[1.0, 0.05, 0.05]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={isStopping ? 5.5 : 1.0}
        />
      </mesh>

      {/* Chrome Dual Exhaust Tips */}
      <mesh position={[-0.45, 0.3, -2.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.45, 0.3, -2.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* 7. Wheels & Realistic Gunmetal Alloy Rims */}
      <group ref={frontLeftWheelRef} position={[-1.02, 0.35, 1.25]}>
        {/* Rubber Tire */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.32, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.1} />
        </mesh>
        {/* Alloy Rim */}
        <mesh position={[-0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      <group ref={frontRightWheelRef} position={[1.02, 0.35, 1.25]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.32, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.1} />
        </mesh>
        <mesh position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* Rear Wheels */}
      <mesh
        ref={rearLeftWheelRef}
        position={[-1.02, 0.38, -1.25]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.42, 0.42, 0.35, 24]} />
        <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.1} />
      </mesh>

      <mesh
        ref={rearRightWheelRef}
        position={[1.02, 0.38, -1.25]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.42, 0.42, 0.35, 24]} />
        <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Ambient Occlusion Ground Contact Shadow */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 4.8]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
