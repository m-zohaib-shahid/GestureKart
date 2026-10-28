import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import { CivicStats, LeaderboardEntry } from '../../types/game';
import { Download, RefreshCw, Trophy, ShieldCheck, AlertTriangle, Award, Car, Siren, AlertOctagon } from 'lucide-react';

interface CivicScorecardModalProps {
  stats: CivicStats;
  onRestart: () => void;
  onExitToMenu?: () => void;
}

const LEADERBOARD_KEY = 'gesturekart_civic_leaderboard';

export function CivicScorecardModal({ stats, onRestart, onExitToMenu }: CivicScorecardModalProps) {
  const [driverName, setDriverName] = useState<string>('Driver Cadet');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'LICENSE' | 'LEADERBOARD'>('LICENSE');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate Civic Grade
  const calculateGrade = (score: number, violations: number, fails: number): LeaderboardEntry['grade'] => {
    if (fails >= 2 || violations >= 3 || score < 500) return 'DISQUALIFIED';
    if (score >= 1400) return 'S';
    if (score >= 1200) return 'A+';
    if (score >= 1000) return 'A';
    if (score >= 800) return 'B';
    return 'C';
  };

  const grade = calculateGrade(stats.score, stats.redViolations, stats.ambulanceFails);

  // Trigger celebration confetti for good grades
  useEffect(() => {
    if (grade === 'S' || grade === 'A+' || grade === 'A') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#facc15', '#38bdf8', '#ffffff'],
      });
    }
  }, [grade]);

  // Load and save LocalStorage leaderboard
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LEADERBOARD_KEY);
      let entries: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];

      const currentEntry: LeaderboardEntry = {
        id: `run-${Date.now()}`,
        driverName: driverName.trim() || 'Driver Cadet',
        score: stats.score,
        grade,
        distance: Math.round(stats.distance),
        safeStops: stats.safeStops,
        violations: stats.redViolations + stats.ambulanceFails,
        ambulanceYields: stats.ambulanceYields,
        date: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      entries.push(currentEntry);
      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, 10); // Keep top 10

      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
      setLeaderboard(entries);
    } catch (e) {
      console.warn('LocalStorage unavailable for leaderboard', e);
    }
  }, [stats.score, stats.distance, stats.safeStops, stats.redViolations, stats.ambulanceYields, stats.ambulanceFails, grade]);

  // Generate downloadable Civic Driving License PDF
  const handleExportPDF = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#090d16',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [140, 90], // Standard ID card / landscape format
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 140, 90);
      const sanitizedName = driverName.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Cadet';
      pdf.save(`GestureKart-Civic-License-${sanitizedName}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPositive = stats.safeStops * 150 + stats.ambulanceYields * 200;
  const totalNegative = stats.redViolations * 200 + stats.ambulanceFails * 150 + stats.coneStrikes * 50;
  const complianceRate = Math.max(
    0,
    Math.min(100, Math.round((totalPositive / Math.max(1, totalPositive + totalNegative)) * 100))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Civic Driving Assessment
              </h2>
              <p className="text-xs text-slate-400">Lahore Road Safety & Emergency Response Evaluation</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('LICENSE')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'LICENSE'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Driving License
            </button>
            <button
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'LEADERBOARD'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Leaderboard
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'LICENSE' ? (
            <>
              {/* Driver Name Input Field */}
              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  License Holder:
                </label>
                <input
                  type="text"
                  value={driverName}
                  maxLength={24}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Enter your name..."
                  className="bg-slate-900 border border-slate-700 text-sm font-semibold text-amber-300 px-3 py-1.5 rounded-lg w-full focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Printable Civic License Card (Export Target) */}
              <div
                ref={cardRef}
                id="civic-license-card"
                className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-700 rounded-xl p-5 shadow-2xl text-slate-100 overflow-hidden font-sans"
              >
                {/* Background Watermark */}
                <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none text-slate-400">
                  <Car className="w-56 h-56" />
                </div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

                {/* Card Header */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] font-mono tracking-widest text-amber-400 font-bold uppercase">
                        CIVIC SAFETY COMMISSION • LAHORE REGION
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold tracking-wide text-white">
                      SMART MOBILITY DRIVING PERMIT
                    </h3>
                  </div>

                  {/* Grade Badge */}
                  <div
                    className={`px-3 py-1 rounded-lg border font-mono font-extrabold text-sm tracking-wider ${
                      grade === 'S' || grade === 'A+'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : grade === 'A'
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                        : grade === 'B' || grade === 'C'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    GRADE {grade}
                  </div>
                </div>

                {/* License Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] font-mono text-slate-400 uppercase">Civic Score</p>
                    <p className="text-xl font-black font-mono text-amber-300">
                      {stats.score} <span className="text-xs text-slate-400 font-normal">PTS</span>
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] font-mono text-slate-400 uppercase">Distance</p>
                    <p className="text-xl font-black font-mono text-slate-100">
                      {Math.round(stats.distance)} <span className="text-xs text-slate-400 font-normal">M</span>
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] font-mono text-slate-400 uppercase">Compliance</p>
                    <p className="text-xl font-black font-mono text-emerald-400">
                      {complianceRate}%
                    </p>
                  </div>

                  {/* Emergency Yields Bonus */}
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                        <Siren className="w-3 h-3 text-amber-400" />
                        Ambulance Yields
                      </p>
                      <p className="text-lg font-bold font-mono text-emerald-400">
                        +{stats.ambulanceYields * 200} PTS
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                      {stats.ambulanceYields}x
                    </span>
                  </div>

                  {/* Blocked Ambulances Penalty */}
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-rose-400" />
                        Yield Blocked
                      </p>
                      <p className="text-lg font-bold font-mono text-rose-400">
                        -{stats.ambulanceFails * 150} PTS
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                      {stats.ambulanceFails}x
                    </span>
                  </div>

                  {/* Hazard Cone Collisions */}
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 uppercase">Cone Strikes</p>
                      <p className="text-lg font-bold font-mono text-rose-400">
                        -{stats.coneStrikes * 50} PTS
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                      {stats.coneStrikes}x
                    </span>
                  </div>
                </div>

                {/* Card Footer Bar */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                  <div>
                    HOLDER: <span className="text-amber-300 font-bold uppercase">{driverName || 'CADET'}</span>
                  </div>
                  <div>
                    AUTHENTICATED CLIENT-SIDE • {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm px-4 py-3 rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  {isExporting ? 'Generating PDF...' : 'Download License PDF'}
                </button>

                <button
                  onClick={onRestart}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-4 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Drive Again
                </button>

                {onExitToMenu && (
                  <button
                    onClick={onExitToMenu}
                    className="px-4 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Main Menu
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Local Leaderboard View */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-3">
                <span className="font-mono uppercase">Top Safe Drivers (LocalStorage)</span>
                <span>{leaderboard.length} records</span>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No leaderboard scores yet. Complete a drive to set the first record!
                  </div>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 text-center font-mono font-bold text-sm ${
                            idx === 0
                              ? 'text-yellow-400'
                              : idx === 1
                              ? 'text-slate-300'
                              : idx === 2
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-200">{entry.driverName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {entry.distance}m • {entry.safeStops} safe stops • {entry.ambulanceYields || 0} yields
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                            entry.grade === 'S' || entry.grade === 'A+'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : entry.grade === 'A'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : entry.grade === 'B'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {entry.grade}
                        </span>
                        <span className="font-mono font-black text-amber-300 text-base">
                          {entry.score}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onRestart}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-4 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Drive Again
                </button>

                {onExitToMenu && (
                  <button
                    onClick={onExitToMenu}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Main Menu
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
