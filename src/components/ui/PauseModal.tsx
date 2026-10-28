import { useEffect } from 'react';
import { Play, RotateCcw, Home, HelpCircle, Shield, AlertCircle } from 'lucide-react';
import { sound } from '../../utils/audio';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onOpenTutorial: () => void;
  score: number;
  distance: number;
}

export function PauseModal({
  onResume,
  onRestart,
  onMainMenu,
  onOpenTutorial,
  score,
  distance,
}: PauseModalProps) {
  // Listen for Esc key to resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900/90 border-2 border-cyan-500/60 shadow-[0_0_40px_rgba(0,240,255,0.25)] rounded-2xl overflow-hidden p-6 space-y-6">
        {/* Top Cyber Accent Lines */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 text-[10px] font-mono tracking-widest uppercase">
            <Shield className="w-3.5 h-3.5" />
            SIMULATION PAUSED
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white font-mono">
            TACTICAL HOLD
          </h2>
          <p className="text-xs text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">ESC</kbd> to return to active drive
          </p>
        </div>

        {/* Current Run Snapshot */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <div className="text-center">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Current Score
            </span>
            <span className="text-xl font-black font-mono text-cyan-300">
              {score} <span className="text-xs font-normal text-slate-400">PTS</span>
            </span>
          </div>
          <div className="text-center border-l border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Distance
            </span>
            <span className="text-xl font-black font-mono text-slate-200">
              {Math.round(distance)} <span className="text-xs font-normal text-slate-400">M</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Resume */}
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm px-4 py-3.5 rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer transform active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-current" />
            RESUME DRIVE
          </button>

          {/* Restart */}
          <button
            onClick={() => {
              sound.init();
              onRestart();
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-sm px-4 py-3 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            Restart Run
          </button>

          {/* Instructions */}
          <button
            onClick={onOpenTutorial}
            className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-sm px-4 py-3 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-fuchsia-400" />
            Controls & Safety Rules
          </button>

          {/* Exit to Main Menu */}
          <button
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 font-bold text-sm px-4 py-3 rounded-xl border border-rose-800/50 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-rose-400" />
            Exit to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
