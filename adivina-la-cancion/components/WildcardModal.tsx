"use client";

import { useMemo, useState } from "react";
import { Team, Wildcard, WildcardId } from "@/lib/types";
import { useGame } from "@/context/GameContext";
import { WildcardContext, blockedReason, isAvailable, teamWildcardLocked } from "@/lib/wildcardUtils";

export interface WildcardEffect {
  wildcardId: WildcardId;
  tiempo?: { extraSeconds: number };
  silencio?: { playerId: string; playerName: string };
  supercomodin?: { rivalTeamId: string; points: number; gameOver?: boolean } | null;
}

interface Props {
  team: Team;
  allTeams: Team[];
  context?: WildcardContext;
  disabledIds?: string[];
  onlyIds?: WildcardId[];
  silencioTargetTeamId?: string;
  onClose: () => void;
  onUsed: (effect: WildcardEffect) => void;
}

const TIME_EXTRA = 10;
const SUPER_STEAL = 40;

const TEAM_ACCENT: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
};

const TEAM_TEXT: Record<string, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
};

type Step =
  | { id: "grid" }
  | { id: "detail"; wc: Wildcard }
  | { id: "silencio"; wc: Wildcard }
  | { id: "super_leader"; wc: Wildcard }
  | { id: "super_player"; wc: Wildcard; leaderId: string }
  | { id: "super_songs"; wc: Wildcard; leaderId: string; playerName: string; songs: [string, string, string] }
  | { id: "super_predict"; wc: Wildcard; leaderId: string; playerName: string; songs: [string, string, string]; chosenIdx: number | null; prediction: number }
  | { id: "super_hum"; wc: Wildcard; leaderId: string; playerName: string; song: string; prediction: number; actual: number | null };

