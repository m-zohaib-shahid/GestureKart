import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CarModel } from './CarModel';
import { sound } from '../../utils/audio';

interface CarControllerProps {
  steerOffset: number; // -1.0 to 1.0
  isStopping: boolean;
  onUpdateStats: (speed: number, currentZ: number, carX: number) => void;
  isPaused?: boolean;
}

const MAX_LANE_X = 5.2; // Width of 3-lane road
const TOP_SPEED_KMH = 80.0; // Cruise speed tuned for 0-100 KM/H gauge

export function CarController({
  steerOffset,
  isStopping,
  onUpdateStats,
  isPaused = false,
}: CarControllerProps) {
  const carRef = useRef<THREE.Group>(null);
  const speedRef = useRef<number>(0);
  const distanceRef = useRef<number>(0);
  const wasStoppingRef = useRef<boolean>(false);

  useFrame((state, delta) => {
    if (!carRef.current) return;

    // Guard delta against anomalous jumps or NaN
    const dt = Math.min(Math.max(delta, 0.001), 0.1);

    if (isPaused) {
      speedRef.current = THREE.MathUtils.lerp(speedRef.current, 0, dt * 10);
      sound.updateEngine(0);
      onUpdateStats(0, carRef.current.position.z, carRef.current.position.x);

      // Keep camera smoothly looking at the car without freezing
      const carPos = carRef.current.position;
      const camera = state.camera;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, carPos.x * 0.55, 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.6, 0.05);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, carPos.z + 7.8, 0.05);
      camera.lookAt(carPos.x * 0.35, 1.4, carPos.z - 18);
      return;
    }

    // 1. Calculate Dynamic Acceleration & Deceleration
    const targetSpeed = isStopping ? 0 : TOP_SPEED_KMH;
    const accelRate = isStopping ? 9.5 : 3.8; // Fast, responsive braking; smooth acceleration

    speedRef.current = THREE.MathUtils.lerp(speedRef.current, targetSpeed, dt * accelRate);
    if (isStopping && speedRef.current < 0.8) {
      speedRef.current = 0;
    }

    // Play brake sound when brake is engaged while moving fast
    if (isStopping && !wasStoppingRef.current && speedRef.current > 15) {
      sound.playBrake();
    }
    wasStoppingRef.current = isStopping;

    // Update procedural engine sound pitch and volume
    sound.updateEngine(speedRef.current);

    // 2. Forward Motion (travel along -Z axis)
    const metersPerSec = speedRef.current / 3.6;
    const forwardDistance = metersPerSec * dt;
    carRef.current.position.z -= forwardDistance;
    distanceRef.current += forwardDistance;

    // 3. Smooth Steering (Lerp X position within road bounds)
    const targetX = steerOffset * MAX_LANE_X;
    carRef.current.position.x = THREE.MathUtils.lerp(
      carRef.current.position.x,
      targetX,
      0.15
    );

    // Dynamic car chassis roll and yaw during steering turns
    const targetRoll = -steerOffset * 0.09;
    const targetYaw = -steerOffset * 0.14;
    carRef.current.rotation.z = THREE.MathUtils.lerp(carRef.current.rotation.z, targetRoll, 0.12);
    carRef.current.rotation.y = THREE.MathUtils.lerp(carRef.current.rotation.y, targetYaw, 0.12);

    // Subtle road vibration pitch when driving
    if (speedRef.current > 10) {
      carRef.current.position.y = Math.sin(state.clock.elapsedTime * 28) * 0.015;
    } else {
      carRef.current.position.y = 0;
    }

    // 4. Smooth Third-Person Chase Camera
    const carPos = carRef.current.position;
    const camera = state.camera;

    const camTargetX = carPos.x * 0.55;
    const camTargetY = 3.6;
    const camTargetZ = carPos.z + 7.8;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.1);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.1);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, camTargetZ, 0.18);

    // Look ahead of the car down the highway
    camera.lookAt(carPos.x * 0.35, 1.4, carPos.z - 18);

    // 5. Notify parent of speed, Z coordinate, and X lane position
    onUpdateStats(speedRef.current, carPos.z, carPos.x);
  });

  return (
    <group ref={carRef} position={[0, 0, 0]}>
      <CarModel
        steerOffset={steerOffset}
        isStopping={isStopping}
        speedKmH={speedRef.current}
      />
    </group>
  );
}
