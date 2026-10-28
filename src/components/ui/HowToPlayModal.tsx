import React from 'react';
import { Camera, Hand, Compass, CheckCircle2, AlertOctagon, Sparkles } from 'lucide-react';
import { sound } from '../../utils/audio';

interface HowToPlayModalProps {
  onStart: () => void;
  inputMode: 'WEBCAM' | 'KEYBOARD';
  onToggleInputMode: () => void;
  onClose?: () => void;
}

export function HowToPlayModal({
  onStart,
  inputMode,
  onToggleInputMode,
  onClose,
}: HowToPlayModalProps) {
  const handleStart = () => {
    sound.init(); // Initialize Web Audio Context on user click
    onStart();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="relative px-6 py-6 bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-mono tracking-widest text-cyan-400 font-bold uppercase">
                Interactive 3D Traffic Safety
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white">
                GestureKart Simulator
              </h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-300 leading-relaxed">
            Welcome to the client-side civic driving evaluation. Control your vehicle using natural body poses detected in real time by your webcam.
          </p>

          {/* Gesture Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gesture 1: Steering */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-400">
                <Compass className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Tilt Shoulders to Steer</h3>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Tilt your shoulders left or right like holding an imaginary steering wheel. The car smoothly glides into the lane.
              </p>
            </div>

            {/* Gesture 2: Braking */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Hand className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Raise Hand to Brake</h3>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Raise your right hand above your shoulder or nose. The car decelerates immediately to 0 KM/H with glowing brake lights.
              </p>
            </div>
          </div>

          {/* Civic Traffic Rules */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Civic Scorecard Rules
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <p className="text-emerald-400 font-bold font-mono">+150 PTS</p>
                <p className="text-[11px] text-slate-400">Safe Stop at Red</p>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <p className="text-rose-400 font-bold font-mono">-200 PTS</p>
                <p className="text-[11px] text-slate-400">Red Light Violation</p>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <p className="text-sky-400 font-bold font-mono">+10 PTS/s</p>
                <p className="text-[11px] text-slate-400">Lane Discipline</p>
              </div>
            </div>
          </div>

          {/* Controls Toggle & Start Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={onToggleInputMode}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-xs font-mono font-semibold text-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Mode: <span className="text-cyan-400 font-bold">{inputMode}</span>
              <span className="text-slate-500 text-[10px]">(Click to Switch)</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-mono font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Back
              </button>
            )}

            <button
              onClick={handleStart}
              className="w-full flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer transform active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Got It! Start Driving
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
