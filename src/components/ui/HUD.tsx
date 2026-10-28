import React, { useMemo, useState, useEffect } from 'react';
import { GestureState, InputMode, SignalColor, ScoreEvent, AmbulanceEventState } from '../../types/game';
import {
  Volume2,
  VolumeX,
  Camera,
  Keyboard,
  Compass,
  Hand,
  Pause,
  Flag,
  HelpCircle,
  Radio,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Siren,
} from 'lucide-react';

interface HUDProps {
  gestureState: GestureState;
  inputMode: InputMode;
  onToggleInputMode: () => void;
  isInverted: boolean;
  onToggleInverted: () => void;
  speedKmH: number;
  score: number;
  distance: number;
  nextSignalDist: number;
  nextSignalState: SignalColor;
  nextSignalTimer: number;
  ambulanceEvent: AmbulanceEventState | null;
  scoreEvents: ScoreEvent[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenHowToPlay: () => void;
  onPause: () => void;
  onFinishRun: () => void;
  onStartCamera?: () => void;
}

export function HUD({
  gestureState,
  inputMode,
  onToggleInputMode,
  isInverted,
  onToggleInverted,
  speedKmH,
  score,
  distance,
  nextSignalDist,
  nextSignalState,
  nextSignalTimer,
  ambulanceEvent,
  scoreEvents,
  videoRef,
  canvasRef,
  isMuted,
  onToggleMute,
  onOpenHowToPlay,
  onPause,
  onFinishRun,
  onStartCamera,
}: HUDProps) {
  // Smooth animated velocity state (0 to 100 KM/H)
  const [displaySpeed, setDisplaySpeed] = useState<number>(speedKmH);

  useEffect(() => {
    let animId: number;
    const animateSpeed = () => {
      setDisplaySpeed((prev) => {
        const diff = speedKmH - prev;
        if (Math.abs(diff) < 0.2) return speedKmH;
        return prev + diff * 0.16; // Smooth realistic dial inertia
      });
      animId = requestAnimationFrame(animateSpeed);
    };
    animId = requestAnimationFrame(animateSpeed);
    return () => cancelAnimationFrame(animId);
  }, [speedKmH]);

  // Activate camera stream as soon as HUD mounts
  useEffect(() => {
    if (onStartCamera) {
      onStartCamera();
    }
  }, [onStartCamera]);

  // Speedometer Circular Arc calculations (240 degree sweep, calibrated 0 to 100 KM/H)
  const arcRadius = 52;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcSweep = (240 / 360) * arcCircumference;
  const speedRatio = Math.min(Math.max(displaySpeed / 100, 0), 1);
  const strokeDashoffset = arcSweep * (1 - speedRatio);

  // Dynamic simulated gear
  const gear = useMemo(() => {
    if (gestureState.isStopping || displaySpeed < 1) return 'N';
    if (displaySpeed < 25) return '1';
    if (displaySpeed < 50) return '2';
    if (displaySpeed < 75) return '3';
    return '4';
  }, [displaySpeed, gestureState.isStopping]);

  // Tactical signal radar styling
  const signalTheme =
    nextSignalState === 'RED'
      ? {
          border: 'border-rose-500/60 bg-rose-950/40 text-rose-400',
          dot: 'bg-rose-500 shadow-[0_0_8px_#ef4444]',
        }
      : nextSignalState === 'YELLOW'
      ? {
          border: 'border-amber-500/60 bg-amber-950/40 text-amber-400',
          dot: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
        }
      : {
          border: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-400',
          dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
        };

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 overflow-hidden font-sans">
      {/* 1. TOP TELEMETRY BAR: NON-INTRUSIVE TACTICAL GLASSMORPHISM */}
      <div className="flex items-start justify-between gap-4 pointer-events-auto">
        {/* Left: Civic Scorecard & Distance */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl px-4 py-2.5 backdrop-blur-lg shadow-lg shadow-black/40">
            <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider block">
              CIVIC SAFETY SCORE
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight flex items-baseline ${
                score >= 1000
                  ? 'text-emerald-400'
                  : score >= 750
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {score}
              <span className="text-xs font-semibold text-slate-500 ml-1.5">PTS</span>
            </div>
          </div>

          {/* Traveled Distance Panel */}
          <div className="hidden sm:block bg-slate-950/80 border border-slate-800/90 rounded-2xl px-3.5 py-2.5 backdrop-blur-lg shadow-lg shadow-black/40">
            <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider block">
              DISTANCE
            </span>
            <div className="text-xl font-bold font-mono text-slate-200">
              {Math.round(distance)} <span className="text-xs text-slate-400">M</span>
            </div>
          </div>
        </div>

        {/* Center: Traffic Signal Radar */}
        <div
          className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-lg shadow-lg shadow-black/40 transition-all duration-300 ${signalTheme.border}`}
        >
          <div className="flex gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            <div
              className={`w-3 h-3 rounded-full ${
                nextSignalState === 'RED' ? signalTheme.dot : 'bg-rose-950/40'
              }`}
            />
            <div
              className={`w-3 h-3 rounded-full ${
                nextSignalState === 'YELLOW' ? signalTheme.dot : 'bg-amber-950/40'
              }`}
            />
            <div
              className={`w-3 h-3 rounded-full ${
                nextSignalState === 'GREEN' ? signalTheme.dot : 'bg-emerald-950/40'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-wider">
                {nextSignalState} ({Math.ceil(nextSignalTimer)}s)
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              NEXT GANTRY: {Math.round(nextSignalDist)}M
            </p>
          </div>
        </div>

        {/* Right: Pause Menu & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Audio Mute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="w-9 h-9 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white backdrop-blur-lg flex items-center justify-center transition-colors cursor-pointer shadow-md"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Help Modal */}
          <button
            onClick={onOpenHowToPlay}
            title="How to Play"
            className="w-9 h-9 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white backdrop-blur-lg flex items-center justify-center transition-colors cursor-pointer shadow-md"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Pause / Main Menu Button (Esc key supported) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            title="Pause Simulation (ESC)"
            className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 px-3 py-2 rounded-xl backdrop-blur-lg transition-all cursor-pointer font-mono text-xs font-bold shadow-md"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">PAUSE</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-700">
              ESC
            </kbd>
          </button>

          {/* Finish Run / Evaluate Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFinishRun();
            }}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EVALUATE</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC EMERGENCY AMBULANCE WARNING BANNER (TOP CENTER) */}
      {ambulanceEvent && ambulanceEvent.active && (
        <div className="pointer-events-none self-center flex flex-col items-center gap-2 mt-2 max-w-lg animate-in zoom-in-95 fade-in duration-150">
          {ambulanceEvent.result === null ? (
            <div className="bg-rose-950/90 border-2 border-rose-500 rounded-2xl px-5 py-2.5 shadow-[0_0_35px_rgba(244,63,94,0.6)] backdrop-blur-lg flex items-center gap-3 animate-pulse">
              <Siren className="w-6 h-6 text-rose-400 animate-spin" />
              <div>
                <p className="text-white font-mono font-black text-xs sm:text-sm tracking-wide flex items-center gap-2">
                  <span>🚨 CLEAR LANE FOR AMBULANCE!</span>
                  <span className="bg-rose-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-bold">
                    YIELD IMMEDIATELY
                  </span>
                </p>
                <p className="text-rose-200 text-[11px] font-mono mt-0.5">
                  Lean torso to switch lanes • Distance: {ambulanceEvent.distanceToPlayer}m
                </p>
              </div>
            </div>
          ) : ambulanceEvent.result === 'SUCCESS' ? (
            <div className="bg-emerald-950/90 border-2 border-emerald-400 rounded-2xl px-5 py-2.5 shadow-[0_0_35px_rgba(52,211,153,0.5)] backdrop-blur-lg flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
              <div>
                <p className="text-emerald-200 font-mono font-black text-xs sm:text-sm tracking-wide">
                  ✓ LANE CLEARED! +200 CIVIC YIELD BONUS
                </p>
                <p className="text-emerald-300/80 text-[11px] font-mono">
                  Ambulance passed safely • Outstanding road ethics!
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-rose-950/90 border-2 border-rose-600 rounded-2xl px-5 py-2.5 shadow-[0_0_35px_rgba(225,29,72,0.6)] backdrop-blur-lg flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-300" />
              <div>
                <p className="text-rose-200 font-mono font-black text-xs sm:text-sm tracking-wide">
                  ⚠️ FAILED TO YIELD! -150 CIVIC PENALTY
                </p>
                <p className="text-rose-300/80 text-[11px] font-mono">
                  Blocked emergency response vehicle
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. FLOATING SCORE EVENT NOTIFICATIONS (Tactical Muted Glassmorphism) */}
      <div className="pointer-events-none self-center flex flex-col items-center gap-1.5 mt-2 max-w-md">
        {scoreEvents.slice(-2).map((evt) => (
          <div
            key={evt.id}
            className={`px-4 py-1.5 rounded-xl border font-mono font-bold text-xs tracking-wide shadow-xl backdrop-blur-lg transition-all duration-200 transform scale-100 animate-in zoom-in-95 fade-in duration-150 ${
              evt.type === 'positive'
                ? 'bg-slate-950/85 border-emerald-500/60 text-emerald-300'
                : evt.type === 'negative'
                ? 'bg-slate-950/85 border-rose-500/60 text-rose-300'
                : 'bg-slate-950/85 border-amber-500/60 text-amber-300'
            }`}
          >
            {evt.text}
          </div>
        ))}
      </div>

      {/* 4. BOTTOM ROW: TACTICAL VISOR (BOTTOM-LEFT) & NFS SPEEDOMETER (BOTTOM-RIGHT) */}
      <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pointer-events-auto">
        {/* Bottom-Left: Tactical Visor CV Webcam */}
        <div className="relative bg-slate-950/80 border border-slate-800/90 rounded-2xl p-2 shadow-xl shadow-black/60 backdrop-blur-lg overflow-hidden">
          {/* Integrated Visor Screen Container: Real Hardware Video + Tactical Skeleton Overlay */}
          <div
            onClick={() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
              }
              if (onStartCamera) onStartCamera();
            }}
            title="Click visor to activate / wake camera"
            className="relative w-56 h-42 sm:w-64 sm:h-48 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center cursor-pointer"
          >
            {/* Real Hardware-Accelerated Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
                gestureState.cameraActive ? 'opacity-90' : 'opacity-0 pointer-events-none'
              }`}
            />

            {/* Tactical Skeleton Overlay Canvas */}
            <canvas
              ref={canvasRef}
              width={280}
              height={210}
              className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
            />
          </div>

          {/* Top HUD Telemetry Info */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between text-[10px] font-mono text-slate-300 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800/70">
            <span className="flex items-center gap-1.5 font-bold">
              <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
              HELMET VISOR
            </span>
            {gestureState.cameraActive ? (
              <span className="text-emerald-400 font-bold">
                {gestureState.isPoseDetected ? `POSE (${gestureState.fps} FPS)` : 'CAM LIVE'}
              </span>
            ) : onStartCamera ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCamera();
                }}
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold hover:bg-amber-400 hover:text-black cursor-pointer transition-colors"
              >
                ENABLE CAM
              </button>
            ) : (
              <span className="text-amber-400 font-bold">AVATAR SIM</span>
            )}
          </div>

          {/* Dynamic Gesture Badge Overlay (Single Clean Non-Ghosted Pill) */}
          <div className="absolute bottom-8 left-3 right-3 z-20 pointer-events-none flex justify-center">
            {gestureState.gestureBadge === 'BRAKE' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600/90 text-white font-mono font-bold text-[10px] shadow-lg border border-white/80 animate-pulse">
                <Hand className="w-3.5 h-3.5 fill-current" />
                <span>✋ RED LIGHT BRAKE ACTIVE</span>
              </div>
            ) : gestureState.gestureBadge === 'LEFT' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/90 text-amber-400 font-mono font-bold text-[10px] border border-amber-500/50">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>LEANING LEFT</span>
              </div>
            ) : gestureState.gestureBadge === 'RIGHT' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/90 text-amber-400 font-mono font-bold text-[10px] border border-amber-500/50">
                <span>LEANING RIGHT</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-slate-900/85 text-emerald-400 font-mono font-semibold text-[10px] border border-emerald-500/30">
                <span>▲ CRUISING STRAIGHT</span>
              </div>
            )}
          </div>

