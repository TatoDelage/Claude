"use client";

import { useState } from "react";
import { Team, WildcardId, Wildcard } from "@/lib/types";
import { useGame } from "@/context/GameContext";
import { WildcardContext, isAvailable, blockedReason } from "@/lib/wildcardUtils";

// ─── Public types ─────────────────────────────────────────────

export interface WildcardEffect {
  wildcardId: WildcardId;
  /** Tiempo: seconds to add to fragment timer */
  tiempo?: { extraSeconds: number };
  /** Silencio: which rival player is blocked */
  silencio?: { playerId: string; playerName: string };
  /** Supercomodín: points transferred (null = prediction failed) */
  supercomodin?: { rivalTeamId: string; points: number } | null;
}

interface Props {
  /** Team that is using the wildcard */
  team: Team;
  /** All teams (needed for Silencio and Supercomodín) */
  allTeams: Team[];
  /** When used in-game: "my_turn" (defensa available) or "rival_turn" (ataque available). Default "free" (all available). */
  context?: WildcardContext;
  onClose: () => void;
  onUsed: (effect: WildcardEffect) => void;
}

// ─── Constants ────────────────────────────────────────────────

const TIEMPO_EXTRA = 15;

const TEAM_ACCENT: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
};

const TEAM_TEXT: Record<string, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  teal: "text-teal-300",
  rose: "text-rose-300",
};

// ─── Step types ───────────────────────────────────────────────

type Step =
  | { id: "grid" }
  | { id: "detail"; wc: Wildcard }
  | { id: "silencio_pick"; wc: Wildcard }
  | { id: "super1"; wc: Wildcard }
  | { id: "super2"; wc: Wildcard; inputs: [string, string, string] }
  | { id: "super3"; wc: Wildcard; songs: [string, string, string]; chosenIdx: number | null; prediction: number }
  | { id: "super4"; wc: Wildcard; chosenSong: string; prediction: number; actual: number | null }
  | { id: "super_win"; wc: Wildcard; rivalTeamId: string }
  | { id: "super_fail" };

// ─── Main component ───────────────────────────────────────────