export default function WildcardModal({
  team,
  allTeams,
  context = "free",
  disabledIds,
  onlyIds,
  silencioTargetTeamId,
  onClose,
  onUsed,
}: Props) {
  const { game, useWildcard, setGame } = useGame();
  const [step, setStep] = useState<Step>({ id: "grid" });

  const liveTeam = game?.teams.find((item) => item.id === team.id) ?? team;
  const currentRound = game?.currentRound ?? 0;
  const roundLocked = teamWildcardLocked(liveTeam, currentRound);
  const rivals = allTeams.filter((item) => item.id !== team.id);
  const maxRivalScore = rivals.length ? Math.max(...rivals.map((item) => item.score)) : 0;
  const leaders = rivals.filter((item) => item.score === maxRivalScore);
  const superEligible = currentRound >= 3 && currentRound <= 5 && liveTeam.score < maxRivalScore;

  const visibleWildcards = liveTeam.wildcards.filter((wc) => !onlyIds || onlyIds.includes(wc.id));

  const targetPlayers = useMemo(() => {
    const targetTeams = silencioTargetTeamId
      ? allTeams.filter((item) => item.id === silencioTargetTeamId)
      : rivals;
    return targetTeams.flatMap((target) => target.players.map((player) => ({ ...player, teamName: target.name, teamColor: target.color })));
  }, [allTeams, rivals, silencioTargetTeamId]);

  const confirmSimple = (wc: Wildcard) => {
    const used = useWildcard(team.id, wc.id);
    if (!used) return;
    if (wc.id === "tiempo") onUsed({ wildcardId: wc.id, tiempo: { extraSeconds: TIME_EXTRA } });
    else onUsed({ wildcardId: wc.id });
  };

  const markSuperUsed = (leaderId: string, success: boolean) => {
    if (!game) return;
    const leader = game.teams.find((item) => item.id === leaderId);
    const user = game.teams.find((item) => item.id === team.id);
    if (!leader || !user) return;
    const superWildcard = user.wildcards.find((item) => item.id === "supercomodin");
    if (!superWildcard || superWildcard.used) return;

    const stolen = success ? Math.min(SUPER_STEAL, Math.max(0, leader.score)) : 0;
    setGame({
      ...game,
      teams: game.teams.map((item) => {
        if (item.id === team.id) {
          return {
            ...item,
            score: item.score + stolen,
            wildcards: item.wildcards.map((wc) => wc.id === "supercomodin" ? { ...wc, used: true } : wc),
          };
        }
        if (success && item.id === leaderId) return { ...item, score: item.score - stolen };
        return item;
      }),
    });
    onUsed({ wildcardId: "supercomodin", supercomodin: success ? { rivalTeamId: leaderId, points: stolen } : null });
  };

  const renderGrid = () => (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Comodines</p>
          <p className={`text-xl font-black ${TEAM_TEXT[liveTeam.color]}`}>{liveTeam.name}</p>
          {roundLocked && !onlyIds?.includes("supercomodin") && (
            <p className="text-xs text-amber-400 mt-1">Ya usaste tu comodín de esta ronda.</p>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visibleWildcards.map((wc) => {
          const superBlocked = wc.id === "supercomodin" && !wc.used && !superEligible;
          const available = isAvailable(wc, context, disabledIds, roundLocked, onlyIds) && !superBlocked;
          const reason = superBlocked
            ? currentRound < 3 || currentRound > 5
              ? "Solo entre R2 y R5"
              : "Solo si vas perdiendo"
            : blockedReason(wc, context, disabledIds, roundLocked, onlyIds);
          return (
            <button
              key={wc.id}
              disabled={!available}
              onClick={() => {
                if (!available) return;
                if (wc.id === "silencio") setStep({ id: "silencio", wc });
                else if (wc.id === "supercomodin") setStep({ id: "super_leader", wc });
                else setStep({ id: "detail", wc });
              }}
              className={`relative p-3 rounded-2xl border text-left transition-all ${
                available
                  ? "bg-canvas-800 border-canvas-700 hover:bg-canvas-700 active:scale-95"
                  : "bg-canvas-900/50 border-canvas-800 opacity-55 cursor-default"
              }`}
            >
              <div className="text-2xl">{wc.emoji}</div>
              <p className="text-sm font-black text-white mt-1">{wc.name}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{wc.description}</p>
              {!available && reason && <p className="text-[10px] text-zinc-600 mt-2 font-bold">{reason}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDetail = (wc: Wildcard) => {
    const hints: Record<WildcardId, string> = {
      tiempo: "+10 segundos al reloj que está corriendo ahora.",
      silencio: "Bloquea a un jugador rival durante este reto.",
      cantante: "Para acertar bastará con decir el artista.",
      robo: "Si el rival falla, el rebote será exclusivamente tuyo.",
      otra: "La canción cambia sin penalización.",
      supercomodin: "Tararea, predice y roba puntos al líder.",
    };
    return (
      <div className="p-5 space-y-5">
        <button onClick={() => setStep({ id: "grid" })} className="text-sm text-zinc-500">← Volver</button>
        <div className="text-center space-y-2">
          <div className="text-5xl">{wc.emoji}</div>
          <p className="text-xl font-black text-white">{wc.name}</p>
          <p className="text-sm text-zinc-400">{hints[wc.id]}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-canvas-800 text-zinc-300 font-bold">Cancelar</button>
          <button onClick={() => confirmSimple(wc)} className={`flex-1 py-3 rounded-xl text-white font-black ${TEAM_ACCENT[liveTeam.color]}`}>Usar ✓</button>
        </div>
      </div>
    );
  };

  const renderSilencio = (wc: Wildcard) => (
    <div className="p-5 space-y-4">
      <button onClick={() => setStep({ id: "grid" })} className="text-sm text-zinc-500">← Volver</button>
      <div className="text-center">
        <div className="text-4xl">🔇</div>
        <p className="text-xl font-black mt-2">¿A quién silencias?</p>
        <p className="text-xs text-zinc-500 mt-1">Solo queda bloqueado durante este reto.</p>
      </div>
      <div className="space-y-2 max-h-72 overflow-auto">
        {targetPlayers.map((player) => (
          <button
            key={player.id}
            onClick={() => {
              const used = useWildcard(team.id, wc.id);
              if (!used) return;
              onUsed({ wildcardId: wc.id, silencio: { playerId: player.id, playerName: player.name } });
            }}
            className="w-full p-3 rounded-xl bg-canvas-800 border border-canvas-700 text-left hover:bg-canvas-700"
          >
            <p className="text-sm font-black text-white">{player.name}</p>
            <p className={`text-xs ${TEAM_TEXT[player.teamColor]}`}>{player.teamName}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSuperLeader = (wc: Wildcard) => (
    <div className="p-5 space-y-4">
      <button onClick={() => setStep({ id: "grid" })} className="text-sm text-zinc-500">← Volver</button>
      <div className="text-center">
        <div className="text-5xl">⭐</div>
        <p className="text-xl font-black mt-2">Supercomodín</p>
        <p className="text-sm text-zinc-400 mt-2">Si la predicción sale exacta, robas hasta 40 puntos al líder. Si fallas, solo pierdes el comodín.</p>
      </div>
      <p className="text-xs uppercase tracking-widest text-zinc-500">Líder objetivo</p>
      {leaders.map((leader) => (
        <button key={leader.id} onClick={() => setStep({ id: "super_player", wc, leaderId: leader.id })} className="w-full p-3 rounded-xl bg-canvas-800 border border-canvas-700 text-left">
          <p className={`font-black ${TEAM_TEXT[leader.color]}`}>{leader.name}</p>
          <p className="text-xs text-zinc-500">{leader.score} pts</p>
        </button>
      ))}
    </div>
  );

  const renderSuperPlayer = (s: Extract<Step, { id: "super_player" }>) => (
    <div className="p-5 space-y-4">
      <button onClick={() => setStep({ id: "super_leader", wc: s.wc })} className="text-sm text-zinc-500">← Volver</button>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">El líder elige</p>
        <p className="text-xl font-black mt-1">¿Quién tararea?</p>
      </div>
      {liveTeam.players.map((player) => (
        <button key={player.id} onClick={() => setStep({ id: "super_songs", wc: s.wc, leaderId: s.leaderId, playerName: player.name, songs: ["", "", ""] })} className="w-full p-3 rounded-xl bg-canvas-800 border border-canvas-700 text-left font-black">
          {player.name}{player.isCaptain ? " 👑" : ""}
        </button>
      ))}
    </div>
  );

  const renderSuperSongs = (s: Extract<Step, { id: "super_songs" }>) => {
    const filled = s.songs.every((song) => song.trim());
    return (
      <div className="p-5 space-y-4">
        <button onClick={() => setStep({ id: "super_player", wc: s.wc, leaderId: s.leaderId })} className="text-sm text-zinc-500">← Volver</button>
        <div className="text-center">
          <p className="text-xl font-black">Tres canciones</p>
          <p className="text-xs text-zinc-500 mt-1">{s.playerName} propone tres. El líder elegirá una.</p>
        </div>
        {s.songs.map((song, index) => (
          <input
            key={index}
            value={song}
            onChange={(event) => {
              const songs = [...s.songs] as [string, string, string];
              songs[index] = event.target.value;
              setStep({ ...s, songs });
            }}
            placeholder={`Canción ${index + 1}`}
            className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-3 text-white focus:outline-none"
          />
        ))}
        <button disabled={!filled} onClick={() => setStep({ id: "super_predict", wc: s.wc, leaderId: s.leaderId, playerName: s.playerName, songs: s.songs, chosenIdx: null, prediction: 0 })} className={`w-full py-3 rounded-xl font-black ${filled ? `${TEAM_ACCENT[liveTeam.color]} text-white` : "bg-canvas-800 text-zinc-600"}`}>Que el líder elija →</button>
      </div>
    );
  };

  const renderSuperPredict = (s: Extract<Step, { id: "super_predict" }>) => {
    const audience = Math.max(0, allTeams.reduce((sum, item) => sum + item.players.length, 0) - 1);
    return (
      <div className="p-5 space-y-4">
        <div className="text-center"><p className="text-xl font-black">Elección + predicción</p><p className="text-xs text-zinc-500 mt-1">El líder elige canción y cuántos oyentes cree que acertarán.</p></div>
        <div className="space-y-2">
          {s.songs.map((song, index) => (
            <button key={song} onClick={() => setStep({ ...s, chosenIdx: index })} className={`w-full p-3 rounded-xl border text-left font-bold ${s.chosenIdx === index ? "border-amber-400 bg-amber-500/10 text-white" : "border-canvas-700 bg-canvas-800 text-zinc-300"}`}>{song}</button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-canvas-800 p-3">
          <button onClick={() => setStep({ ...s, prediction: Math.max(0, s.prediction - 1) })} className="w-10 h-10 rounded-lg bg-canvas-700 font-black">−</button>
          <div className="text-center"><p className="text-3xl font-black">{s.prediction}</p><p className="text-[10px] text-zinc-500">de {audience} oyentes</p></div>
          <button onClick={() => setStep({ ...s, prediction: Math.min(audience, s.prediction + 1) })} className="w-10 h-10 rounded-lg bg-canvas-700 font-black">+</button>
        </div>
        <button disabled={s.chosenIdx === null} onClick={() => setStep({ id: "super_hum", wc: s.wc, leaderId: s.leaderId, playerName: s.playerName, song: s.songs[s.chosenIdx ?? 0], prediction: s.prediction, actual: null })} className={`w-full py-3 rounded-xl font-black ${s.chosenIdx !== null ? "bg-white text-zinc-900" : "bg-canvas-800 text-zinc-600"}`}>Empezar prueba →</button>
      </div>
    );
  };

  const renderSuperHum = (s: Extract<Step, { id: "super_hum" }>) => {
    const audience = Math.max(0, allTeams.reduce((sum, item) => sum + item.players.length, 0) - 1);
    const success = s.actual !== null && s.actual === s.prediction;
    return (
      <div className="p-5 space-y-4 text-center">
        <div className="text-5xl">🎶</div>
        <p className="text-xl font-black">{s.playerName} tararea</p>
        <p className="text-lg text-white">{s.song}</p>
        <p className="text-sm text-zinc-500">Predicción del líder: <span className="text-white font-black">{s.prediction}</span></p>
        <div className="flex items-center justify-between rounded-xl bg-canvas-800 p-3">
          <button onClick={() => setStep({ ...s, actual: Math.max(0, (s.actual ?? 0) - 1) })} className="w-10 h-10 rounded-lg bg-canvas-700 font-black">−</button>
          <div><p className="text-3xl font-black">{s.actual ?? 0}</p><p className="text-[10px] text-zinc-500">acertaron · máx. {audience}</p></div>
          <button onClick={() => setStep({ ...s, actual: Math.min(audience, (s.actual ?? 0) + 1) })} className="w-10 h-10 rounded-lg bg-canvas-700 font-black">+</button>
        </div>
        {s.actual !== null && <p className={`font-black ${success ? "text-emerald-400" : "text-rose-400"}`}>{success ? "✓ Predicción exacta: robo de puntos" : "✗ Predicción fallida: sin robo"}</p>}
        <button disabled={s.actual === null} onClick={() => markSuperUsed(s.leaderId, success)} className={`w-full py-3 rounded-xl font-black ${s.actual !== null ? "bg-white text-zinc-900" : "bg-canvas-800 text-zinc-600"}`}>Cerrar Supercomodín</button>
      </div>
    );
  };

  let body;
  switch (step.id) {
    case "detail": body = renderDetail(step.wc); break;
    case "silencio": body = renderSilencio(step.wc); break;
    case "super_leader": body = renderSuperLeader(step.wc); break;
    case "super_player": body = renderSuperPlayer(step); break;
    case "super_songs": body = renderSuperSongs(step); break;
    case "super_predict": body = renderSuperPredict(step); break;
    case "super_hum": body = renderSuperHum(step); break;
    default: body = renderGrid();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-3xl bg-canvas-950 border border-canvas-700 shadow-2xl text-white">
        {body}
      </div>
    </div>
  );
}
