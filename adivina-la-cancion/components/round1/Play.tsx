"use client";

import { useState, useCallback, useRef } from "react";
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
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount } from "@/lib/wildcardUtils";
import { useGame } from "@/context/GameContext";

// ─── Sub-components ───────────────────────────────────────────

const TEAM_COLOR: Record<string, { ring: string; badge: string; text: string }> = {
  violet: { ring: "stroke-violet-500", badge: "bg-violet-500", text: "text-violet-300" },
  amber:  { ring: "stroke-amber-500",  badge: "bg-amber-500",  text: "text-amber-300"  },
  sky:   { ring: "stroke-sky-500",   badge: "bg-sky-500",   text: "text-sky-300"   },
  rose:   { ring: "stroke-rose-500",   badge: "bg-rose-500",   text: "text-rose-300"   },
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
  const ringColor = isLow ? "stroke-red-500" : phase === "fragment" ? "stroke-zinc-300" : "stroke-amber-500";
  const textColor = isLow ? "text-red-400" : phase === "fragment" ? "text-zinc-300" : "text-amber-300";
  const label = phase === "fragment" ? "fragmento" : "responde";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800" />
        <circle
          cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          className={`${ringColor} transition-all duration-1000`}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-6xl font-black tabular-nums leading-none ${textColor} ${isLow ? "animate-pulse" : ""}`}>
          {String(remaining).padStart(2, "0")}
        </span>
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">{label}</span>
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
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas-900/80 border border-canvas-700 text-xs transition-all active:scale-95"
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

function SongRevealJudging({ song, cantanteMode }: { song: SongEntry; cantanteMode: boolean }) {
  const title = cantanteMode ? "(título no requerido)" : (song.title || "(sin título)");
  const artist = song.artist ? `de ${song.artist}` : "";
  return (
    <div className="bg-canvas-900 border border-canvas-700/50 rounded-2xl px-5 py-4 text-center">
      {cantanteMode && (
        <p className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-widest">
          🎤 Solo artista válido
        </p>
      )}
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Canción</p>
      <p className={`text-xl font-black ${cantanteMode ? "text-zinc-500 line-through" : "text-white"}`}>
        {song.title || "(sin título)"}
      </p>
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
  const { adjustScore } = useGame();
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>("idle");
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  // ── Wildcard state
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [blockedPlayer, setBlockedPlayer] = useState<{ name: string } | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null); // banner text

  // Track which phase was active when wildcard modal opened, to resume correctly
  const pausedPhaseRef = useRef<TurnPhase | null>(null);

  // ── Turn info
  const turn = setup.turnOrder[turnIndex];
  const currentTeam = teams.find((t) => t.id === turn.teamId)!;
  const currentSong = setup.songsByTeam[turn.teamId][turn.songIndex];
  const total = totalTurns(setup);
  const tc = TEAM_COLOR[currentTeam.color];

  // ── Timers
  // Store the "onComplete" callback for fragment phase so we can restore it after resume
  const fragmentEndCallbackRef = useRef<(() => void) | null>(null);
  const responseEndCallbackRef = useRef<(() => void) | null>(null);

  const fragmentTimer = useTimer();
  const responseTimer = useTimer();

  const handleFragmentEnd = useCallback(() => {
    setPhase("response");
    responseTimer.start(setup.responseDuration, () => setPhase("judging"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.responseDuration]);

  // Store callbacks in refs so we can re-attach after modal pause
  fragmentEndCallbackRef.current = handleFragmentEnd;
  responseEndCallbackRef.current = () => setPhase("judging");

  // ── Phase handlers
  const startFragment = () => {
    setPhase("fragment");
    setCantanteMode(false);
    setBlockedPlayer(null);
    setActiveEffect(null);
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
    if (correct) adjustScore(turn.teamId, POINTS_CORRECT);
    const result: TurnResult = { teamId: turn.teamId, song: currentSong, correct };
    const newResults = [...results, result];
    setResults(newResults);
    setLastResult(correct);
    setCantanteMode(false);
    setBlockedPlayer(null);
    setActiveEffect(null);

    if (turnIndex + 1 >= total) {
      onComplete(newResults);
    } else {
      setTurnIndex((i) => i + 1);
      setPhase("idle");
    }
  };

  // ── Wildcard modal handlers
  const openWildcard = (teamId: string) => {
    pausedPhaseRef.current = phase;
    if (phase === "fragment") fragmentTimer.stop();
    if (phase === "response") responseTimer.stop();
    setWildcardTeamId(teamId);
  };

  const closeWildcard = () => {
    setWildcardTeamId(null);
    const paused = pausedPhaseRef.current;
    if (paused === "fragment") fragmentTimer.resume(handleFragmentEnd);
    if (paused === "response") responseTimer.resume(() => setPhase("judging"));
    pausedPhaseRef.current = null;
  };

  const applyWildcardEffect = (effect: WildcardEffect) => {
    switch (effect.wildcardId) {
      case "tiempo":
        fragmentTimer.addTime(effect.tiempo?.extraSeconds ?? 15);
        setActiveEffect(`⏱ +${effect.tiempo?.extraSeconds ?? 15}s añadidos al fragmento`);
        break;
      case "cantante":
        setCantanteMode(true);
        setActiveEffect("🎤 Solo artista válido");
        break;
      case "silencio":
        if (effect.silencio) {
          setBlockedPlayer({ name: effect.silencio.playerName });
          setActiveEffect(`🔇 ${effect.silencio.playerName} bloqueado/a`);
        }
        break;
      case "robo":
        setActiveEffect("🎭 Robo activo — cambia la canción al del rival");
        break;
      case "otra":
        setActiveEffect("🔄 Nueva canción — el presentador elige otra");
        break;
      case "supercomodin":
        if (effect.supercomodin) {
          setActiveEffect(`⭐ Supercomodín — ${effect.supercomodin.points} pts transferidos`);
        }
        break;
    }
  };

  const handleWildcardUsed = (effect: WildcardEffect) => {
    applyWildcardEffect(effect);
    closeWildcard();
  };

  // ── Active timer for display
  const activeTimer = phase === "fragment" ? fragmentTimer : responseTimer;
  const songNumber = turn.songIndex + 1;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ronda 1 · Lo básico
          </p>
          <p className="text-sm text-zinc-400 mt-0.5">
            Turno <span className="font-bold text-white">{turnIndex + 1}/{total}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="flex gap-1">
            {setup.turnOrder.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < turnIndex
                    ? results[i]?.correct ? "bg-green-500" : "bg-zinc-600"
                    : i === turnIndex ? tc.badge : "bg-canvas-800"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Live score bar — always visible during play */}
      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => {
          const tcc = TEAM_COLOR[team.color];
          const isCurrent = team.id === currentTeam.id;
          return (
            <div
              key={team.id}
              className={`flex flex-col items-center px-5 py-2 rounded-2xl font-bold transition-all ${
                isCurrent
                  ? `${tcc.badge} text-white shadow-lg`
                  : "bg-canvas-800 text-zinc-300"
              }`}
            >
              <span className={`text-xs uppercase tracking-wide leading-none mb-1 ${isCurrent ? "text-white/80" : tcc.text}`}>
                {team.name}
              </span>
              <span className="text-2xl font-black tabular-nums leading-none">
                {team.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active effect banner */}
      {activeEffect && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold text-center">
          {activeEffect}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-6 max-w-sm mx-auto w-full">

        {/* ── IDLE ───────────────────────────────────── */}
        {phase === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            {lastResult !== null && (
              <div className={`w-full text-center py-2.5 rounded-xl text-sm font-bold ${
                lastResult
                  ? "bg-green-500/15 text-green-400 border border-green-500/30"
                  : "bg-canvas-800/60 text-zinc-400 border border-canvas-700/40"
              }`}>
                {lastResult ? `+${POINTS_CORRECT} pts ✓` : "0 pts — Fallo"}
              </div>
            )}

            <div className="text-center">
              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${tc.badge} text-white`}>
                {currentTeam.name}
              </span>
              <p className="text-4xl font-black">Canción {songNumber}</p>
              <p className="text-zinc-500 text-sm mt-1">de {SONGS_PER_TEAM} · sin rebote</p>
            </div>

            <SongReveal song={currentSong} />

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={startFragment}
                className="w-full py-5 rounded-2xl font-black text-xl bg-white hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900 font-black shadow-lg shadow-black/20"
              >
                ▶ Reproducir fragmento
              </button>
              {teams.map((team) => {
                const ctx: WildcardContext = team.id === currentTeam.id ? "my_turn" : "rival_turn";
                const count = availableCount(team.wildcards, ctx);
                const tcc = TEAM_COLOR[team.color];
                return (
                  <button
                    key={team.id}
                    onClick={count > 0 ? () => openWildcard(team.id) : undefined}
                    disabled={count === 0}
                    className={`w-full py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-between px-4 ${
                      count > 0
                        ? "bg-canvas-800 hover:bg-canvas-700 active:scale-95 text-zinc-300"
                        : "bg-canvas-900 text-zinc-600 cursor-default"
                    }`}
                  >
                    <span>🃏 <span className={tcc.text}>{team.name}</span></span>
                    <span className={count > 0 ? tcc.text : "text-zinc-700"}>
                      {count > 0 ? `${count} comodín${count !== 1 ? "es" : ""}` : "agotados"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FRAGMENT / RESPONSE ───────────────────── */}
        {(phase === "fragment" || phase === "response") && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            <div className="text-center pt-2">
              <span className={`text-sm font-bold ${tc.text}`}>{currentTeam.name}</span>
              <p className="text-zinc-500 text-xs mt-0.5">Canción {songNumber}</p>
            </div>

            <TimerRing remaining={activeTimer.remaining} progress={activeTimer.progress} phase={phase} />

            <SongReveal song={currentSong} />

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={phase === "fragment" ? skipFragment : skipResponse}
                className="w-full py-3 rounded-2xl font-semibold text-sm bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-300"
              >
                {phase === "fragment" ? "Parar fragmento →" : "Ya respondieron →"}
              </button>
              <div className="flex gap-1.5">
                {teams.map((team) => {
                  const ctx: WildcardContext = team.id === currentTeam.id ? "my_turn" : "rival_turn";
                  const count = availableCount(team.wildcards, ctx);
                  const tcc = TEAM_COLOR[team.color];
                  return (
                    <button
                      key={team.id}
                      onClick={count > 0 ? () => openWildcard(team.id) : undefined}
                      disabled={count === 0}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                        count > 0
                          ? "bg-canvas-900 border border-canvas-700 hover:border-canvas-700 active:scale-95"
                          : "bg-canvas-900/50 border border-zinc-900 cursor-default"
                      }`}
                    >
                      <span className={count > 0 ? tcc.text : "text-zinc-700"}>
                        🃏 {team.name}
                      </span>
                      {count > 0 && (
                        <span className="block text-zinc-600 text-[10px] leading-none mt-0.5">{count} disp.</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── JUDGING ──────────────────────────────── */}
        {phase === "judging" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <div className="text-center">
              <span className={`text-sm font-bold ${tc.text}`}>{currentTeam.name}</span>
              <p className="text-2xl font-black mt-1">¿Acertaron?</p>
              {cantanteMode && (
                <p className="text-xs text-amber-400 font-bold mt-1">🎤 Solo artista válido</p>
              )}
            </div>

            <SongRevealJudging song={currentSong} cantanteMode={cantanteMode} />

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => judge(true)}
                className="w-full py-5 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-600/20"
              >
                ✓ Acierto &nbsp;+{POINTS_CORRECT} pts
              </button>
              <button
                onClick={() => judge(false)}
                className="w-full py-4 rounded-2xl font-bold text-base bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-300"
              >
                ✗ Fallo &nbsp;· 0 pts
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wildcard modal — pauses timers */}
      {wildcardTeamId && (() => {
        const wildcardTeam = teams.find((t) => t.id === wildcardTeamId)!;
        const ctx: WildcardContext = wildcardTeamId === currentTeam.id ? "my_turn" : "rival_turn";
        return (
          <WildcardModal
            team={wildcardTeam}
            allTeams={teams}
            context={ctx}
            onClose={closeWildcard}
            onUsed={handleWildcardUsed}
          />
        );
      })()}
    </div>
  );
}
