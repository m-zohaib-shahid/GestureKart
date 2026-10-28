import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { CarController } from './CarController';
import { AmbulanceVehicle } from './AmbulanceVehicle';
import { RoadRepairHazard } from './RoadRepairHazard';
import { TrafficSignal, SignalColor, AmbulanceEventState, RoadHazardZone } from '../../types/game';
import { sound } from '../../utils/audio';

interface RoadSceneProps {
  steerOffset: number;
  isStopping: boolean;
  onStatsUpdate: (stats: {
    speedKmH: number;
    distance: number;
    nextSignalDist: number;
    nextSignalState: SignalColor;
    nextSignalTimer: number;
    ambulanceEvent: AmbulanceEventState | null;
  }) => void;
  onScoreEvent: (text: string, points: number, type: 'positive' | 'negative' | 'neutral', category?: string) => void;
  isPaused?: boolean;
}

const ROAD_SEGMENT_LENGTH = 120;
const ROAD_SEGMENTS_COUNT = 6;
const SIGNAL_INTERVAL = 200;
const ROAD_WIDTH = 13.5;

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

interface BuildingDef {
  name: string;
  zOffset: number;
  xDist: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  metalness: number;
  roughness: number;
  hasBillboard?: boolean;
  billboardText?: string;
}

const LEFT_BUILDINGS: BuildingDef[] = [
  {
    name: 'Commercial Plaza',
    zOffset: -16,
    xDist: 23,
    width: 20,
    depth: 18,
    height: 72,
    bodyColor: '#1e293b',
    metalness: 0.35,
    roughness: 0.65,
    hasBillboard: true,
    billboardText: 'CANAL EXPRESSWAY',
  },
  {
    name: 'Modern Glass Tower',
    zOffset: -46,
    xDist: 26,
    width: 22,
    depth: 20,
    height: 95,
    bodyColor: '#0f172a',
    metalness: 0.6,
    roughness: 0.3,
  },
  {
    name: 'Urban Suites',
    zOffset: -76,
    xDist: 24,
    width: 19,
    depth: 19,
    height: 64,
    bodyColor: '#27272a',
    metalness: 0.2,
    roughness: 0.8,
  },
  {
    name: 'Financial Centre',
    zOffset: -106,
    xDist: 27,
    width: 24,
    depth: 22,
    height: 84,
    bodyColor: '#18181b',
    metalness: 0.45,
    roughness: 0.5,
    hasBillboard: true,
    billboardText: 'LAHORE CIVIC 60 KM/H',
  },
];

const RIGHT_BUILDINGS: BuildingDef[] = [
  {
    name: 'Corporate HQ',
    zOffset: -18,
    xDist: 24,
    width: 21,
    depth: 19,
    height: 88,
    bodyColor: '#111827',
    metalness: 0.5,
    roughness: 0.4,
  },
  {
    name: 'Granite High-Rise',
    zOffset: -48,
    xDist: 25,
    width: 20,
    depth: 20,
    height: 68,
    bodyColor: '#1e293b',
    metalness: 0.25,
    roughness: 0.7,
    hasBillboard: true,
    billboardText: 'DRIVE SAFELY',
  },
  {
    name: 'Metropolitan Spire',
    zOffset: -78,
    xDist: 28,
    width: 23,
    depth: 21,
    height: 102,
    bodyColor: '#090d16',
    metalness: 0.7,
    roughness: 0.25,
  },
  {
    name: 'Parkview Towers',
    zOffset: -108,
    xDist: 24,
    width: 22,
    depth: 20,
    height: 76,
    bodyColor: '#27272a',
    metalness: 0.3,
    roughness: 0.65,
  },
];

const TREE_Z_OFFSETS = [8, 24, 40, 56, 72, 88, 104];

