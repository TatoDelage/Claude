"use client";

import { useState, useCallback, useRef } from "react";
import { Team } from "@/lib/types";
import {
  Round2Setup,
  TurnResult,
  ReboundResult,
  SongEntry,
  POINTS_CORRECT,
  POINTS_FAIL,
  SONGS_PER_TEAM,
  totalTurns,
} from "@/lib/round2";
import { useTimer } from "@/lib/useTimer";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount } from "@/lib/wildcardUtils";

// ─── Color maps ───────────────────────────────────────────────

const TEAM_COLOR: Record<string, { ring: string; badge: string; text: string }> = {
  violet: { ring: "stroke-emerald-500", badge: "bg-violet-500", text: "text-violet-300" },
  amber:  { ring: "stroke-amber-500",  badge: "bg-amber-500",  text: "text-amber-300"  },
  sky:   { ring: "stroke-sky-500",   badge: "bg-sky-500",   text: "text-sky-300"   },
  rose:   { ring: "stroke-rose-500",   badge: "bg-rose-500",   text: "text-rose-300"   },
};

// ─── Turn phases ──────────────────────────────────────────────

type TurnPhase =
  | "idle"
  | "fragment"
  | "response"
  | "judging"
  | "rebound_offer"    // asking rival team: pass or respond?
  | "rebound_response" // rival team responding with timer
  | "rebound_judging"; // judging the rival's answer

// ─── Sub-components ───────────────────────────────────────────

