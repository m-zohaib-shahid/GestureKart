import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface AmbulanceVehicleProps {
  position: [number, number, number];
  isYieldingPlayerAhead: boolean;
}

export function AmbulanceVehicle({ position, isYieldingPlayerAhead }: AmbulanceVehicleProps) {
  const redStrobeRef = useRef<THREE.PointLight>(null);
  const blueStrobeRef = useRef<THREE.PointLight>(null);
  const redMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const blueMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    // High-frequency emergency alternating strobe (10 Hz strobe flash)
    const t = state.clock.elapsedTime * 12;
    const isRedPhase = Math.floor(t) % 2 === 0;

    if (redStrobeRef.current && blueStrobeRef.current) {
      redStrobeRef.current.intensity = isRedPhase ? 8.0 : 0.2;
      blueStrobeRef.current.intensity = !isRedPhase ? 8.0 : 0.2;
    }

    if (redMatRef.current && blueMatRef.current) {
      redMatRef.current.emissiveIntensity = isRedPhase ? 7.0 : 0.4;
      blueMatRef.current.emissiveIntensity = !isRedPhase ? 7.0 : 0.4;
    }
  });

  return (
    <group position={position}>
      {/* 1. Main High-Roof Ambulance Body (Heavy-Duty Emergency Van) */}
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 1.9, 5.4]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Front Cab Nose */}
      <mesh position={[0, 0.7, 2.8]} castShadow>
        <boxGeometry args={[2.2, 0.9, 1.2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Sloped Windshield */}
      <mesh position={[0, 1.45, 2.35]} rotation={[0.4, 0, 0]} castShadow>
        <boxGeometry args={[2.0, 0.8, 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} transparent opacity={0.85} />
      </mesh>

      {/* Side Tinted Medical Windows */}
      <mesh position={[-1.16, 1.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 0.7]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[1.16, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 0.7]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* 2. High-Visibility Emergency Chevron Stripes (Red & Safety Green Battenburg) */}
      <mesh position={[-1.16, 0.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[5.2, 0.45]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      <mesh position={[1.16, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5.2, 0.45]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>

      {/* Rear High-Vis Chevrons */}
      <mesh position={[0, 0.9, -2.71]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshStandardMaterial color="#eab308" roughness={0.4} />
      </mesh>

      {/* 3. Roof Emergency Strobe Lightbar (Dual Red & Blue High-Output Flashers) */}
      <group position={[0, 2.3, 1.2]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.18, 0.45]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {/* Left Red Strobe Lens */}
        <mesh position={[-0.55, 0.08, 0]}>
          <boxGeometry args={[0.65, 0.18, 0.35]} />
          <meshStandardMaterial
            ref={redMatRef}
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={5.0}
            roughness={0.1}
          />
        </mesh>

        {/* Right Blue Strobe Lens */}
        <mesh position={[0.55, 0.08, 0]}>
          <boxGeometry args={[0.65, 0.18, 0.35]} />
          <meshStandardMaterial
            ref={blueMatRef}
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={5.0}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* Rear Roof Secondary Warning Strobes */}
      <group position={[0, 2.3, -2.5]}>
        <mesh position={[-0.7, 0, 0]}>
          <boxGeometry args={[0.4, 0.15, 0.2]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={4.0} />
        </mesh>
        <mesh position={[0.7, 0, 0]}>
          <boxGeometry args={[0.4, 0.15, 0.2]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={4.0} />
        </mesh>
      </group>

      {/* Dynamic Red & Blue Light Flashing Pools casting onto Wet Street */}
      <pointLight
        ref={redStrobeRef}
        position={[-0.9, 2.4, 1.2]}
        color="#ef4444"
        intensity={6.0}
        distance={28}
        decay={1.8}
      />
      <pointLight
        ref={blueStrobeRef}
        position={[0.9, 2.4, 1.2]}
        color="#3b82f6"
        intensity={6.0}
        distance={28}
        decay={1.8}
      />

      {/* 4. Powerful Forward High-Beam Headlights */}
      <mesh position={[-0.8, 0.65, 3.42]}>
        <boxGeometry args={[0.35, 0.2, 0.1]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4.0} />
      </mesh>
      <mesh position={[0.8, 0.65, 3.42]}>
        <boxGeometry args={[0.35, 0.2, 0.1]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4.0} />
      </mesh>
      <pointLight position={[0, 0.8, 4.0]} color="#ffffff" intensity={4.5} distance={35} />

      {/* 5. Heavy-Duty Dual Axle Wheels */}
      {/* Front Wheels */}
      <mesh position={[-1.15, 0.45, 2.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.35, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>
      <mesh position={[1.15, 0.45, 2.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.35, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>

      {/* Rear Wheels */}
      <mesh position={[-1.15, 0.45, -1.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.38, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>
      <mesh position={[1.15, 0.45, -1.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.38, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>

      {/* Contact Ground Shadow */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 6.0]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}
