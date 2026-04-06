"use client";

import { useState, useEffect, useRef } from "react";
import { Team } from "@/lib/types";
import { Round4Setup, Round4Result, POINTS_WIN, POINTS_LOSE } from "@/lib/round4";
import { useTimer } from "@/lib/useTimer";
import { useGame } from "@/context/GameContext";

const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500" },
  amber:  { badge: "bg-amber-500",  text: "text-amber-300",  ring: "stroke-amber-500"  },
  sky:    { badge: "bg-sky-500",    text: "text-sky-300",    ring: "stroke-sky-500"    },
  rose:   { badge: "bg-rose-500",   text: "text-rose-300",   ring: "stroke-rose-500"   },
};

function TimerRing({
  remaining,
  progress,
  color,
}: {
  remaining: number;
  progress: number;
  color: string;
}) {
  const r = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const isLow = remaining <= 5 && remaining > 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="150" height="150" className="-rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800" />
        <circle
          cx="75" cy="75" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          className={`${isLow ? "stroke-red-500" : color} transition-all duration-1000`}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-black tabular-nums leading-none ${isLow ? "text-red-400 animate-pulse" : "text-white"}`}>
          {String(remaining).padStart(2, "0")}
        </span>
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">segundos</span>
      </div>
    </div>
  );
}

export default function Play({
  setup,
  teams,
  onComplete,
}: {
  setup: Round4Setup;
  teams: Team[];
  onComplete: (result: Round4Result) => void;
}) {
  const { game: gameCtx, setGame } = useGame();

  // Randomize starting team once on mount
  const [currentTeamIdx, setCurrentTeamIdx] = useState(
    () => Math.floor(Math.random() * teams.length)
  );
  const [phase, setPhase] = useState<"turn" | "over">("turn");
  const [usedAnswers, setUsedAnswers] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [losingTeamId, setLosingTeamId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<"timeout" | "invalid" | null>(null);

  // Keep a ref to usedAnswers for the timer callback (avoids stale closure)
  const usedAnswersRef = useRef(usedAnswers);
  const currentTeamIdxRef = useRef(currentTeamIdx);
  usedAnswersRef.current = usedAnswers;
  currentTeamIdxRef.current = currentTeamIdx;

  const timer = useTimer();
  const currentTeam = teams[currentTeamIdx];
  const tc = TEAM_COLOR[currentTeam.color];

  const finalize = (lostId: string, reason: "timeout" | "invalid", finalAnswers: string[]) => {
    const winIds = teams.filter((t) => t.id !== lostId).map((t) => t.id);
    if (gameCtx) {
      setGame({
        ...gameCtx,
        teams: gameCtx.teams.map((t) => {
          if (winIds.includes(t.id)) return { ...t, score: t.score + POINTS_WIN };
          if (t.id === lostId) return { ...t, score: t.score + POINTS_LOSE };
          return t;
        }),
      });
    }
    setLosingTeamId(lostId);
    setEndReason(reason);
    setPhase("over");
    onComplete({
      topic: setup.topic,
      usedAnswers: finalAnswers,
      losingTeamId: lostId,
      winningTeamIds: winIds,
      endReason: reason,
    });
  };

  const handleTimeout = () => {
    const lostId = teams[currentTeamIdxRef.current].id;
    finalize(lostId, "timeout", usedAnswersRef.current);
  };

  // Start timer on mount and when team changes
  useEffect(() => {
    if (phase === "turn") {
      timer.start(setup.turnDuration, handleTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeamIdx, phase]);

  const handleValid = () => {
    const answer = currentInput.trim();
    if (!answer) return;
    timer.stop();
    const newAnswers = [...usedAnswers, answer];
    setUsedAnswers(newAnswers);
    usedAnswersRef.current = newAnswers;
    setCurrentInput("");
    const nextIdx = (currentTeamIdx + 1) % teams.length;
    setCurrentTeamIdx(nextIdx);
    currentTeamIdxRef.current = nextIdx;
    // Timer will restart via useEffect on currentTeamIdx change
  };

  const handleInvalid = () => {
    timer.stop();
    finalize(currentTeam.id, "invalid", usedAnswers);
  };

  if (phase === "over") return null; // _content.tsx will show Results

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Ronda 4 · Cultura musical
        </p>
        <p className="text-sm font-bold text-white mt-0.5 truncate">{setup.topic}</p>
      </header>

      {/* Live score bar */}
      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => {
          const tcc = TEAM_COLOR[team.color];
          const isCurrent = team.id === currentTeam.id;
          return (
            <div
              key={team.id}
              className={`flex flex-col items-center px-5 py-2 rounded-2xl font-bold transition-all ${
                isCurrent ? `${tcc.badge} text-white shadow-lg` : "bg-canvas-800 text-zinc-300"
              }`}
            >
              <span className={`text-xs uppercase tracking-wide leading-none mb-1 ${isCurrent ? "text-white/80" : tcc.text}`}>
                {team.name}
              </span>
              <span className="text-2xl font-black tabular-nums leading-none">{team.score}</span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-5 max-w-sm mx-auto w-full">
        <div className="flex-1 flex flex-col w-full gap-5 justify-center">
          {/* Current team + timer */}
          <div className="text-center">
            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${tc.badge} text-white`}>
              {currentTeam.name}
            </span>
          </div>

          <div className="flex justify-center">
            <TimerRing
              remaining={timer.remaining}
              progress={timer.progress}
              color={tc.ring}
            />
          </div>

          {/* Answer input */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Escribe la respuesta del equipo…"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentInput.trim()) handleValid();
              }}
              autoFocus
              className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-base focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleInvalid}
                className="flex-1 py-4 rounded-2xl font-black text-base bg-red-900/60 hover:bg-red-900 text-red-300 border border-red-800/50 active:scale-95 transition-all"
              >
                ✗ No válida
              </button>
              <button
                onClick={handleValid}
                disabled={!currentInput.trim()}
                className={`flex-1 py-4 rounded-2xl font-black text-base active:scale-95 transition-all ${
                  currentInput.trim()
                    ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                    : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
                }`}
              >
                ✓ Válida
              </button>
            </div>
          </div>

          {/* Used answers list */}
          {usedAnswers.length > 0 && (
            <div className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-2 border-b border-canvas-700/60">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Respuestas usadas ({usedAnswers.length})
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-canvas-700/40">
                {[...usedAnswers].reverse().map((ans, i) => (
                  <div key={i} className="px-4 py-2 flex items-center gap-2">
                    <span className="text-zinc-600 text-xs font-mono">{usedAnswers.length - i}.</span>
                    <span className="text-sm text-zinc-300">{ans}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
