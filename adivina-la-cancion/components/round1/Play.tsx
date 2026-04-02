"use client";

import { useState, useCallback } from "react";
import { Team } from "@/lib/types";
import {
  Round1Setup,
  TurnResult,
  SongEntry,
  totalTurns,
  POINTS_CORRECT,
  SONGS_PER_TEAM,
} from "@/lib/round1";
import { useTimer } from "@/lib/useTimer";

// ─── Sub-components ───────────────────────────────────────────

const TEAM_COLOR: Record<string, { ring: string; badge: string; text: string }> = {
  violet: { ring: "stroke-violet-500", badge: "bg-violet-500", text: "text-violet-300" },
  amber: { ring: "stroke-amber-500", badge: "bg-amber-500", text: "text-amber-300" },
  teal: { ring: "stroke-teal-500", badge: "bg-teal-500", text: "text-teal-300" },
  rose: { ring: "stroke-rose-500", badge: "bg-rose-500", text: "text-rose-300" },
};

type TurnPhase = "idle" | "fragment" | "response" | "judging";

function TimerRing({
  remaining,
  progress,
  phase,
}: {
  remaining: number;
  progress: number;
  phase: TurnPhase;
}) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  const isLow = remaining <= 5 && remaining > 0;
  const ringColor =
    isLow
      ? "stroke-red-500"
      : phase === "fragment"
      ? "stroke-violet-500"
      : "stroke-amber-500";
  const textColor = isLow
    ? "text-red-400"
    : phase === "fragment"
    ? "text-violet-300"
    : "text-amber-300";
  const label = phase === "fragment" ? "fragmento" : "responde";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-zinc-800"
        />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className={`${ringColor} transition-all duration-1000`}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-6xl font-black tabular-nums leading-none ${textColor} ${
            isLow ? "animate-pulse" : ""
          }`}
        >
          {String(remaining).padStart(2, "0")}
        </span>
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
          {label}
        </span>
      </div>
    </div>
  );
}

function SongReveal({ song }: { song: SongEntry }) {
  const [revealed, setRevealed] = useState(false);
  const label = [song.title, song.artist].filter(Boolean).join(" — ") || "Sin info";

  return (
    <button
      onClick={() => setRevealed((v) => !v)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs transition-all active:scale-95"
    >
      <span className="text-zinc-500">{revealed ? "🙈" : "👁"}</span>
      {revealed ? (
        <span className="text-zinc-300 font-medium">{label}</span>
      ) : (
        <span className="text-zinc-600">Ver canción</span>
      )}
    </button>
  );
}

function SongRevealJudging({ song }: { song: SongEntry }) {
  const title = song.title || "(sin título)";
  const artist = song.artist ? `de ${song.artist}` : "";
  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl px-5 py-4 text-center">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Canción</p>
      <p className="text-xl font-black text-white">{title}</p>
      {artist && <p className="text-sm text-zinc-400 mt-0.5">{artist}</p>}
    </div>
  );
}

// ─── Main Play component ──────────────────────────────────────

export default function Play({
  setup,
  teams,
  onComplete,
}: {
  setup: Round1Setup;
  teams: Team[];
  onComplete: (results: TurnResult[]) => void;
}) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>("idle");
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  // Each render, compute current turn info
  const turn = setup.turnOrder[turnIndex];
  const currentTeam = teams.find((t) => t.id === turn.teamId)!;
  const currentSong = setup.songsByTeam[turn.teamId][turn.songIndex];
  const total = totalTurns(setup);
  const tc = TEAM_COLOR[currentTeam.color];

  // ── Fragment timer → auto-start response timer
  const handleFragmentEnd = useCallback(() => {
    setPhase("response");
    responseTimer.start(setup.responseDuration, () => setPhase("judging"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.responseDuration]);

  const fragmentTimer = useTimer();
  const responseTimer = useTimer();

  // ── Phase handlers
  const startFragment = () => {
    setPhase("fragment");
    fragmentTimer.start(setup.fragmentDuration, handleFragmentEnd);
  };

  const skipFragment = () => {
    fragmentTimer.stop();
    handleFragmentEnd();
  };

  const skipResponse = () => {
    responseTimer.stop();
    setPhase("judging");
  };

  const judge = (correct: boolean) => {
    const result: TurnResult = { teamId: turn.teamId, song: currentSong, correct };
    const newResults = [...results, result];
    setResults(newResults);
    setLastResult(correct);

    if (turnIndex + 1 >= total) {
      onComplete(newResults);
    } else {
      setTurnIndex((i) => i + 1);
      setPhase("idle");
    }
  };

  // ── Active timer values
  const activeTimer = phase === "fragment" ? fragmentTimer : responseTimer;

  // ── Next team info (for idle screen)
  const nextTeam = currentTeam;
  const songNumber = turn.songIndex + 1;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-zinc-800/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ronda 1 · Lo básico
          </p>
          <p className="text-sm text-zinc-400 mt-0.5">
            Turno{" "}
            <span className="font-bold text-white">
              {turnIndex + 1}/{total}
            </span>
          </p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1">
          {setup.turnOrder.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < turnIndex
                  ? results[i]?.correct
                    ? "bg-green-500"
                    : "bg-zinc-600"
                  : i === turnIndex
                  ? tc.badge
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-6 max-w-sm mx-auto w-full">

        {/* ── IDLE ──────────────────────────────────── */}
        {phase === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            {/* Previous result */}
            {lastResult !== null && (
              <div
                className={`w-full text-center py-2.5 rounded-xl text-sm font-bold ${
                  lastResult
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/40"
                }`}
              >
                {lastResult ? `+${POINTS_CORRECT} pts ✓` : "0 pts — Fallo"}
              </div>
            )}

            {/* Team chip */}
            <div className="text-center">
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${tc.badge} text-white`}
              >
                {nextTeam.name}
              </span>
              <p className="text-4xl font-black">
                Canción {songNumber}
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                de {SONGS_PER_TEAM} &nbsp;·&nbsp; sin rebote
              </p>
            </div>

            {/* Song preview (discreet) */}
            <SongReveal song={currentSong} />

            {/* Start button */}
            <button
              onClick={startFragment}
              className="w-full py-5 rounded-2xl font-black text-xl bg-violet-500 hover:bg-violet-400 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
            >
              ▶ Reproducir fragmento
            </button>
          </div>
        )}

        {/* ── FRAGMENT / RESPONSE ──────────────────── */}
        {(phase === "fragment" || phase === "response") && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            {/* Team + song info */}
            <div className="text-center pt-2">
              <span className={`text-sm font-bold ${tc.text}`}>{currentTeam.name}</span>
              <p className="text-zinc-500 text-xs mt-0.5">Canción {songNumber}</p>
            </div>

            {/* Big timer */}
            <TimerRing
              remaining={activeTimer.remaining}
              progress={activeTimer.progress}
              phase={phase}
            />

            {/* Song reveal (discreet, top-right area) */}
            <SongReveal song={currentSong} />

            {/* Skip button */}
            <button
              onClick={phase === "fragment" ? skipFragment : skipResponse}
              className="w-full py-3 rounded-2xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all text-zinc-300"
            >
              {phase === "fragment"
                ? "Parar fragmento →"
                : "Ya respondieron →"}
            </button>
          </div>
        )}

        {/* ── JUDGING ──────────────────────────────── */}
        {phase === "judging" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <div className="text-center">
              <span className={`text-sm font-bold ${tc.text}`}>{currentTeam.name}</span>
              <p className="text-2xl font-black mt-1">¿Acertaron?</p>
            </div>

            <SongRevealJudging song={currentSong} />

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => judge(true)}
                className="w-full py-5 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-600/20"
              >
                ✓ Acierto &nbsp;+{POINTS_CORRECT} pts
              </button>
              <button
                onClick={() => judge(false)}
                className="w-full py-4 rounded-2xl font-bold text-base bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all text-zinc-300"
              >
                ✗ Fallo &nbsp;· 0 pts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