          {/* Steer Offset readout */}
          <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between text-[10px] font-mono bg-slate-950/85 px-2.5 py-1 rounded-lg border border-slate-800/70">
            <span className="text-slate-300 flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-400" />
              STEER: {(gestureState.steerOffset * 100).toFixed(0)}%
            </span>
            <span className={gestureState.isStopping ? 'text-rose-400 font-bold' : 'text-slate-400'}>
              {gestureState.isStopping ? 'BRAKE: ENGAGED' : `SPD: ${Math.round(displaySpeed)}`}
            </span>
          </div>
        </div>

        {/* Bottom-Right: NFS / GTA Style Tactical Speedometer Gauge */}
        <div className="flex flex-col items-end gap-2.5">
          <div className="relative bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 shadow-xl shadow-black/60 backdrop-blur-lg flex items-center justify-center w-48 h-48 sm:w-52 sm:h-52">
            <svg className="w-40 h-40 sm:w-44 sm:h-44 -rotate-90" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="nfsSpeedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="60%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {/* Background Gauge Track */}
              <circle
                cx="60"
                cy="60"
                r={arcRadius}
                fill="none"
                stroke="rgba(30, 41, 59, 0.6)"
                strokeWidth="7"
                strokeDasharray={`${arcSweep} ${arcCircumference}`}
                strokeLinecap="round"
                className="rotate-[150deg] origin-center"
              />

