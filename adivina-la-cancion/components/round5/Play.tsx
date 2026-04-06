"use client";

import { useState, useRef } from "react";
import { Team } from "@/lib/types";
import {
  Round5Setup,
  Round5Result,
  SongEntry,
  PlayerTurnResult,
  TURN_DURATION,
  BANK_SIZE,
  POINTS_WIN,
  songId,
} from "@/lib/round5";
import { useTimer } from "@/lib/useTimer";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount } from "@/lib/wildcardUtils";
import { useGame } from "@/context/GameContext";

// ─── Disabled wildcards in Round 5 ───────────────────────────
// Silencio (individual play, no rivals to silence) + Robo (no per-team songs)
const DISABLED_WILDCARDS = ["silencio", "robo"];

// ─── Color maps ───────────────────────────────────────────────

const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500" },
  amber:  { badge: "bg-amber-500",  text: "text-amber-300",  ring: "stroke-amber-500"  },
  sky:    { badge: "bg-sky-500",    text: "text-sky-300",    ring: "stroke-sky-500"    },
  rose:   { badge: "bg-rose-500",   text: "text-rose-300",   ring: "stroke-rose-500"   },
};

// ─── Timer ring ───────────────────────────────────────────────

function TimerRing({ remaining, progress, color }: { remaining: number; progress: number; color: string }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const isLow = remaining <= 10 && remaining > 0;
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
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">segundos</span>
      </div>
    </div>
  );
}

// ─── Player order builder ─────────────────────────────────────

interface OrderedPlayer {
  id: string;
  name: string;
  isCaptain: boolean;
  teamId: string;
  teamColor: string;
  teamName: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPlayerOrder(teams: Team[]): OrderedPlayer[] {
  const perTeam = teams.map((t) =>
    shuffle(t.players).map((p) => ({ ...p, teamId: t.id, teamColor: t.color as string, teamName: t.name }))
  );
  const maxLen = Math.max(0, ...perTeam.map((t) => t.length));
  const order: OrderedPlayer[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const teamPlayers of perTeam) {
      if (i < teamPlayers.length) order.push(teamPlayers[i]);
    }
  }
  return order;
}

// ─── Main component ───────────────────────────────────────────