export function RoadScene({
  steerOffset,
  isStopping,
  onStatsUpdate,
  onScoreEvent,
  isPaused = false,
}: RoadSceneProps) {
  // 1. Procedural Traffic Signals
  const [signals, setSignals] = useState<TrafficSignal[]>(() => {
    const initialSignals: TrafficSignal[] = [];
    for (let i = 1; i <= 15; i++) {
      const z = -i * SIGNAL_INTERVAL;
      const phaseOffset = i % 3;
      const initialColor: SignalColor = phaseOffset === 1 ? 'RED' : phaseOffset === 2 ? 'YELLOW' : 'GREEN';
      initialSignals.push({
        id: `sig-${i}`,
        z,
        state: initialColor,
        timeRemaining: initialColor === 'RED' ? 7.5 : initialColor === 'YELLOW' ? 3 : 9,
        totalCycleTime: 19.5,
        isEvaluated: false,
        safeStopped: false,
      });
    }
    return initialSignals;
  });

  // 2. Procedural Road Repair Hazard Zones (Lahore Canal Road Construction Zones)
  const [hazardZones, setHazardZones] = useState<RoadHazardZone[]>(() => {
    const zones: RoadHazardZone[] = [];
    const laneConfigs: { laneX: number; name: 'LEFT' | 'CENTER' | 'RIGHT' }[] = [
      { laneX: -3.2, name: 'LEFT' },
      { laneX: 3.2, name: 'RIGHT' },
      { laneX: 0.0, name: 'CENTER' },
      { laneX: -3.2, name: 'LEFT' },
      { laneX: 3.2, name: 'RIGHT' },
    ];

    for (let i = 1; i <= 14; i++) {
      const z = -i * 145 + 30;
      const lane = laneConfigs[(i - 1) % laneConfigs.length];
      const cones = [
        { id: `c-${i}-1`, offsetX: 0, offsetZ: 3.5, hit: false },
        { id: `c-${i}-2`, offsetX: -0.35, offsetZ: 1.8, hit: false },
        { id: `c-${i}-3`, offsetX: 0.35, offsetZ: 0.0, hit: false },
        { id: `c-${i}-4`, offsetX: 0, offsetZ: -1.8, hit: false },
      ];
      zones.push({
        id: `hazard-${i}`,
        z,
        laneX: lane.laneX,
        laneName: lane.name,
        cones,
        cleared: false,
      });
    }
    return zones;
  });

  // 3. Dynamic Emergency Ambulance Event State
  const [ambulanceState, setAmbulanceState] = useState<AmbulanceEventState | null>(null);

  const carZRef = useRef<number>(0);
  const carXRef = useRef<number>(0);
  const speedRef = useRef<number>(0);
  const laneDisciplineTimerRef = useRef<number>(0);
  const ambulanceTimerRef = useRef<number>(0);
  const roadSegmentsRef = useRef<THREE.Group[]>([]);

  // Ambulance spawn loop: trigger first at 25s, then every ~45-55s
  useFrame((_, delta) => {
    if (isPaused) return;
    const dt = Math.min(Math.max(delta, 0.001), 0.1);
    const currentZ = carZRef.current;
    const currentCarX = carXRef.current;

    ambulanceTimerRef.current += dt;

    // Check if it's time to trigger an ambulance event
    if (!ambulanceState) {
      const shouldTrigger = ambulanceTimerRef.current >= 26;
      if (shouldTrigger && Math.abs(currentZ) > 80) {
        ambulanceTimerRef.current = 0;
        sound.startSiren();

        const initialLane = currentCarX;
        setAmbulanceState({
          active: true,
          z: currentZ + 58, // Spawns 58 meters behind player car
          laneX: initialLane,
          initialPlayerLaneX: initialLane,
          speedKmH: 115, // Overtaking speed
          distanceToPlayer: 58,
          timeLeft: 3.8,
          hasEvaluated: false,
          hasPassed: false,
          result: null,
        });

        onScoreEvent('AMBULANCE APPROACHING! YIELD LANE IMMEDIATELY!', 0, 'neutral', 'AMBULANCE_ALERT');
      }
    } else if (ambulanceState.active) {
      // Advance ambulance faster than player along -Z axis
      const metersPerSec = (ambulanceState.speedKmH / 3.6);
      const newZ = ambulanceState.z - metersPerSec * dt;
      const distToPlayer = currentZ - newZ; // Positive when ambulance is behind player
      const newTimeLeft = Math.max(0, ambulanceState.timeLeft - dt);

      // Check yield evaluation as ambulance catches up to the player
      if (!ambulanceState.hasEvaluated && distToPlayer <= 2.2) {
        // Player has yielded if they moved at least 1.6 units away from the ambulance lane
        const hasClearedLane = Math.abs(currentCarX - ambulanceState.laneX) >= 1.6;

        if (hasClearedLane) {
          // SUCCESSFUL YIELD
          sound.stopSiren();
          sound.playYieldSuccess();
          onScoreEvent('EMERGENCY YIELD BONUS! +200 PTS', 200, 'positive', 'YIELD_BONUS');
          setAmbulanceState((prev) =>
            prev ? { ...prev, hasEvaluated: true, result: 'SUCCESS' } : null
          );
        } else {
          // FAILED YIELD
          sound.playYieldPenalty();
          onScoreEvent('BLOCKED EMERGENCY VEHICLE! -150 PTS', -150, 'negative', 'YIELD_FAIL');
          // Ambulance steers around the blocking player
          const bypassLane = ambulanceState.laneX > 0 ? ambulanceState.laneX - 3.2 : ambulanceState.laneX + 3.2;
          setAmbulanceState((prev) =>
            prev ? { ...prev, hasEvaluated: true, laneX: bypassLane, result: 'FAILED' } : null
          );
        }
      }

      // Check if ambulance has raced far ahead into distance
      if (newZ < currentZ - 75) {
        sound.stopSiren();
        setAmbulanceState(null); // Reset for next event cycle
      } else {
        setAmbulanceState((prev) =>
          prev
            ? {
                ...prev,
                z: newZ,
                distanceToPlayer: Math.max(0, Math.round(distToPlayer)),
                timeLeft: newTimeLeft,
                hasPassed: distToPlayer <= 0,
              }
            : null
        );
      }
    }
  });

  // Traffic Signal & Hazard Cones Collision Loop
  useFrame((_, delta) => {
    if (isPaused) return;
    const dt = Math.min(Math.max(delta, 0.001), 0.1);
    const currentZ = carZRef.current;
    const currentSpeed = speedRef.current;
    const currentCarX = carXRef.current;

    // Traffic Signal Timer Updates
    setSignals((prevSignals) => {
      let changed = false;
      const updated = prevSignals.map((sig) => {
        let newTimer = sig.timeRemaining - dt;
        let newState = sig.state;

        if (newTimer <= 0) {
          changed = true;
          if (sig.state === 'GREEN') {
            newState = 'YELLOW';
            newTimer = 3.0;
          } else if (sig.state === 'YELLOW') {
            newState = 'RED';
            newTimer = 7.5;
          } else {
            newState = 'GREEN';
            newTimer = 9.0;
          }
        }

        return {
          ...sig,
          state: newState,
          timeRemaining: newTimer,
        };
      });

      return changed ? updated : prevSignals;
    });

    // Traffic Signal Compliance
    setSignals((prevSignals) => {
      let signalStateUpdated = false;
      const updated = prevSignals.map((sig) => {
        const distToStopLine = currentZ - (sig.z + 4);

        if (
          sig.state === 'RED' &&
          !sig.safeStopped &&
          distToStopLine > 0 &&
          distToStopLine < 18 &&
          currentSpeed < 4 &&
          isStopping
        ) {
          sig.safeStopped = true;
          signalStateUpdated = true;
          sound.playSafeStop();
          onScoreEvent('SAFE STOP AT ZEBRA LINE!', 150, 'positive', 'SAFE_STOP');
        }

        if (
          sig.state === 'RED' &&
          !sig.isEvaluated &&
          !sig.safeStopped &&
          distToStopLine <= 0 &&
          distToStopLine > -18 &&
          currentSpeed > 8
        ) {
          sig.isEvaluated = true;
          signalStateUpdated = true;
          sound.playViolation();
          onScoreEvent('RED LIGHT VIOLATION! -200 PTS', -200, 'negative', 'RED_LIGHT');
        }

        return sig;
      });

      return signalStateUpdated ? [...updated] : prevSignals;
    });

    // Road Repair Cone Collision Detection
    setHazardZones((prevZones) => {
      let zonesModified = false;
      const updatedZones = prevZones.map((zone) => {
        const distZ = currentZ - zone.z;

        // Check if car is within zone range
        if (Math.abs(distZ) < 8.0) {
          let coneHitOccurred = false;
          const updatedCones = zone.cones.map((cone) => {
            if (cone.hit) return cone;

            const coneWorldX = zone.laneX + cone.offsetX;
            const coneWorldZ = zone.z + cone.offsetZ;
            const dx = Math.abs(currentCarX - coneWorldX);
            const dz = Math.abs(currentZ - coneWorldZ);

            if (dx < 0.95 && dz < 1.3) {
              coneHitOccurred = true;
              return { ...cone, hit: true };
            }
            return cone;
          });

          if (coneHitOccurred) {
            zonesModified = true;
            sound.playConeHit();
            onScoreEvent('CONE STRUCK! -50 PTS', -50, 'negative', 'CONE_HIT');
            return { ...zone, cones: updatedCones };
          }
        }

        // Check if player evaded cleanly
        if (!zone.cleared && currentZ < zone.z - 12) {
          const anyConeHit = zone.cones.some((c) => c.hit);
          if (!anyConeHit && Math.abs(currentZ - zone.z) < 25) {
            zonesModified = true;
            onScoreEvent('HAZARD EVADED CLEANLY! +30', 30, 'positive', 'HAZARD_CLEARED');
            return { ...zone, cleared: true };
          }
        }

        return zone;
      });

      return zonesModified ? updatedZones : prevZones;
    });

    // Lane discipline scoring ticks
    if (currentSpeed > 15 && Math.abs(carXRef.current) < 4.8) {
      laneDisciplineTimerRef.current += dt;
      if (laneDisciplineTimerRef.current >= 1.6) {
        laneDisciplineTimerRef.current = 0;
        sound.playLaneBonus();
        onScoreEvent('LANE DISCIPLINE +10', 10, 'neutral', 'LANE');
      }
    } else {
      laneDisciplineTimerRef.current = 0;
    }

    // Procedural infinite road segment cycling
    roadSegmentsRef.current.forEach((segment, idx) => {
      if (!segment) return;
      const totalRoadSpan = ROAD_SEGMENTS_COUNT * ROAD_SEGMENT_LENGTH;
      const baseOffset = -Math.floor((-currentZ + ROAD_SEGMENT_LENGTH) / totalRoadSpan) * totalRoadSpan;
      let targetZ = -idx * ROAD_SEGMENT_LENGTH + baseOffset;
      if (targetZ > currentZ + ROAD_SEGMENT_LENGTH) {
        targetZ -= totalRoadSpan;
      }
      segment.position.z = targetZ;
    });
  });

  const handleCarStats = (speed: number, currentZ: number, carX: number) => {
    carZRef.current = currentZ;
    carXRef.current = carX;
    speedRef.current = speed;

    const totalDistance = Math.max(0, -currentZ);
    const upcomingSignal = signals.find((s) => s.z < currentZ + 5);

    let nextDist = 0;
    let nextColor: SignalColor = 'GREEN';
    let nextTimer = 0;

    if (upcomingSignal) {
      nextDist = Math.max(0, currentZ - upcomingSignal.z);
      nextColor = upcomingSignal.state;
      nextTimer = Math.max(0, upcomingSignal.timeRemaining);
    }

    onStatsUpdate({
      speedKmH: speed,
      distance: totalDistance,
      nextSignalDist: nextDist,
      nextSignalState: nextColor,
      nextSignalTimer: nextTimer,
      ambulanceEvent: ambulanceState,
    });
  };

  // Clean up audio siren on unmount
  useEffect(() => {
    return () => {
      sound.stopSiren();
    };
  }, []);

  const roadDashes = useMemo(() => {
    const dashes: number[] = [];
    for (let z = 0; z < ROAD_SEGMENT_LENGTH; z += 6.5) {
      dashes.push(z);
    }
    return dashes;
  }, []);

  return (
    <>
      {/* 1. CINEMATIC LIGHTING & GTA NIGHT ATMOSPHERE */}
      <ambientLight intensity={0.9} color="#1e293b" />

      <directionalLight
        position={[45, 95, -35]}
        intensity={1.25}
        color="#94a3b8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0004}
      />

      <hemisphereLight args={['#475569', '#0d1117', 0.85]} />
      <fogExp2 attach="fog" args={['#0d1117', 0.0135]} />

      {/* 2. Night Skybox & Smog */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[480, 24, 24]} />
        <meshBasicMaterial color="#080c14" side={THREE.BackSide} />
      </mesh>

      <mesh position={[0, -20, 0]}>
        <cylinderGeometry args={[460, 460, 90, 24, 1, true]} />
        <meshBasicMaterial color="#111827" side={THREE.BackSide} transparent opacity={0.4} />
      </mesh>

      {/* 3. Player Car Controller */}
      <CarController
        steerOffset={steerOffset}
        isStopping={isStopping}
        onUpdateStats={handleCarStats}
        isPaused={isPaused}
      />

      {/* 4. Dynamic Emergency Ambulance Vehicle (Spawns during Yield Event) */}
      {ambulanceState && ambulanceState.active && (
        <AmbulanceVehicle
          position={[ambulanceState.laneX, 0, ambulanceState.z]}
          isYieldingPlayerAhead={ambulanceState.result === 'SUCCESS'}
        />
      )}

      {/* 5. Lahore Canal Road Repair Hazard Zones (Traffic Cones & Flashing Barricades) */}
      {hazardZones.map((zone) => (
        <RoadRepairHazard
          key={zone.id}
          position={[zone.laneX, 0, zone.z]}
          cones={zone.cones}
          laneName={zone.laneName}
        />
      ))}

      {/* 6. Looping Highway Segments with Wet Asphalt, Roadside Trees & Streetlights */}
      {Array.from({ length: ROAD_SEGMENTS_COUNT }).map((_, segIdx) => (
        <group
          key={`road-seg-${segIdx}`}
          ref={(el) => {
            if (el) roadSegmentsRef.current[segIdx] = el;
          }}
          position={[0, 0, -segIdx * ROAD_SEGMENT_LENGTH]}
        >
          {/* Deep Ground Terrain */}
          <mesh
            position={[0, -0.06, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[360, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#070a10" roughness={0.9} metalness={0.1} />
          </mesh>

          {/* Wet Street Semi-Reflective Asphalt */}
          <mesh
            position={[0, -0.04, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[ROAD_WIDTH, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial
              color="#0d1117"
              roughness={0.2}
              metalness={0.5}
              envMapIntensity={1.8}
            />
          </mesh>

          {/* Sidewalks */}
          <mesh
            position={[-ROAD_WIDTH / 2 - 4.5, -0.03, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[9.0, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.15} />
          </mesh>

          <mesh
            position={[ROAD_WIDTH / 2 + 4.5, -0.03, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[9.0, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.15} />
          </mesh>

          {/* Canal Green Verge */}
          <mesh
            position={[-ROAD_WIDTH / 2 - 9.0, -0.025, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[5.0, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#062817" roughness={0.9} />
          </mesh>
          <mesh
            position={[ROAD_WIDTH / 2 + 9.0, -0.025, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[5.0, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#062817" roughness={0.9} />
          </mesh>

          {/* Solid White Outer Road Lines */}
          <mesh
            position={[-ROAD_WIDTH / 2 + 0.35, -0.03, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.2, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh
            position={[ROAD_WIDTH / 2 - 0.35, -0.03, -ROAD_SEGMENT_LENGTH / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.2, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
          </mesh>

          {/* Yellow Dashed Paint Center Lines */}
          {roadDashes.map((dZ) => (
            <group key={`dashes-${dZ}`}>
              <mesh
                position={[-2.4, -0.03, -dZ - 1.5]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.18, 3.2]} />
                <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.2} />
              </mesh>
              <mesh
                position={[2.4, -0.03, -dZ - 1.5]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.18, 3.2]} />
                <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.2} />
              </mesh>
            </group>
          ))}

          {/* Concrete Curbs */}
          <mesh position={[-ROAD_WIDTH / 2 - 0.22, 0.12, -ROAD_SEGMENT_LENGTH / 2]} castShadow receiveShadow>
            <boxGeometry args={[0.44, 0.24, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>
          <mesh position={[ROAD_WIDTH / 2 + 0.22, 0.12, -ROAD_SEGMENT_LENGTH / 2]} castShadow receiveShadow>
            <boxGeometry args={[0.44, 0.24, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>

          {/* Steel Guardrails */}
          <mesh position={[-ROAD_WIDTH / 2 - 0.58, 0.52, -ROAD_SEGMENT_LENGTH / 2]} castShadow>
            <boxGeometry args={[0.12, 0.5, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[ROAD_WIDTH / 2 + 0.58, 0.52, -ROAD_SEGMENT_LENGTH / 2]} castShadow>
            <boxGeometry args={[0.12, 0.5, ROAD_SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Lahore Roadside Trees */}
          {TREE_Z_OFFSETS.map((tz) => (
            <group key={`lahore-trees-${tz}`}>
              <group position={[-ROAD_WIDTH / 2 - 3.8, 0, -tz]}>
                <mesh position={[0, 2.4, 0]} castShadow>
                  <cylinderGeometry args={[0.24, 0.38, 4.8, 8]} />
                  <meshStandardMaterial color="#292524" roughness={0.9} />
                </mesh>
                <mesh position={[0, 5.2, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[2.2, 10, 10]} />
                  <meshStandardMaterial color="#14532d" roughness={0.85} />
                </mesh>
                <mesh position={[0.2, 6.6, 0.2]} castShadow>
                  <sphereGeometry args={[1.7, 8, 8]} />
                  <meshStandardMaterial color="#166534" roughness={0.8} />
                </mesh>
              </group>

              <group position={[ROAD_WIDTH / 2 + 3.8, 0, -tz]}>
                <mesh position={[0, 2.4, 0]} castShadow>
                  <cylinderGeometry args={[0.24, 0.38, 4.8, 8]} />
                  <meshStandardMaterial color="#292524" roughness={0.9} />
                </mesh>
                <mesh position={[0, 5.2, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[2.2, 10, 10]} />
                  <meshStandardMaterial color="#14532d" roughness={0.85} />
                </mesh>
                <mesh position={[-0.2, 6.6, -0.2]} castShadow>
                  <sphereGeometry args={[1.7, 8, 8]} />
                  <meshStandardMaterial color="#166534" roughness={0.8} />
                </mesh>
              </group>
            </group>
          ))}

          {/* Streetlights with Warm Sodium Pools of Light */}
          {[16, 46, 76, 106].map((pz) => (
            <group key={`lamp-${pz}`}>
              {/* Left Pole */}
              <mesh position={[-ROAD_WIDTH / 2 - 1.8, 4.5, -pz]} castShadow>
                <cylinderGeometry args={[0.12, 0.18, 9.0, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[-ROAD_WIDTH / 2 - 0.7, 8.8, -pz]}>
                <boxGeometry args={[2.4, 0.12, 0.2]} />
                <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[-ROAD_WIDTH / 2 + 0.3, 8.7, -pz]}>
                <boxGeometry args={[0.7, 0.15, 0.32]} />
                <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={3.5} />
              </mesh>
              <pointLight
                position={[-ROAD_WIDTH / 2 + 0.3, 8.0, -pz]}
                color="#fde047"
                intensity={4.8}
                distance={26}
                decay={1.8}
              />

              {/* Right Pole */}
              <mesh position={[ROAD_WIDTH / 2 + 1.8, 4.5, -pz]} castShadow>
                <cylinderGeometry args={[0.12, 0.18, 9.0, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[ROAD_WIDTH / 2 + 0.7, 8.8, -pz]}>
                <boxGeometry args={[2.4, 0.12, 0.2]} />
                <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[ROAD_WIDTH / 2 - 0.3, 8.7, -pz]}>
                <boxGeometry args={[0.7, 0.15, 0.32]} />
                <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={3.5} />
              </mesh>
              <pointLight
                position={[ROAD_WIDTH / 2 - 0.3, 8.0, -pz]}
                color="#fde047"
                intensity={4.8}
                distance={26}
                decay={1.8}
              />
            </group>
          ))}

          {/* Urban Architecture (Left Side) */}
          {LEFT_BUILDINGS.map((bldg, bIdx) => {
            const posX = -(ROAD_WIDTH / 2 + bldg.xDist);
            const posZ = bldg.zOffset;
            const posY = bldg.height / 2;

            return (
              <group key={`l-bldg-${bIdx}`} position={[posX, 0, posZ]}>
                <mesh position={[0, posY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[bldg.width, bldg.height, bldg.depth]} />
                  <meshStandardMaterial
                    color={bldg.bodyColor}
                    metalness={bldg.metalness}
                    roughness={bldg.roughness}
                  />
                </mesh>

                <mesh position={[0, bldg.height + 4, 0]} castShadow>
                  <boxGeometry args={[bldg.width * 0.6, 8, bldg.depth * 0.6]} />
                  <meshStandardMaterial color="#111827" roughness={0.8} />
                </mesh>

                <mesh position={[0, bldg.height + 12, 0]}>
                  <sphereGeometry args={[0.3, 8, 8]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={4.0} />
                </mesh>

                {/* Scattered Interior Windows */}
                {Array.from({ length: 7 }).map((_, fIdx) => {
                  const winY = 8 + fIdx * 10;
                  if (winY > bldg.height - 8) return null;
                  const isLit = (fIdx + bIdx) % 2 === 0;
                  const isAmber = fIdx % 3 === 0;

                  return (
                    <group key={`win-l-${fIdx}`} position={[bldg.width / 2 + 0.08, winY, 0]}>
                      <mesh position={[0, 0, -4]} rotation={[0, Math.PI / 2, 0]}>
                        <planeGeometry args={[4.2, 2.6]} />
                        <meshStandardMaterial
                          color={isLit ? (isAmber ? '#fed7aa' : '#f8fafc') : '#0a0f1d'}
                          emissive={isLit ? (isAmber ? '#f59e0b' : '#f8fafc') : '#000000'}
                          emissiveIntensity={isLit ? 1.8 : 0}
                          roughness={0.3}
                        />
                      </mesh>
                      <mesh position={[0, 0, 4]} rotation={[0, Math.PI / 2, 0]}>
                        <planeGeometry args={[4.2, 2.6]} />
                        <meshStandardMaterial
                          color={!isLit ? '#fed7aa' : '#0a0f1d'}
                          emissive={!isLit ? '#f59e0b' : '#000000'}
                          emissiveIntensity={!isLit ? 1.8 : 0}
                          roughness={0.3}
                        />
                      </mesh>
                    </group>
                  );
                })}
              </group>
            );
          })}

          {/* Urban Architecture (Right Side) */}
          {RIGHT_BUILDINGS.map((bldg, bIdx) => {
            const posX = ROAD_WIDTH / 2 + bldg.xDist;
            const posZ = bldg.zOffset;
            const posY = bldg.height / 2;

            return (
              <group key={`r-bldg-${bIdx}`} position={[posX, 0, posZ]}>
                <mesh position={[0, posY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[bldg.width, bldg.height, bldg.depth]} />
                  <meshStandardMaterial
                    color={bldg.bodyColor}
                    metalness={bldg.metalness}
                    roughness={bldg.roughness}
                  />
                </mesh>

                <mesh position={[0, bldg.height + 4, 0]} castShadow>
                  <boxGeometry args={[bldg.width * 0.6, 8, bldg.depth * 0.6]} />
                  <meshStandardMaterial color="#111827" roughness={0.8} />
                </mesh>

                <mesh position={[0, bldg.height + 12, 0]}>
                  <sphereGeometry args={[0.3, 8, 8]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={4.0} />
                </mesh>

                {Array.from({ length: 7 }).map((_, fIdx) => {
                  const winY = 8 + fIdx * 10;
                  if (winY > bldg.height - 8) return null;
                  const isLit = (fIdx * 2 + bIdx) % 3 !== 0;
                  const isAmber = fIdx % 2 === 1;

                  return (
                    <group key={`win-r-${fIdx}`} position={[-bldg.width / 2 - 0.08, winY, 0]}>
                      <mesh position={[0, 0, -4]} rotation={[0, -Math.PI / 2, 0]}>
                        <planeGeometry args={[4.2, 2.6]} />
                        <meshStandardMaterial
                          color={isLit ? (isAmber ? '#fed7aa' : '#f8fafc') : '#0a0f1d'}
                          emissive={isLit ? (isAmber ? '#f59e0b' : '#f8fafc') : '#000000'}
                          emissiveIntensity={isLit ? 1.8 : 0}
                          roughness={0.3}
                        />
                      </mesh>
                      <mesh position={[0, 0, 4]} rotation={[0, -Math.PI / 2, 0]}>
                        <planeGeometry args={[4.2, 2.6]} />
                        <meshStandardMaterial
                          color={isLit && !isAmber ? '#fed7aa' : '#0a0f1d'}
                          emissive={isLit && !isAmber ? '#f59e0b' : '#000000'}
                          emissiveIntensity={isLit && !isAmber ? 1.8 : 0}
                          roughness={0.3}
                        />
                      </mesh>
                    </group>
                  );
                })}
              </group>
            );
          })}
        </group>
      ))}

      {/* 7. Traffic Signal Gantries & Crossings */}
      {signals.map((sig) => (
        <group key={sig.id} position={[0, 0, sig.z]}>
          <group position={[0, 0, 4.0]}>
            <mesh position={[0, -0.02, 11.0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[ROAD_WIDTH - 1.2, 0.45]} />
              <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.2} />
            </mesh>

            {Array.from({ length: 15 }).map((_, idx) => {
              const xPos = -ROAD_WIDTH / 2 + 0.9 + idx * 0.82;
              const isYellow = idx % 2 === 1;
              return (
                <mesh
                  key={`zebra-${idx}`}
                  position={[xPos, -0.018, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[0.55, 4.8]} />
                  <meshStandardMaterial
                    color={isYellow ? '#eab308' : '#f8fafc'}
                    roughness={0.35}
                    metalness={0.2}
                  />
                </mesh>
              );
            })}

            <mesh position={[0, -0.015, 2.8]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[ROAD_WIDTH - 0.4, 0.65]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.2} />
            </mesh>
          </group>

          <mesh position={[-ROAD_WIDTH / 2 - 1.2, 5.0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.36, 10.0, 10]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[ROAD_WIDTH / 2 + 1.2, 5.0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.36, 10.0, 10]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>

          <mesh position={[0, 9.6, 0]} castShadow>
            <boxGeometry args={[ROAD_WIDTH + 3.2, 0.7, 0.7]} />
            <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.35} />
          </mesh>

          {/* Traffic Signal Hoods */}
          {[-3.6, 0, 3.6].map((xOffset, lIdx) => (
            <group key={`sig-box-${lIdx}`} position={[xOffset, 8.5, 0]}>
              <mesh castShadow>
                <boxGeometry args={[1.7, 1.0, 0.6]} />
                <meshStandardMaterial color="#111827" roughness={0.8} />
              </mesh>

              <mesh position={[-0.48, 0, 0.32]}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial
                  color={sig.state === 'RED' ? '#ef4444' : '#261214'}
                  emissive={sig.state === 'RED' ? '#ef4444' : '#000000'}
                  emissiveIntensity={sig.state === 'RED' ? 4.5 : 0.0}
                  roughness={0.2}
                />
              </mesh>

              <mesh position={[0, 0, 0.32]}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial
                  color={sig.state === 'YELLOW' ? '#f59e0b' : '#291d0a'}
                  emissive={sig.state === 'YELLOW' ? '#f59e0b' : '#000000'}
                  emissiveIntensity={sig.state === 'YELLOW' ? 4.5 : 0.0}
                  roughness={0.2}
                />
              </mesh>

              <mesh position={[0.48, 0, 0.32]}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial
                  color={sig.state === 'GREEN' ? '#10b981' : '#062316'}
                  emissive={sig.state === 'GREEN' ? '#10b981' : '#000000'}
                  emissiveIntensity={sig.state === 'GREEN' ? 4.5 : 0.0}
                  roughness={0.2}
                />
              </mesh>

              <pointLight
                position={[0, -0.2, 0.8]}
                color={
                  sig.state === 'RED'
                    ? '#ef4444'
                    : sig.state === 'YELLOW'
                    ? '#f59e0b'
                    : '#10b981'
                }
                intensity={3.8}
                distance={20}
              />
            </group>
          ))}
        </group>
      ))}

      {/* 8. Postprocessing */}
      {!isSoftwareGl && (
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.82}
            luminanceSmoothing={0.2}
            intensity={0.45}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.22} darkness={0.52} />
        </EffectComposer>
      )}
    </>
  );
}
