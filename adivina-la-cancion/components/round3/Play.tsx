"use client";

import { useState, useCallback } from "react";
import { Team } from "@/lib/types";
import {
  Round3Setup,
  TurnResult,
  ReboundResult,
  SongEntry,
  SONGS_TOTAL,
  POINTS_CORRECT,
  POINTS_FAIL,
} from "@/lib/round3";
import { useTimer } from "@/lib/useTimer";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount } from "@/lib/wildcardUtils";
import { useGame } from "@/context/GameContext";

// ─── Color maps ───────────────────────────────────────────────

const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string; bgLight: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500", bgLight: "bg-violet-500/10 border-violet-500/30" },
  amber:  { badge: "bg-amber-500",  text: "text-amber-300",  ring: "stroke-amber-500",  bgLight: "bg-amber-500/10 border-amber-500/30"  },
  sky:    { badge: "bg-sky-500",    text: "text-sky-300",    ring: "stroke-sky-500",    bgLight: "bg-sky-500/10 border-sky-500/30"    },
  rose:   { badge: "bg-rose-500",   text: "text-rose-300",   ring: "stroke-rose-500",   bgLight: "bg-rose-500/10 border-rose-500/30"   },
};

// ─── Turn phases ──────────────────────────────────────────────

type TurnPhase =
  | "idle"              // buzzer buttons shown
  | "response"          // team buzzed, response timer running
  | "judging"           // judge the answer
  | "rebound_offer"     // offer rebound to rival team
  | "rebound_response"  // rival responding
  | "rebound_judging";  // judge rebound

