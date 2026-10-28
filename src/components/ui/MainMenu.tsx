import React from 'react';
import { Play, HelpCircle, Trophy, Camera, Keyboard, Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';
import { InputMode, GestureState } from '../../types/game';
import { sound } from '../../utils/audio';

interface MainMenuProps {
  onStartDrive: () => void;
  onOpenTutorial: () => void;
  onOpenLeaderboard: () => void;
  inputMode: InputMode;
  onToggleInputMode: () => void;
  gestureState: GestureState;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function MainMenu({
  onStartDrive,
  onOpenTutorial,
  onOpenLeaderboard,
  inputMode,
  onToggleInputMode,
  gestureState,
  isMuted,
  onToggleMute,
}: MainMenuProps) {
  const handleStart = () => {
    sound.init();
    onStartDrive();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-black/80 rounded-3xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Subtle Gold / Amber Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        {/* Title Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-amber-400 text-[10px] font-mono tracking-widest uppercase">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            CINEMATIC URBAN NIGHT SIMULATOR
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
            GESTUREKART
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            GTA & Need for Speed Urban Night Driving Experience with Real-Time Pose Gestures
          </p>
        </div>

        {/* Sensor & Input Status Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                gestureState.isPoseDetected
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
            >
              {inputMode === 'WEBCAM' ? <Camera className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-white uppercase">
                Input Mode: <span className="text-amber-400">{inputMode}</span>
              </p>
              <p className="text-[11px] text-slate-400">
                {inputMode === 'WEBCAM'
                  ? gestureState.isPoseDetected
                    ? `Pose Active (${gestureState.fps} FPS) - Ready for Street Drive`
                    : 'Webcam Ready - Sit in frame to steer'
                  : 'Arrow keys / A,D to steer, Space to brake'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleInputMode}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs font-mono font-semibold text-slate-300 transition-colors cursor-pointer"
          >
            Switch Mode
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-3">
          {/* Start Drive Button */}
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base px-6 py-4 rounded-2xl shadow-xl shadow-amber-500/20 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            START NIGHT DRIVE
          </button>

          <div className="grid grid-cols-2 gap-3">
            {/* How to Play */}
            <button
              onClick={onOpenTutorial}
              className="flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              How to Play
            </button>

            {/* Leaderboard */}
            <button
              onClick={onOpenLeaderboard}
              className="flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              Leaderboard
            </button>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
          <span>CANAL ROAD SPEED LIMIT: 60 KM/H</span>
          <button
            onClick={onToggleMute}
            className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            {isMuted ? 'UNMUTE AUDIO' : 'AUDIO ACTIVE'}
          </button>
        </div>
      </div>
    </div>
  );
}
