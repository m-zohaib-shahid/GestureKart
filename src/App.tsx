/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureEngine } from './hooks/useGestureEngine';
import { RoadScene } from './components/3d/RoadScene';
import { HUD } from './components/ui/HUD';
import { MainMenu } from './components/ui/MainMenu';
import { PauseModal } from './components/ui/PauseModal';
import { HowToPlayModal } from './components/ui/HowToPlayModal';
import { CivicScorecardModal } from './components/ui/CivicScorecardModal';
import { GameState, ScoreEvent, CivicStats, SignalColor, AmbulanceEventState } from './types/game';
import { sound } from './utils/audio';

const INITIAL_SCORE = 1000;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState<number>(INITIAL_SCORE);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [speedKmH, setSpeedKmH] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [safeStops, setSafeStops] = useState<number>(0);
  const [redViolations, setRedViolations] = useState<number>(0);
  const [laneSeconds, setLaneSeconds] = useState<number>(0);
  const [ambulanceYields, setAmbulanceYields] = useState<number>(0);
  const [ambulanceFails, setAmbulanceFails] = useState<number>(0);
  const [coneStrikes, setConeStrikes] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Overhead Signal Radar info for HUD
  const [nextSignalDist, setNextSignalDist] = useState<number>(200);
  const [nextSignalState, setNextSignalState] = useState<SignalColor>('GREEN');
  const [nextSignalTimer, setNextSignalTimer] = useState<number>(9);

  // Emergency Ambulance Yield Event state for HUD Banner
  const [ambulanceEvent, setAmbulanceEvent] = useState<AmbulanceEventState | null>(null);

  // Hook into computer vision & skeleton engine
  const {
    videoRef,
    canvasRef,
    gestureState,
    inputMode,
    toggleInputMode,
    isInverted,
    toggleInverted,
    startCamera,
  } = useGestureEngine();

  // Handle Score Events (+200 yield bonus, -150 yield fail, -50 cone collision, +150 safe stop, -200 red violation)
  const handleScoreEvent = useCallback(
    (text: string, points: number, type: 'positive' | 'negative' | 'neutral', category?: string) => {
      setScore((prev) => Math.max(0, prev + points));

      if (category === 'YIELD_BONUS') {
        setAmbulanceYields((prev) => prev + 1);
      } else if (category === 'YIELD_FAIL') {
        setAmbulanceFails((prev) => prev + 1);
      } else if (category === 'CONE_HIT') {
        setConeStrikes((prev) => prev + 1);
      } else if (category === 'SAFE_STOP') {
        setSafeStops((prev) => prev + 1);
      } else if (category === 'RED_LIGHT') {
        setRedViolations((prev) => prev + 1);
      } else if (type === 'neutral') {
        setLaneSeconds((prev) => prev + 1.5);
      }

      const newEvent: ScoreEvent = {
        id: `evt-${Date.now()}-${Math.random()}`,
        text,
        points,
        type,
        timestamp: Date.now(),
      };

      setScoreEvents((prev) => [...prev.slice(-3), newEvent]);
    },
    []
  );

  // Update dynamic road stats from 3D frame
  const handleStatsUpdate = useCallback(
    (stats: {
      speedKmH: number;
      distance: number;
      nextSignalDist: number;
      nextSignalState: SignalColor;
      nextSignalTimer: number;
      ambulanceEvent: AmbulanceEventState | null;
    }) => {
      setSpeedKmH(stats.speedKmH);
      setDistance(stats.distance);
      setNextSignalDist(stats.nextSignalDist);
      setNextSignalState(stats.nextSignalState);
      setNextSignalTimer(stats.nextSignalTimer);
      setAmbulanceEvent(stats.ambulanceEvent);
    },
    []
  );

  // Keyboard shortcut: Esc to toggle Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGameState((current) => {
          if (current === 'PLAYING') return 'PAUSED';
          if (current === 'PAUSED') return 'PLAYING';
          return current;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clean up old toasts after 3 seconds
  useEffect(() => {
    if (scoreEvents.length === 0) return;
    const timer = setTimeout(() => {
      setScoreEvents((prev) => prev.filter((e) => Date.now() - e.timestamp < 3000));
    }, 1000);
    return () => clearTimeout(timer);
  }, [scoreEvents]);

  // Restart / Reset Game Loop
  const handleRestart = useCallback(() => {
    setScore(INITIAL_SCORE);
    setSafeStops(0);
    setRedViolations(0);
    setLaneSeconds(0);
    setAmbulanceYields(0);
    setAmbulanceFails(0);
    setConeStrikes(0);
    setDistance(0);
    setSpeedKmH(0);
    setScoreEvents([]);
    setAmbulanceEvent(null);
    sound.stopSiren();
    setGameState('PLAYING');
  }, []);

  // Exit to Main Menu
  const handleExitToMenu = useCallback(() => {
    setScore(INITIAL_SCORE);
    setSafeStops(0);
    setRedViolations(0);
    setLaneSeconds(0);
    setAmbulanceYields(0);
    setAmbulanceFails(0);
    setConeStrikes(0);
    setDistance(0);
    setSpeedKmH(0);
    setScoreEvents([]);
    setAmbulanceEvent(null);
    sound.updateEngine(0);
    sound.stopSiren();
    setGameState('MENU');
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  }, []);

  const civicStats: CivicStats = {
    score,
    distance,
    speedKmH,
    safeStops,
    redViolations,
    laneDisciplineSeconds: laneSeconds,
    ambulanceYields,
    ambulanceFails,
    coneStrikes,
    drivingDurationSec: 0,
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          camera={{
            position: [0, 4.2, 8.2],
            fov: 65,
            near: 0.1,
            far: 500,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0d1117');
          }}
        >
          <RoadScene
            steerOffset={gameState === 'PLAYING' ? gestureState.steerOffset : 0}
            isStopping={gameState === 'PLAYING' ? gestureState.isStopping : true}
            onStatsUpdate={handleStatsUpdate}
            onScoreEvent={handleScoreEvent}
            isPaused={gameState !== 'PLAYING'}
          />
        </Canvas>
      </div>

      {/* Real-Time HUD Dashboard (visible while PLAYING or PAUSED) */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <HUD
          gestureState={gestureState}
          inputMode={inputMode}
          onToggleInputMode={toggleInputMode}
          isInverted={isInverted}
          onToggleInverted={toggleInverted}
          speedKmH={speedKmH}
          score={score}
          distance={distance}
          nextSignalDist={nextSignalDist}
          nextSignalState={nextSignalState}
          nextSignalTimer={nextSignalTimer}
          ambulanceEvent={ambulanceEvent}
          scoreEvents={scoreEvents}
          videoRef={videoRef}
          canvasRef={canvasRef}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenHowToPlay={() => setGameState('TUTORIAL')}
          onPause={() => setGameState('PAUSED')}
          onFinishRun={() => setGameState('GAMEOVER')}
          onStartCamera={startCamera}
        />
      )}

      {/* Main Menu Screen */}
      {gameState === 'MENU' && (
        <MainMenu
          onStartDrive={() => {
            startCamera();
            setGameState('PLAYING');
          }}
          onOpenTutorial={() => setGameState('TUTORIAL')}
          onOpenLeaderboard={() => setGameState('GAMEOVER')}
          inputMode={inputMode}
          onToggleInputMode={toggleInputMode}
          gestureState={gestureState}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Pause Modal Overlay */}
      {gameState === 'PAUSED' && (
        <PauseModal
          onResume={() => setGameState('PLAYING')}
          onRestart={handleRestart}
          onMainMenu={handleExitToMenu}
          onOpenTutorial={() => setGameState('TUTORIAL')}
          score={score}
          distance={distance}
        />
      )}

      {/* How to Play Tutorial Modal */}
      {gameState === 'TUTORIAL' && (
        <HowToPlayModal
          onStart={() => setGameState('PLAYING')}
          inputMode={inputMode}
          onToggleInputMode={toggleInputMode}
          onClose={() => setGameState('MENU')}
        />
      )}

      {/* Civic Scorecard & Driving License Modal */}
      {gameState === 'GAMEOVER' && (
        <CivicScorecardModal
          stats={civicStats}
          onRestart={handleRestart}
          onExitToMenu={handleExitToMenu}
        />
      )}
    </div>
  );
}
