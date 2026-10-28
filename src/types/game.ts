export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'TUTORIAL';

export type InputMode = 'WEBCAM' | 'KEYBOARD';

export interface GestureState {
  steerOffset: number; // -1.0 (Full Left) to +1.0 (Full Right)
  rawSteer: number;
  isStopping: boolean;
  handRaised: boolean;
  shoulderSlope: number;
  confidence: number;
  fps: number;
  isPoseDetected: boolean;
  cameraActive: boolean;
  errorMessage: string | null;
  gestureBadge: 'BRAKE' | 'LEFT' | 'RIGHT' | 'STRAIGHT';
  gestureBadgeLabel: string;
}

export type SignalColor = 'GREEN' | 'YELLOW' | 'RED';

export interface TrafficSignal {
  id: string;
  z: number; // Road Z position (meters)
  state: SignalColor;
  timeRemaining: number;
  totalCycleTime: number;
  isEvaluated: boolean;
  safeStopped: boolean;
}

export interface AmbulanceEventState {
  active: boolean;
  z: number;
  laneX: number;
  initialPlayerLaneX: number;
  speedKmH: number;
  distanceToPlayer: number;
  timeLeft: number;
  hasEvaluated: boolean;
  hasPassed: boolean;
  result: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
}

export interface RoadHazardZone {
  id: string;
  z: number;
  laneX: number;
  laneName: 'LEFT' | 'CENTER' | 'RIGHT';
  cones: { id: string; offsetX: number; offsetZ: number; hit: boolean }[];
  cleared: boolean;
}

export interface ScoreEvent {
  id: string;
  text: string;
  points: number;
  type: 'positive' | 'negative' | 'neutral';
  timestamp: number;
}

export interface CivicStats {
  score: number;
  distance: number; // in meters
  speedKmH: number;
  safeStops: number;
  redViolations: number;
  laneDisciplineSeconds: number;
  drivingDurationSec: number;
  ambulanceYields: number;
  ambulanceFails: number;
  coneStrikes: number;
}

export interface LeaderboardEntry {
  id: string;
  driverName: string;
  score: number;
  grade: 'S' | 'A+' | 'A' | 'B' | 'C' | 'DISQUALIFIED';
  distance: number;
  safeStops: number;
  violations: number;
  ambulanceYields?: number;
  date: string;
}