              {/* Active Gauge Arc */}
              <circle
                cx="60"
                cy="60"
                r={arcRadius}
                fill="none"
                stroke="url(#nfsSpeedGrad)"
                strokeWidth="7"
                strokeDasharray={`${arcSweep} ${arcCircumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="rotate-[150deg] origin-center transition-all duration-75 ease-out"
              />

              {/* Calibration Ticks: 0, 20, 40, 60, 80, 100 KM/H */}
              {[0, 20, 40, 60, 80, 100].map((tickSpeed) => {
                const angle = 150 + (tickSpeed / 100) * 240;
                const rad = (angle * Math.PI) / 180;
                const isMajor = tickSpeed % 40 === 0;
                const tickLen = isMajor ? 8 : 5;
                const x1 = 60 + (arcRadius - tickLen) * Math.cos(rad);
                const y1 = 60 + (arcRadius - tickLen) * Math.sin(rad);
                const x2 = 60 + (arcRadius + 5) * Math.cos(rad);
                const y2 = 60 + (arcRadius + 5) * Math.sin(rad);
                return (
                  <line
                    key={`tick-${tickSpeed}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={displaySpeed >= tickSpeed ? '#e2e8f0' : 'rgba(71, 85, 105, 0.4)'}
                    strokeWidth={isMajor ? 1.8 : 1.0}
                    className="rotate-90 origin-center"
                  />
                );
              })}
            </svg>

            {/* Speedometer Center Dial Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-mono tracking-widest text-slate-400 font-semibold uppercase">
                KM/H
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-baseline">
                {Math.round(displaySpeed)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    gestureState.isStopping
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {gestureState.isStopping ? 'BRAKE' : `GEAR ${gear}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Input Toggle Strip */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 p-1.5 rounded-xl backdrop-blur-lg">
            <button
              onClick={onToggleInputMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer ${
                inputMode === 'WEBCAM'
                  ? 'bg-slate-800 border-amber-500/60 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {inputMode === 'WEBCAM' ? <Camera className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
              {inputMode}
            </button>

            <button
              onClick={onToggleInverted}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer ${
                isInverted
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              STEER: {isInverted ? 'INVERT' : 'NORMAL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