export default function WildcardModal({ team, allTeams, context = "free", onClose, onUsed }: Props) {
  const { game, useWildcard, applyScores, setGame } = useGame();
  const [step, setStep] = useState<Step>({ id: "grid" });
  const [selectedRivalId, setSelectedRivalId] = useState<string>(() => allTeams.find((t) => t.id !== team.id)?.id ?? "");

  const rivalTeams = allTeams.filter((t) => t.id !== team.id);

  // ── Confirm a simple wildcard (no sub-flow needed)
  const confirmSimple = (wc: Wildcard, extra?: Omit<WildcardEffect, "wildcardId">) => {
    useWildcard(team.id, wc.id);
    onUsed({ wildcardId: wc.id, ...extra });
  };

  // ── Select from grid
  const selectWildcard = (wc: Wildcard) => {
    if (wc.used || !isAvailable(wc, context)) return;
    if (wc.id === "silencio") return setStep({ id: "silencio_pick", wc });
    if (wc.id === "supercomodin") return setStep({ id: "super1", wc });
    setStep({ id: "detail", wc });
  };

  // ─── Render helpers ───────────────────────────────────────

  const renderGrid = () => (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Comodines</p>
          <p className={`text-lg font-black ${TEAM_TEXT[team.color]}`}>{team.name}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl p-1">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {team.wildcards.map((wc) => {
          const blocked = !wc.used && !isAvailable(wc, context);
          const reason = blockedReason(wc, context);
          const unavailable = wc.used || blocked;
          return (
            <button
              key={wc.id}
              onClick={() => selectWildcard(wc)}
              disabled={unavailable}
              className={`relative p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                wc.used
                  ? "bg-zinc-900/40 border-zinc-800 opacity-40 cursor-default"
                  : blocked
                  ? "bg-zinc-900/60 border-zinc-800/60 opacity-60 cursor-default"
                  : "bg-zinc-800 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700"
              }`}
            >
              {wc.used && (
                <span className="absolute top-2 right-2 text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
                  Gastado
                </span>
              )}
              {blocked && reason && (
                <span className="absolute top-2 right-2 text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full font-medium leading-tight text-right">
                  {reason}
                </span>
              )}
              <div className="text-2xl mb-1">{wc.emoji}</div>
              <p className={`text-sm font-bold leading-tight ${unavailable ? "text-zinc-500" : "text-white"}`}>{wc.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-2">
                {wc.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDetail = (wc: Wildcard) => {
    const effectHints: Record<WildcardId, string> = {
      tiempo: `Se añaden +${TIEMPO_EXTRA}s al fragmento en curso.`,
      silencio: "Elige a qué jugador rival bloqueas.",
      cantante: "Solo bastará decir el artista. El título no es necesario.",
      robo: "El equipo se queda con la canción que le tocaba al rival.",
      otra: "El presentador cambia la canción por otra sin penalización.",
      supercomodin: "Flujo especial: tarareo + predicción.",
    };
    return (
      <div className="p-5 space-y-5">
        <button onClick={() => setStep({ id: "grid" })} className="text-zinc-500 text-sm flex items-center gap-1">
          ← Volver
        </button>
        <div className="text-center space-y-2">
          <div className="text-5xl">{wc.emoji}</div>
          <p className="text-xl font-black text-white">{wc.name}</p>
          <p className="text-sm text-zinc-400">{effectHints[wc.id]}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm">
            Cancelar
          </button>
          <button
            onClick={() =>
              confirmSimple(wc, wc.id === "tiempo" ? { tiempo: { extraSeconds: TIEMPO_EXTRA } } : undefined)
            }
            className={`flex-1 py-3 rounded-xl text-white font-black text-sm ${TEAM_ACCENT[team.color]}`}
          >
            Usar comodín ✓
          </button>
        </div>
      </div>
    );
  };

  const renderSilenzioPick = (wc: Wildcard) => {
    const allRivals = rivalTeams.flatMap((t) =>
      t.players.map((p) => ({ ...p, teamName: t.name, teamColor: t.color }))
    );
    return (
      <div className="p-5 space-y-4">
        <button onClick={() => setStep({ id: "grid" })} className="text-zinc-500 text-sm flex items-center gap-1">
          ← Volver
        </button>
        <div className="text-center">
          <div className="text-4xl mb-2">🔇</div>
          <p className="text-lg font-black text-white">¿A quién silencias?</p>
          <p className="text-xs text-zinc-500 mt-1">Ese jugador rival queda bloqueado esta ronda</p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allRivals.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">No hay jugadores registrados en los equipos rivales</p>
          ) : (
            allRivals.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  useWildcard(team.id, wc.id);
                  onUsed({ wildcardId: wc.id, silencio: { playerId: p.id, playerName: p.name } });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-left transition-all active:scale-95"
              >
                {p.isCaptain && <span className="text-amber-400 text-sm">👑</span>}
                <div>
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className={`text-xs ${TEAM_TEXT[p.teamColor]}`}>{p.teamName}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  // ── Supercomodín flow ──────────────────────────────────────

  const renderSuper1 = (wc: Wildcard) => (
    <div className="p-5 space-y-5 text-center">
      <button onClick={() => setStep({ id: "grid" })} className="text-zinc-500 text-sm flex items-center gap-1 mx-auto">
        ← Volver
      </button>
      <div className="text-5xl">⭐</div>
      <div>
        <p className="text-xl font-black text-white">Supercomodín</p>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Un jugador de <span className={`font-bold ${TEAM_TEXT[team.color]}`}>{team.name}</span> va
          a tararear una canción. El presentador le ofrece 3 opciones para elegir.
        </p>
      </div>
      <button
        onClick={() => setStep({ id: "super2", wc, inputs: ["", "", ""] })}
        className={`w-full py-3 rounded-xl text-white font-black ${TEAM_ACCENT[team.color]}`}
      >
        Introducir las 3 opciones →
      </button>
    </div>
  );

  const renderSuper2 = (step: Extract<Step, { id: "super2" }>) => {
    const allFilled = step.inputs.every((s) => s.trim());
    return (
      <div className="p-5 space-y-4">
        <button onClick={() => setStep({ id: "super1", wc: step.wc })} className="text-zinc-500 text-sm flex items-center gap-1">
          ← Volver
        </button>
        <div className="text-center">
          <p className="text-lg font-black text-white">Las 3 opciones</p>
          <p className="text-xs text-zinc-500 mt-1">Léelas en voz alta al jugador</p>
        </div>
        <div className="space-y-2">
          {(["A", "B", "C"] as const).map((letter, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm font-black text-zinc-500">{letter}</span>
              <input
                type="text"
                placeholder={`Canción ${letter}`}
                value={step.inputs[i]}
                onChange={(e) => {
                  const next = [...step.inputs] as [string, string, string];
                  next[i] = e.target.value;
                  setStep({ ...step, inputs: next });
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          ))}
        </div>
        <button
          disabled={!allFilled}
          onClick={() =>
            setStep({ id: "super3", wc: step.wc, songs: step.inputs, chosenIdx: null, prediction: 0 })
          }
          className={`w-full py-3 rounded-xl font-black text-sm transition-all ${
            allFilled
              ? `${TEAM_ACCENT[team.color]} text-white`
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          El jugador elige y predice →
        </button>
      </div>
    );
  };

  const renderSuper3 = (step: Extract<Step, { id: "super3" }>) => (
    <div className="p-5 space-y-4">
      <button onClick={() => setStep({ id: "super2", wc: step.wc, inputs: step.songs })} className="text-zinc-500 text-sm flex items-center gap-1">
        ← Volver
      </button>
      <div className="text-center">
        <p className="text-lg font-black text-white">Elige y predice</p>
        <p className="text-xs text-zinc-500 mt-1">¿Cuál tararea? ¿Cuántos oyentes acertarán?</p>
      </div>

      {/* Song selection */}
      <div className="space-y-2">
        {(["A", "B", "C"] as const).map((letter, i) => (
          <button
            key={i}
            onClick={() => setStep({ ...step, chosenIdx: i })}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              step.chosenIdx === i
                ? `${TEAM_ACCENT[team.color]} border-transparent text-white`
                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="font-black text-sm w-5">{letter}</span>
            <span className="text-sm">{step.songs[i]}</span>
          </button>
        ))}
      </div>

      {/* Prediction stepper */}
      <div className="bg-zinc-800 rounded-xl p-3">
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Predicción: nº de oyentes que acertarán</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep({ ...step, prediction: Math.max(0, step.prediction - 1) })}
            className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold"
          >
            −
          </button>
          <span className="text-3xl font-black tabular-nums">{step.prediction}</span>
          <button
            onClick={() => setStep({ ...step, prediction: step.prediction + 1 })}
            className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold"
          >
            +
          </button>
        </div>
      </div>

      <button
        disabled={step.chosenIdx === null}
        onClick={() =>
          setStep({
            id: "super4",
            wc: step.wc,
            chosenSong: step.songs[step.chosenIdx!],
            prediction: step.prediction,
            actual: null,
          })
        }
        className={`w-full py-3 rounded-xl font-black text-sm ${
          step.chosenIdx !== null
            ? `${TEAM_ACCENT[team.color]} text-white`
            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
        }`}
      >
        Los demás intentan adivinar →
      </button>
    </div>
  );

  const renderSuper4 = (step: Extract<Step, { id: "super4" }>) => {
    const canReveal = step.actual !== null;
    const success = canReveal && step.actual === step.prediction;
    return (
      <div className="p-5 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-lg font-black text-white">Revelar resultado</p>
          <p className="text-sm text-zinc-400">
            Canción elegida: <span className="text-white font-bold">{step.chosenSong}</span>
          </p>
          <p className="text-sm text-zinc-400">
            Predicción: <span className="text-white font-bold">{step.prediction}</span>
          </p>
        </div>

        <div className="bg-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">¿Cuántos acertaron?</p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep({ ...step, actual: Math.max(0, (step.actual ?? 0) - 1) })}
              className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold"
            >
              −
            </button>
            <span className="text-3xl font-black tabular-nums">
              {step.actual ?? "—"}
            </span>
            <button
              onClick={() => setStep({ ...step, actual: (step.actual ?? 0) + 1 })}
              className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold"
            >
              +
            </button>
          </div>
        </div>

        {canReveal && (
          <div
            className={`p-3 rounded-xl text-center font-bold text-sm ${
              success
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            {success ? "✓ ¡Predicción acertada!" : "✗ Predicción incorrecta"}
          </div>
        )}

        <button
          disabled={!canReveal}
          onClick={() => {
            if (success && rivalTeams.length > 0) {
              const rivalId = rivalTeams[0].id;
              setSelectedRivalId(rivalId);
              setStep({ id: "super_win", wc: step.wc, rivalTeamId: rivalId });
            } else if (canReveal) {
              useWildcard(team.id, step.wc.id);
              onUsed({ wildcardId: step.wc.id, supercomodin: null });
            }
          }}
          className={`w-full py-3 rounded-xl font-black text-sm ${
            canReveal
              ? success
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-zinc-800 text-zinc-300"
              : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {!canReveal ? "Introduce el resultado" : success ? "Robar los puntos →" : "Cerrar — sin transferencia"}
        </button>
      </div>
    );
  };

  const renderSuperWin = (step: Extract<Step, { id: "super_win" }>) => {
    // Read scores from live game state (not stale allTeams prop)
    const liveTeam = game?.teams.find((t) => t.id === team.id);
    const liveRival = game?.teams.find((t) => t.id === selectedRivalId);
    const myScore = liveTeam?.score ?? team.score;
    const rivalScore = liveRival?.score ?? (allTeams.find((t) => t.id === selectedRivalId)?.score ?? 0);

    const doTransfer = () => {
      if (!game) return;
      // Atomic update: swap scores + mark wildcard used in one setGame call
      // to avoid the stale-closure bug where two sequential persists overwrite each other.
      const updated = {
        ...game,
        teams: game.teams.map((t) => {
          if (t.id === team.id) {
            return {
              ...t,
              score: rivalScore,
              wildcards: t.wildcards.map((w) => w.id === step.wc.id ? { ...w, used: true } : w),
            };
          }
          if (t.id === selectedRivalId) return { ...t, score: myScore };
          return t;
        }),
      };
      setGame(updated);
      onUsed({
        wildcardId: step.wc.id,
        supercomodin: { rivalTeamId: selectedRivalId, points: rivalScore },
      });
    };

    return (
      <div className="p-5 space-y-4 text-center">
        <div className="text-4xl">⭐🏆</div>
        <div>
          <p className="text-xl font-black text-white">¡Supercomodín activado!</p>
          <p className="text-sm text-zinc-400 mt-1">Los puntos se intercambian entre equipos</p>
        </div>

        {rivalTeams.length > 1 && (
          <div className="space-y-2 text-left">
            <p className="text-xs text-zinc-500 uppercase tracking-widest">¿Con qué equipo intercambias?</p>
            {rivalTeams.map((rt) => (
              <button
                key={rt.id}
                onClick={() => setSelectedRivalId(rt.id)}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  selectedRivalId === rt.id
                    ? `${TEAM_ACCENT[rt.color]} border-transparent text-white`
                    : "bg-zinc-800 border-zinc-700 text-zinc-300"
                }`}
              >
                <span className="font-bold">{rt.name}</span>
                <span className="ml-2 text-sm opacity-70">{rt.score} pts</span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-zinc-800 rounded-xl p-3 text-sm space-y-1">
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1.5">Resultado del intercambio</p>
          <div className="flex items-center justify-between">
            <span className={`font-bold ${TEAM_TEXT[team.color]}`}>{team.name}</span>
            <span className="text-white font-black">{myScore} → {rivalScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-bold ${TEAM_TEXT[liveRival?.color ?? "zinc"]}`}>{liveRival?.name ?? selectedRivalId}</span>
            <span className="text-white font-black">{rivalScore} → {myScore}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm">
            Cancelar
          </button>
          <button
            onClick={doTransfer}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm"
          >
            Transferir ✓
          </button>
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────

  const renderContent = () => {
    switch (step.id) {
      case "grid":         return renderGrid();
      case "detail":       return renderDetail(step.wc);
      case "silencio_pick":return renderSilenzioPick(step.wc);
      case "super1":       return renderSuper1(step.wc);
      case "super2":       return renderSuper2(step);
      case "super3":       return renderSuper3(step);
      case "super4":       return renderSuper4(step);
      case "super_win":    return renderSuperWin(step);
      case "super_fail":   return (
        <div className="p-5 text-center space-y-4">
          <div className="text-4xl">💨</div>
          <p className="text-lg font-black text-white">Sin transferencia</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm">Cerrar</button>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