// ─── Sub-components ───────────────────────────────────────────

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
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">responde</span>
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
  setup: Round3Setup;
  teams: Team[];
  onComplete: (results: TurnResult[]) => void;
}) {
  const { game: gameCtx, setGame } = useGame();

  const [songIndex, setSongIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>("idle");
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lastResult, setLastResult] = useState<{ buzzerTeamId: string; primaryCorrect: boolean; rebounds: ReboundResult[] } | null>(null);

  // Buzzer state
  const [buzzerTeamId, setBuzzerTeamId] = useState<string | null>(null);

  // Wildcard state
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [songOverride, setSongOverride] = useState<SongEntry | null>(null);

  // Rebound state
  const [reboundIdx, setReboundIdx] = useState(0);
  const [currentRebounds, setCurrentRebounds] = useState<ReboundResult[]>([]);

  const pausedPhaseRef = { current: null as TurnPhase | null };

  // Derived values
  const currentSong = songOverride ?? setup.songs[songIndex];
  const buzzerTeam = buzzerTeamId ? teams.find((t) => t.id === buzzerTeamId) : null;
  const tc = buzzerTeam ? TEAM_COLOR[buzzerTeam.color] : null;
  const rivalTeams = buzzerTeam ? teams.filter((t) => t.id !== buzzerTeam.id) : [];
  const reboundTeam = reboundIdx < rivalTeams.length ? rivalTeams[reboundIdx] : null;

  // Timer
  const responseTimer = useTimer();

  // ── Buzz in
  const buzz = (teamId: string) => {
    setBuzzerTeamId(teamId);
    setPhase("response");
    responseTimer.start(setup.responseDuration, () => setPhase("judging"));
  };

  const skipResponse = () => {
    responseTimer.stop();
    setPhase("judging");
  };

  // ── Finalize a song turn
  const finalizeTurn = (result: TurnResult) => {
    if (gameCtx) {
      const deltas: Record<string, number> = {};
      const add = (id: string, d: number) => { deltas[id] = (deltas[id] ?? 0) + d; };
      add(result.buzzerTeamId, result.primaryCorrect ? POINTS_CORRECT : POINTS_FAIL);
      for (const rb of result.rebounds) {
        if (rb.choice === "correct") add(rb.teamId, POINTS_CORRECT);
        else if (rb.choice === "wrong") add(rb.teamId, POINTS_FAIL);
      }
      setGame({
        ...gameCtx,
        teams: gameCtx.teams.map((t) => ({ ...t, score: t.score + (deltas[t.id] ?? 0) })),
      });
    }

    const newResults = [...results, result];
    setResults(newResults);
    setLastResult({ buzzerTeamId: result.buzzerTeamId, primaryCorrect: result.primaryCorrect, rebounds: result.rebounds });
    setBuzzerTeamId(null);
    setCantanteMode(false);
    setActiveEffect(null);
    setSongOverride(null);
    setReboundIdx(0);
    setCurrentRebounds([]);

    if (songIndex + 1 >= SONGS_TOTAL) {
      onComplete(newResults);
    } else {
      setSongIndex((i) => i + 1);
      setPhase("idle");
    }
  };

  // ── Primary judging
  const judgePrimary = (correct: boolean) => {
    if (!buzzerTeam) return;
    if (correct || rivalTeams.length === 0) {
      finalizeTurn({ songIndex, song: currentSong, buzzerTeamId: buzzerTeam.id, primaryCorrect: correct, rebounds: [] });
    } else {
      setCurrentRebounds([]);
      setReboundIdx(0);
      setPhase("rebound_offer");
    }
  };

  // ── Rebound
  const advanceRebound = (rebounds: ReboundResult[]) => {
    const nextIdx = reboundIdx + 1;
    if (nextIdx < rivalTeams.length) {
      setReboundIdx(nextIdx);
      setPhase("rebound_offer");
    } else {
      finalizeTurn({ songIndex, song: currentSong, buzzerTeamId: buzzerTeam!.id, primaryCorrect: false, rebounds });
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
    if (phase === "response" || phase === "rebound_response") responseTimer.stop();
    setWildcardTeamId(teamId);
  };

  const closeWildcard = () => {
    setWildcardTeamId(null);
    const paused = pausedPhaseRef.current;
    if (paused === "response") responseTimer.resume(() => setPhase("judging"));
    if (paused === "rebound_response") responseTimer.resume(() => setPhase("rebound_judging"));
    pausedPhaseRef.current = null;
  };

  const applyWildcardEffect = (effect: WildcardEffect) => {
    switch (effect.wildcardId) {
      case "tiempo":
        responseTimer.addTime(effect.tiempo?.extraSeconds ?? 15);
        setActiveEffect(`⏱ +${effect.tiempo?.extraSeconds ?? 15}s añadidos`);
        break;
      case "cantante":
        setCantanteMode(true);
        setActiveEffect("🎤 Solo artista válido");
        break;
      case "silencio":
        if (effect.silencio) setActiveEffect(`🔇 ${effect.silencio.playerName} bloqueado/a`);
        break;
      case "robo":
        setActiveEffect("🎭 Robo activo — cambia la canción al del rival");
        break;
      case "otra": {
        const reserve = setup.reserveSong;
        if (reserve && (reserve.title.trim() || reserve.artist.trim())) {
          setSongOverride(reserve);
          setActiveEffect("🔄 Canción de reserva activada");
        } else {
          setActiveEffect("🔄 Sin canción de reserva — el presentador elige otra");
        }
        break;
      }
      case "supercomodin":
        if (effect.supercomodin) setActiveEffect(`⭐ Supercomodín — ${effect.supercomodin.points} pts transferidos`);
        break;
    }
  };

  const handleWildcardUsed = (effect: WildcardEffect) => {
    applyWildcardEffect(effect);
    closeWildcard();
  };

  // Wildcard context based on current phase
  const wildcardCtxFor = (teamId: string): WildcardContext => {
    if (phase === "idle") return "free";
    if (phase === "rebound_offer" || phase === "rebound_response" || phase === "rebound_judging") {
      return reboundTeam?.id === teamId ? "my_turn" : "rival_turn";
    }
    return buzzerTeamId === teamId ? "my_turn" : "rival_turn";
  };

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ronda 3 · Pulsadores
          </p>
          <p className="text-sm text-zinc-400 mt-0.5">
            Canción <span className="font-bold text-white">{songIndex + 1}/{SONGS_TOTAL}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {setup.songs.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < songIndex
                  ? results[i]?.primaryCorrect ? "bg-green-500" : "bg-red-800"
                  : i === songIndex ? "bg-white" : "bg-canvas-800"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Live score bar */}
      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => {
          const tcc = TEAM_COLOR[team.color];
          const isBuzzer = team.id === buzzerTeamId;
          return (
            <div
              key={team.id}
              className={`flex flex-col items-center px-5 py-2 rounded-2xl font-bold transition-all ${
                isBuzzer ? `${tcc.badge} text-white shadow-lg` : "bg-canvas-800 text-zinc-300"
              }`}
            >
              <span className={`text-xs uppercase tracking-wide leading-none mb-1 ${isBuzzer ? "text-white/80" : tcc.text}`}>
                {team.name}
              </span>
              <span className="text-2xl font-black tabular-nums leading-none">{team.score}</span>
            </div>
          );
        })}
      </div>

      {/* Effect banner */}
      {activeEffect && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold text-center">
          {activeEffect}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-5 max-w-sm mx-auto w-full">

        {/* ── IDLE — Buzzer buttons ─────────────────── */}
        {phase === "idle" && (
          <div className="flex-1 flex flex-col w-full gap-4 justify-center">
            {lastResult !== null && (
              <div className="space-y-1.5 mb-2">
                <div className={`w-full text-center py-2 rounded-xl text-sm font-bold ${
                  lastResult.primaryCorrect
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {lastResult.primaryCorrect ? `+${POINTS_CORRECT} pts ✓` : `${POINTS_FAIL} pts ✗`}
                </div>
                {lastResult.rebounds.filter((rb) => rb.choice !== "pass").map((rb) => {
                  const rbt = teams.find((t) => t.id === rb.teamId)!;
                  return (
                    <div key={rb.teamId} className={`w-full text-center py-1.5 rounded-xl text-xs font-bold ${
                      rb.choice === "correct"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      <span className={TEAM_COLOR[rbt.color].text}>{rbt.name}</span>
                      {" — Rebote: "}{rb.choice === "correct" ? `+${POINTS_CORRECT}` : `${POINTS_FAIL}`}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-center mb-2">
              <p className="text-4xl font-black">Canción {songIndex + 1}</p>
              <p className="text-zinc-500 text-sm mt-1">¡Pulsa cuando sepas!</p>
            </div>

            <SongReveal song={currentSong} />

            {/* Buzzer buttons — one per team */}
            <div className="flex flex-col gap-3 w-full mt-2">
              {teams.map((team) => {
                const tcc = TEAM_COLOR[team.color];
                return (
                  <button
                    key={team.id}
                    onClick={() => buzz(team.id)}
                    className={`w-full py-9 rounded-3xl font-black text-2xl ${tcc.badge} text-white active:scale-95 transition-all shadow-xl`}
                  >
                    🔔 {team.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RESPONSE — Timer after buzzing ───────── */}
        {phase === "response" && buzzerTeam && tc && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            <div className="text-center pt-2">
              <span className={`text-sm font-bold ${tc.text}`}>{buzzerTeam.name}</span>
              <p className="text-zinc-500 text-xs mt-0.5">pulsó — respondiendo</p>
            </div>

            <TimerRing
              remaining={responseTimer.remaining}
              progress={responseTimer.progress}
              color={tc.ring}
            />

            <SongReveal song={currentSong} />

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={skipResponse}
                className="w-full py-3 rounded-2xl font-semibold text-sm bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-300"
              >
                Ya respondieron →
              </button>
              {/* Wildcards */}
              <div className="flex gap-1.5">
                {teams.map((team) => {
                  const ctx = wildcardCtxFor(team.id);
                  const count = availableCount(team.wildcards, ctx);
                  const tcc2 = TEAM_COLOR[team.color];
                  return (
                    <button
                      key={team.id}
                      onClick={count > 0 ? () => openWildcard(team.id) : undefined}
                      disabled={count === 0}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                        count > 0
                          ? "bg-canvas-900 border border-canvas-700 hover:border-canvas-600 active:scale-95"
                          : "bg-canvas-900/50 border border-zinc-900 cursor-default"
                      }`}
                    >
                      <span className={count > 0 ? tcc2.text : "text-zinc-700"}>🃏 {team.name}</span>
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
        {phase === "judging" && buzzerTeam && tc && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <div className="text-center">
              <span className={`text-sm font-bold ${tc.text}`}>{buzzerTeam.name}</span>
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

        {/* ── REBOUND OFFER ────────────────────────── */}
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
            {rivalTeams.length > 1 && (
              <p className="text-xs text-zinc-600">Equipo {reboundIdx + 1} de {rivalTeams.length}</p>
            )}
          </div>
        )}

        {/* ── REBOUND RESPONSE ─────────────────────── */}
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

        {/* ── REBOUND JUDGING ──────────────────────── */}
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

      {/* Wildcard modal */}
      {wildcardTeamId && (() => {
        const wildcardTeam = teams.find((t) => t.id === wildcardTeamId)!;
        const ctx = wildcardCtxFor(wildcardTeamId);
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