export default function Play({
  setup,
  teams,
  onComplete,
}: {
  setup: Round5Setup;
  teams: Team[];
  onComplete: (result: Round5Result) => void;
}) {
  const { game: gameCtx, setGame } = useGame();

  // Stable player order (shuffled once on mount)
  const [playerOrder] = useState<OrderedPlayer[]>(() => buildPlayerOrder(teams));

  // Phase
  const [phase, setPhase] = useState<"ready" | "active" | "done">("ready");

  // Turn state
  const [playerIdx, setPlayerIdx] = useState(0);
  const [bank, setBank] = useState<SongEntry[]>(setup.songs);
  const [songIdx, setSongIdx] = useState(0);
  const [turnCorrect, setTurnCorrect] = useState(0);
  const [turnShown, setTurnShown] = useState<SongEntry[]>([]);
  const [allResults, setAllResults] = useState<PlayerTurnResult[]>([]);

  // Wildcard state
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  // Bank replenishment UI state (used in "done" phase)
  const [addTitle, setAddTitle] = useState("");
  const [addArtist, setAddArtist] = useState("");

  // Single ref object for timer callback (avoids stale closures)
  const snap = useRef({
    playerIdx: 0,
    bank: setup.songs,
    songIdx: 0,
    turnCorrect: 0,
    turnShown: [] as SongEntry[],
    allResults: [] as PlayerTurnResult[],
  });
  // Keep in sync on every render
  snap.current.playerIdx = playerIdx;
  snap.current.bank = bank;
  snap.current.songIdx = songIdx;
  snap.current.turnCorrect = turnCorrect;
  snap.current.turnShown = turnShown;
  snap.current.allResults = allResults;

  const timer = useTimer();
  const pausedPhaseRef = useRef<"active" | null>(null);

  // ── Derived values
  const currentPlayer = playerOrder[playerIdx] ?? null;
  const nextPlayer = playerOrder[playerIdx + 1] ?? null;
  const currentSong: SongEntry | null = bank[songIdx] ?? null;
  const tc = currentPlayer ? TEAM_COLOR[currentPlayer.teamColor] ?? TEAM_COLOR.violet : TEAM_COLOR.violet;

  // ── Finalize the round (score + onComplete)
  const finalize = (results: PlayerTurnResult[]) => {
    const correctByTeam: Record<string, number> = {};
    for (const r of results) {
      correctByTeam[r.teamId] = (correctByTeam[r.teamId] ?? 0) + r.correct;
    }
    const maxCorrect = Math.max(0, ...Object.values(correctByTeam));
    const winners = teams.filter((t) => (correctByTeam[t.id] ?? 0) === maxCorrect && maxCorrect > 0).map((t) => t.id);
    const winningTeamIds = winners.length === 1 ? winners : []; // [] = tie

    if (gameCtx && winningTeamIds.length === 1) {
      setGame({
        ...gameCtx,
        teams: gameCtx.teams.map((t) =>
          t.id === winningTeamIds[0] ? { ...t, score: t.score + POINTS_WIN } : t
        ),
      });
    }

    onComplete({ playerResults: results, correctByTeam, winningTeamIds });
  };

  // ── End current player's turn (called from timer or when bank runs out)
  // Always reads from snap.current to be safe for timer callback
  const doEndTurn = () => {
    const pi = snap.current.playerIdx;
    const correct = snap.current.turnCorrect;
    const shown = [...snap.current.turnShown];
    const currentBank = snap.current.bank;
    const currentResults = [...snap.current.allResults];

    const player = playerOrder[pi];
    const result: PlayerTurnResult = {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      teamColor: player.teamColor,
      correct,
      songsShown: shown.length,
    };
    const newAllResults = [...currentResults, result];
    snap.current.allResults = newAllResults;

    // Remove shown songs from bank
    const shownIds = new Set(shown.map((s) => s.id));
    const remainingBank = currentBank.filter((s) => !shownIds.has(s.id));
    snap.current.bank = remainingBank;

    setAllResults(newAllResults);
    setBank(remainingBank);

    if (pi + 1 >= playerOrder.length) {
      finalize(newAllResults);
    } else {
      // Reset turn state for "done" phase
      setSongIdx(0);
      snap.current.songIdx = 0;
      setTurnCorrect(0);
      snap.current.turnCorrect = 0;
      setTurnShown([]);
      snap.current.turnShown = [];
      setCantanteMode(false);
      setActiveEffect(null);
      setPhase("done");
    }
  };

  // ── Start current player's turn
  const startTurn = () => {
    setPhase("active");
    timer.start(TURN_DURATION, doEndTurn);
  };

  // ── Advance to next player after bank replenishment
  const handleNextPlayer = () => {
    const nextIdx = playerIdx + 1;
    setPlayerIdx(nextIdx);
    snap.current.playerIdx = nextIdx;
    setSongIdx(0);
    snap.current.songIdx = 0;
    setTurnCorrect(0);
    snap.current.turnCorrect = 0;
    setTurnShown([]);
    snap.current.turnShown = [];
    setAddTitle("");
    setAddArtist("");
    setPhase("ready");
  };

  // ── Acierto / Paso
  const advanceSong = (correct: boolean) => {
    const song = bank[songIdx];
    if (!song) return;

    const newShown = [...turnShown, song];
    const newCorrect = turnCorrect + (correct ? 1 : 0);

    snap.current.turnShown = newShown;
    snap.current.turnCorrect = newCorrect;

    const nextIdx = songIdx + 1;
    if (nextIdx >= bank.length) {
      // Bank exhausted — end turn early
      timer.stop();
      setTurnShown(newShown);
      setTurnCorrect(newCorrect);
      doEndTurn();
    } else {
      setTurnShown(newShown);
      setTurnCorrect(newCorrect);
      setSongIdx(nextIdx);
      snap.current.songIdx = nextIdx;
    }
  };

  // ── Add song to bank (during "done" replenishment phase)
  const addSongToBank = () => {
    const title = addTitle.trim();
    const artist = addArtist.trim();
    if (!title && !artist) return;
    const newSong: SongEntry = { id: songId(), title, artist };
    const newBank = [...bank, newSong];
    setBank(newBank);
    snap.current.bank = newBank;
    setAddTitle("");
    setAddArtist("");
  };

  // ── Wildcard handlers
  const openWildcard = (teamId: string) => {
    if (phase !== "active") return;
    pausedPhaseRef.current = "active";
    timer.stop();
    setWildcardTeamId(teamId);
  };

  const closeWildcard = () => {
    setWildcardTeamId(null);
    if (pausedPhaseRef.current === "active") {
      timer.resume(doEndTurn);
    }
    pausedPhaseRef.current = null;
  };

  const applyWildcardEffect = (effect: WildcardEffect) => {
    switch (effect.wildcardId) {
      case "tiempo":
        timer.addTime(effect.tiempo?.extraSeconds ?? 15);
        setActiveEffect(`⏱ +${effect.tiempo?.extraSeconds ?? 15}s añadidos`);
        break;
      case "cantante":
        setCantanteMode(true);
        setActiveEffect("🎤 Solo artista válido");
        break;
      case "otra":
        // Advance to next song (same as "paso" but via wildcard)
        advanceSong(false);
        setActiveEffect("🔄 Canción cambiada");
        break;
      case "supercomodin":
        if (effect.supercomodin?.gameOver) {
          onComplete({
            playerResults: allResults,
            correctByTeam: allResults.reduce((acc, r) => {
              acc[r.teamId] = (acc[r.teamId] ?? 0) + r.correct;
              return acc;
            }, {} as Record<string, number>),
            winningTeamIds: [],
          });
        } else if (effect.supercomodin) {
          setActiveEffect(`⭐ Supercomodín — ${effect.supercomodin.points} pts transferidos`);
        }
        break;
    }
  };

  const handleWildcardUsed = (effect: WildcardEffect) => {
    applyWildcardEffect(effect);
    closeWildcard();
  };

  // ── Edge case: no players
  if (playerOrder.length === 0) {
    return (
      <div className="min-h-screen bg-canvas-950 text-white flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-2xl font-black">Sin jugadores</p>
        <p className="text-zinc-500 text-sm text-center">
          No hay jugadores registrados en ningún equipo. Vuelve al marcador y añádelos.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ronda 5 · Relámpago
          </p>
          <p className="text-sm text-zinc-400 mt-0.5">
            Jugador <span className="font-bold text-white">{playerIdx + 1}/{playerOrder.length}</span>
          </p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1">
          {playerOrder.map((p, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < playerIdx
                  ? "bg-green-500"
                  : i === playerIdx
                  ? TEAM_COLOR[p.teamColor]?.badge ?? "bg-white"
                  : "bg-canvas-800"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Live score bar */}
      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => {
          const tcc = TEAM_COLOR[team.color];
          const isCurrent = currentPlayer?.teamId === team.id;
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

      {/* Effect banner */}
      {activeEffect && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold text-center">
          {activeEffect}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col px-4 py-5 max-w-sm mx-auto w-full">

        {/* ── READY ── */}
        {phase === "ready" && currentPlayer && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            <div className="text-center space-y-3">
              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${TEAM_COLOR[currentPlayer.teamColor]?.badge ?? "bg-zinc-600"} text-white`}>
                {currentPlayer.teamName}
              </span>
              <p className="text-4xl font-black">{currentPlayer.name}</p>
              {currentPlayer.isCaptain && (
                <p className="text-xs text-amber-400 font-bold">👑 Capitán</p>
              )}
              <p className="text-zinc-500 text-sm">
                {TURN_DURATION}s · {bank.length} canciones en el banco
              </p>
            </div>
            <button
              onClick={startTurn}
              className="w-full py-5 rounded-2xl font-black text-xl bg-white hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900 shadow-lg shadow-black/20"
            >
              ▶ Empezar turno
            </button>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {phase === "active" && currentPlayer && (
          <div className="flex-1 flex flex-col items-center justify-between w-full">
            {/* Player + correct counter */}
            <div className="flex items-center justify-between w-full">
              <div>
                <span className={`text-sm font-bold ${tc.text}`}>{currentPlayer.name}</span>
                <p className="text-xs text-zinc-500">{currentPlayer.teamName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-green-400">{turnCorrect}</p>
                <p className="text-xs text-zinc-600">aciertos</p>
              </div>
            </div>

            {/* Timer */}
            <TimerRing
              remaining={timer.remaining}
              progress={timer.progress}
              color={tc.ring}
            />

            {/* Current song */}
            {currentSong ? (
              <div className="w-full bg-canvas-900 border border-canvas-700/50 rounded-2xl px-5 py-5 text-center">
                {cantanteMode && (
                  <p className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-widest">
                    🎤 Solo artista válido
                  </p>
                )}
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Canción</p>
                <p className={`text-2xl font-black leading-tight ${cantanteMode ? "text-zinc-500 line-through" : "text-white"}`}>
                  {currentSong.title || "(sin título)"}
                </p>
                {currentSong.artist && (
                  <p className="text-sm text-zinc-400 mt-1">de {currentSong.artist}</p>
                )}
                <p className="text-xs text-zinc-700 mt-3">
                  Canción {songIdx + 1}/{bank.length}
                </p>
              </div>
            ) : (
              <div className="w-full bg-canvas-900 border border-canvas-700/50 rounded-2xl px-5 py-5 text-center">
                <p className="text-zinc-500 text-sm">Banco agotado</p>
              </div>
            )}

            {/* Acierto / Paso + wildcards */}
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-2">
                <button
                  onClick={() => advanceSong(false)}
                  className="flex-1 py-5 rounded-2xl font-black text-base bg-canvas-800 hover:bg-canvas-700 active:scale-95 transition-all text-zinc-300"
                >
                  → Paso
                </button>
                <button
                  onClick={() => advanceSong(true)}
                  className="flex-[2] py-5 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-600/20"
                >
                  ✓ Acierto
                </button>
              </div>

              {/* Wildcard row */}
              <div className="flex gap-1.5">
                {teams.map((team) => {
                  const ctx: WildcardContext = team.id === currentPlayer.teamId ? "my_turn" : "rival_turn";
                  const count = availableCount(team.wildcards, ctx, DISABLED_WILDCARDS);
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

        {/* ── DONE (bank replenishment) ── */}
        {phase === "done" && (
          <div className="flex-1 flex flex-col gap-5 w-full">
            {/* Result of the just-finished turn */}
            {allResults.length > 0 && (() => {
              const last = allResults[allResults.length - 1];
              const tcc = TEAM_COLOR[last.teamColor] ?? TEAM_COLOR.violet;
              return (
                <div className={`p-4 rounded-2xl text-center border ${tcc.badge.replace("bg-", "bg-").replace("500", "500/20")} border-transparent bg-canvas-800`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${tcc.text} mb-1`}>{last.teamName} · {last.playerName}</p>
                  <p className="text-4xl font-black text-white">{last.correct}</p>
                  <p className="text-zinc-500 text-sm mt-0.5">
                    aciertos · {last.songsShown} canciones vistas
                  </p>
                </div>
              );
            })()}

            {/* Next player info */}
            {nextPlayer && (
              <div className="flex items-center gap-3 px-4 py-3 bg-canvas-900 border border-canvas-700 rounded-2xl">
                <span className="text-2xl">▶</span>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">Siguiente</p>
                  <p className="font-black text-white">{nextPlayer.name}</p>
                  <p className={`text-xs ${TEAM_COLOR[nextPlayer.teamColor]?.text ?? "text-zinc-400"}`}>{nextPlayer.teamName}</p>
                </div>
              </div>
            )}

            {/* Bank management */}
            <div className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-canvas-700/60 flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-300">Banco de canciones</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  bank.length >= BANK_SIZE
                    ? "bg-green-500/15 text-green-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}>
                  {bank.length}/{BANK_SIZE}
                </span>
              </div>

              {bank.length > 0 && (
                <div className="max-h-32 overflow-y-auto divide-y divide-canvas-700/40">
                  {bank.map((s) => (
                    <div key={s.id} className="px-4 py-1.5 text-xs text-zinc-500">
                      {[s.title, s.artist].filter(Boolean).join(" — ") || "Sin info"}
                    </div>
                  ))}
                </div>
              )}

              {bank.length < BANK_SIZE && (
                <div className="p-3 border-t border-canvas-700/40 space-y-2">
                  <p className="text-xs text-amber-400 font-bold">
                    + Añade {BANK_SIZE - bank.length} canción{BANK_SIZE - bank.length !== 1 ? "es" : ""} para completar
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Título"
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSongToBank()}
                      className="bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-2 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-zinc-500"
                    />
                    <input
                      type="text"
                      placeholder="Artista"
                      value={addArtist}
                      onChange={(e) => setAddArtist(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSongToBank()}
                      className="bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-2 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <button
                    onClick={addSongToBank}
                    disabled={!addTitle.trim() && !addArtist.trim()}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                      addTitle.trim() || addArtist.trim()
                        ? "bg-canvas-700 hover:bg-canvas-600 text-white active:scale-95"
                        : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
                    }`}
                  >
                    + Añadir canción
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleNextPlayer}
              className="w-full py-4 rounded-2xl font-black text-lg bg-white hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900 shadow-lg shadow-black/20"
            >
              Turno de {nextPlayer?.name ?? "siguiente jugador"} →
            </button>
          </div>
        )}
      </div>

      {/* Wildcard modal */}
      {wildcardTeamId && (() => {
        const wildcardTeam = teams.find((t) => t.id === wildcardTeamId)!;
        const ctx: WildcardContext = wildcardTeamId === currentPlayer?.teamId ? "my_turn" : "rival_turn";
        return (
          <WildcardModal
            team={wildcardTeam}
            allTeams={teams}
            context={ctx}
            disabledIds={DISABLED_WILDCARDS}
            onClose={closeWildcard}
            onUsed={handleWildcardUsed}
          />
        );
      })()}
    </div>
  );
}