function TimerRing({
  remaining,
  progress,
  color,
  label,
}: {
  remaining: number;
  progress: number;
  color: string;
  label: string;
}) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const isLow = remaining <= 5 && remaining > 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800" />
        <circle
          cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          className={`${isLow ? "stroke-red-500" : color} transition-all duration-1000`}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-6xl font-black tabular-nums leading-none ${isLow ? "text-red-400 animate-pulse" : "text-white"}`}>
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
      {song.artist && <p className="text-sm text-zinc-400 mt-0.5">de {song.artist}</p>}
    </div>
  );
}

// ─── Main Play component ──────────────────────────────────────

export default function Play({
  setup,
  teams,
  onComplete,
}: {
  setup: Round2Setup;
  teams: Team[];
  onComplete: (results: TurnResult[]) => void;
}) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>("idle");
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lastResult, setLastResult] = useState<{ primaryCorrect: boolean; rebounds: ReboundResult[] } | null>(null);

  // Wildcard state
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [blockedPlayer, setBlockedPlayer] = useState<{ name: string } | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  // Rebound tracking
  const [reboundIdx, setReboundIdx] = useState(0);
  const [currentRebounds, setCurrentRebounds] = useState<ReboundResult[]>([]);

  const pausedPhaseRef = useRef<TurnPhase | null>(null);

  // Turn info
  const turn = setup.turnOrder[turnIndex];
  const currentTeam = teams.find((t) => t.id === turn.teamId)!;
  const currentSong = setup.songsByTeam[turn.teamId][turn.songIndex];
  const total = totalTurns(setup);
  const tc = TEAM_COLOR[currentTeam.color];
  const rivalTeams = teams.filter((t) => t.id !== currentTeam.id);
  const reboundTeam = reboundIdx < rivalTeams.length ? rivalTeams[reboundIdx] : null;

  // Timers
  const fragmentTimer = useTimer();
  const responseTimer = useTimer();

  const handleFragmentEnd = useCallback(() => {
    setPhase("response");
    responseTimer.start(setup.responseDuration, () => setPhase("judging"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.responseDuration]);

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

  // Finalize a turn: store result, advance or complete
  const finalizeTurn = (result: TurnResult) => {
    const newResults = [...results, result];
    setResults(newResults);
    setLastResult({ primaryCorrect: result.primaryCorrect, rebounds: result.rebounds });
    setCantanteMode(false);
    setBlockedPlayer(null);
    setActiveEffect(null);
    setReboundIdx(0);
    setCurrentRebounds([]);

    if (turnIndex + 1 >= total) {
      onComplete(newResults);
    } else {
      setTurnIndex((i) => i + 1);
      setPhase("idle");
    }
  };

  // Primary judging
  const judgePrimary = (correct: boolean) => {
    if (correct || rivalTeams.length === 0) {
      finalizeTurn({ teamId: turn.teamId, song: currentSong, primaryCorrect: correct, rebounds: [] });
    } else {
      // Start rebound sequence for rival teams
      setCurrentRebounds([]);
      setReboundIdx(0);
      setPhase("rebound_offer");
    }
  };

  // Advance to next rebound team or finalize
  const advanceRebound = (rebounds: ReboundResult[]) => {
    const nextIdx = reboundIdx + 1;
    if (nextIdx < rivalTeams.length) {
      setReboundIdx(nextIdx);
      setPhase("rebound_offer");
    } else {
      finalizeTurn({ teamId: turn.teamId, song: currentSong, primaryCorrect: false, rebounds });
    }
  };

  const handleReboundPass = () => {
    const rb: ReboundResult = { teamId: rivalTeams[reboundIdx].id, choice: "pass" };
    const updated = [...currentRebounds, rb];
    setCurrentRebounds(updated);
    advanceRebound(updated);
  };

  const handleReboundRespond = () => {
    setPhase("rebound_response");
    responseTimer.start(setup.responseDuration, () => setPhase("rebound_judging"));
  };

  const skipReboundResponse = () => {
    responseTimer.stop();
    setPhase("rebound_judging");
  };

  const judgeRebound = (choice: "correct" | "wrong") => {
    const rb: ReboundResult = { teamId: rivalTeams[reboundIdx].id, choice };
    const updated = [...currentRebounds, rb];
    setCurrentRebounds(updated);
    advanceRebound(updated);
  };

  // ── Wildcard handlers

  const openWildcard = (teamId: string) => {
    pausedPhaseRef.current = phase;
    if (phase === "fragment") fragmentTimer.stop();
    if (phase === "response" || phase === "rebound_response") responseTimer.stop();
    setWildcardTeamId(teamId);
  };

  const closeWildcard = () => {
    setWildcardTeamId(null);
    const paused = pausedPhaseRef.current;
    if (paused === "fragment") fragmentTimer.resume(handleFragmentEnd);
    if (paused === "response") responseTimer.resume(() => setPhase("judging"));
    if (paused === "rebound_response") responseTimer.resume(() => setPhase("rebound_judging"));
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

  // ── Live score bar helpers

  const inRound: Record<string, number> = {};
  for (const r of results) {
    inRound[r.teamId] = (inRound[r.teamId] ?? 0) + (r.primaryCorrect ? POINTS_CORRECT : POINTS_FAIL);
    for (const rb of r.rebounds) {
      if (rb.choice === "correct") inRound[rb.teamId] = (inRound[rb.teamId] ?? 0) + POINTS_CORRECT;
      else if (rb.choice === "wrong") inRound[rb.teamId] = (inRound[rb.teamId] ?? 0) + POINTS_FAIL;
    }
  }

  // The team whose turn context determines wildcard context
  const activePlayTeamId =
    phase === "rebound_offer" || phase === "rebound_response" || phase === "rebound_judging"
      ? reboundTeam?.id ?? currentTeam.id
      : currentTeam.id;

  const songNumber = turn.songIndex + 1;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ronda 2 · Subimos nivel
          </p>
          <p className="text-sm text-zinc-400 mt-0.5">
            Turno <span className="font-bold text-white">{turnIndex + 1}/{total}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {setup.turnOrder.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < turnIndex
                  ? results[i]?.primaryCorrect ? "bg-green-500" : "bg-red-800"
                  : i === turnIndex ? tc.badge : "bg-canvas-800"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Live score bar */}
      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => {
          const tcc = TEAM_COLOR[team.color];
          const isCurrent = team.id === currentTeam.id;
          const displayScore = team.score + (inRound[team.id] ?? 0);
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
              <span className="text-2xl font-black tabular-nums leading-none">{displayScore}</span>
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

      {/* Blocked player banner */}
      {blockedPlayer && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-canvas-800 border border-canvas-700 text-zinc-400 text-xs text-center">
          🔇 {blockedPlayer.name} no puede responder
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-6 max-w-sm mx-auto w-full">

        {/* ── IDLE ─────────────────────────────────── */}
        {phase === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            {lastResult !== null && (
              <div className="w-full space-y-1.5">
                <div className={`w-full text-center py-2 rounded-xl text-sm font-bold ${
                  lastResult.primaryCorrect
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {lastResult.primaryCorrect ? `+${POINTS_CORRECT} pts ✓` : `${POINTS_FAIL} pts ✗ — Fallo`}
                </div>
                {lastResult.rebounds.filter((rb) => rb.choice !== "pass").map((rb) => {
                  const rbt = teams.find((t) => t.id === rb.teamId)!;
                  const tcc = TEAM_COLOR[rbt.color];
                  return (
                    <div key={rb.teamId} className={`w-full text-center py-1.5 rounded-xl text-xs font-bold ${
                      rb.choice === "correct"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      <span className={tcc.text}>{rbt.name}</span>
                      {" — Rebote: "}
                      {rb.choice === "correct" ? `+${POINTS_CORRECT}` : `${POINTS_FAIL}`}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-center">
              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${tc.badge} text-white`}>
                {currentTeam.name}
              </span>
              <p className="text-4xl font-black">Canción {songNumber}</p>
              <p className="text-zinc-500 text-sm mt-1">de {SONGS_PER_TEAM} · con rebote</p>
            </div>

            <SongReveal song={currentSong} />

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={startFragment}
                className="w-full py-5 rounded-2xl font-black text-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/25"
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

        {/* ── FRAGMENT / RESPONSE ─────────────────── */}
        {(phase === "fragment" || phase === "response") && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            <div className="text-center pt-2">
              <span className={`text-sm font-bold ${tc.text}`}>{currentTeam.name}</span>
              <p className="text-zinc-500 text-xs mt-0.5">Canción {songNumber}</p>
            </div>

            <TimerRing
              remaining={phase === "fragment" ? fragmentTimer.remaining : responseTimer.remaining}
              progress={phase === "fragment" ? fragmentTimer.progress : responseTimer.progress}
              color={phase === "fragment" ? "stroke-emerald-500" : "stroke-amber-500"}
              label={phase === "fragment" ? "fragmento" : "responde"}
            />

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
                      <span className={count > 0 ? tcc.text : "text-zinc-700"}>🃏 {team.name}</span>
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

        {/* ── JUDGING ─────────────────────────────── */}
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
                onClick={() => judgePrimary(true)}
                className="w-full py-5 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-600/20"
              >
                ✓ Acierto &nbsp;+{POINTS_CORRECT} pts
              </button>
              <button
                onClick={() => judgePrimary(false)}
                className="w-full py-4 rounded-2xl font-bold text-base bg-red-900/60 hover:bg-red-900 active:scale-95 transition-all text-red-300 border border-red-800/50"
              >
                ✗ Fallo &nbsp;{POINTS_FAIL} pts
                {rivalTeams.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-red-400/70">→ rebote</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── REBOUND OFFER ───────────────────────── */}
        {phase === "rebound_offer" && reboundTeam && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <div className="text-center space-y-2">
              <div className="text-3xl">↩️</div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest">Rebote</p>
              <p className="text-2xl font-black">
                ¿Responde{" "}
                <span className={TEAM_COLOR[reboundTeam.color].text}>{reboundTeam.name}</span>?
              </p>
              <p className="text-xs text-zinc-500">
                Acierto: +{POINTS_CORRECT} pts &nbsp;·&nbsp; Fallo: {POINTS_FAIL} pts
              </p>
            </div>

            <SongRevealJudging song={currentSong} cantanteMode={cantanteMode} />

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleReboundRespond}
                className={`w-full py-4 rounded-2xl font-black text-lg ${TEAM_COLOR[reboundTeam.color].badge} text-white active:scale-95 transition-all`}
              >
                ✋ Responder
              </button>
              <button
                onClick={handleReboundPass}
                className="w-full py-3 rounded-2xl font-bold text-sm bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-400"
              >
                Pasar · 0 pts
              </button>
            </div>

            {/* Rebote progress */}
            {rivalTeams.length > 1 && (
              <p className="text-xs text-zinc-600">
                Equipo {reboundIdx + 1} de {rivalTeams.length}
              </p>
            )}
          </div>
        )}

        {/* ── REBOUND RESPONSE ────────────────────── */}
        {phase === "rebound_response" && reboundTeam && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            <div className="text-center pt-2">
              <span className={`text-sm font-bold ${TEAM_COLOR[reboundTeam.color].text}`}>
                {reboundTeam.name}
              </span>
              <p className="text-zinc-500 text-xs mt-0.5">Rebote — respondiendo</p>
            </div>

            <TimerRing
              remaining={responseTimer.remaining}
              progress={responseTimer.progress}
              color={TEAM_COLOR[reboundTeam.color].ring}
              label="rebote"
            />

            <SongReveal song={currentSong} />

            <button
              onClick={skipReboundResponse}
              className="w-full py-3 rounded-2xl font-semibold text-sm bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-300"
            >
              Ya respondieron →
            </button>
          </div>
        )}

        {/* ── REBOUND JUDGING ─────────────────────── */}
        {phase === "rebound_judging" && reboundTeam && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <div className="text-center">
              <span className={`text-sm font-bold ${TEAM_COLOR[reboundTeam.color].text}`}>
                {reboundTeam.name}
              </span>
              <p className="text-2xl font-black mt-1">¿Acertaron?</p>
              <p className="text-xs text-zinc-500 mt-1">Rebote</p>
            </div>

            <SongRevealJudging song={currentSong} cantanteMode={cantanteMode} />

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => judgeRebound("correct")}
                className="w-full py-5 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-600/20"
              >
                ✓ Acierto &nbsp;+{POINTS_CORRECT} pts
              </button>
              <button
                onClick={() => judgeRebound("wrong")}
                className="w-full py-4 rounded-2xl font-bold text-base bg-red-900/60 hover:bg-red-900 active:scale-95 transition-all text-red-300 border border-red-800/50"
              >
                ✗ Fallo &nbsp;{POINTS_FAIL} pts
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wildcard modal — pauses timers */}
      {wildcardTeamId && (() => {
        const wildcardTeam = teams.find((t) => t.id === wildcardTeamId)!;
        const ctx: WildcardContext = wildcardTeamId === activePlayTeamId ? "my_turn" : "rival_turn";
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
