"use client";

import { useRef, useState } from "react";
import { Team } from "@/lib/types";
import {
  POINTS_CORRECT,
  ROBO_REBOUND_DURATION,
  Round1Setup,
  SongEntry,
  SONGS_PER_TEAM,
  TurnResult,
  totalTurns,
} from "@/lib/round1";
import { useTimer } from "@/lib/useTimer";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount, teamWildcardLocked } from "@/lib/wildcardUtils";
import { useGame } from "@/context/GameContext";

const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500" },
  amber: { badge: "bg-amber-500", text: "text-amber-300", ring: "stroke-amber-500" },
  sky: { badge: "bg-sky-500", text: "text-sky-300", ring: "stroke-sky-500" },
  rose: { badge: "bg-rose-500", text: "text-rose-300", ring: "stroke-rose-500" },
};

type Phase = "idle" | "fragment" | "response" | "judging" | "rebound";

function TimerRing({ remaining, progress, label, color }: { remaining: number; progress: number; label: string; color: string }) {
  const r = 64;
  const circ = 2 * Math.PI * r;
  const low = remaining <= 5 && remaining > 0;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="160" height="160" className="-rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="8" className={low ? "stroke-red-500" : color} strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-black tabular-nums ${low ? "text-red-400 animate-pulse" : "text-white"}`}>{String(remaining).padStart(2, "0")}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{label}</span>
      </div>
    </div>
  );
}

export default function Play({ setup, teams, onComplete }: { setup: Round1Setup; teams: Team[]; onComplete: (results: TurnResult[]) => void }) {
  const { game, adjustScore } = useGame();
  const fragmentTimer = useTimer();
  const responseTimer = useTimer();
  const reboundTimer = useTimer();

  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [songOverride, setSongOverride] = useState<SongEntry | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [blockedPlayers, setBlockedPlayers] = useState<string[]>([]);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [roboTeamId, setRoboTeamId] = useState<string | null>(null);
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const pausedPhase = useRef<Phase | null>(null);

  const turn = setup.turnOrder[turnIndex];
  const currentTeam = teams.find((team) => team.id === turn.teamId)!;
  const baseSong = setup.songsByTeam[turn.teamId][turn.songIndex];
  const currentSong = songOverride ?? baseSong;
  const total = totalTurns(setup);
  const color = TEAM_COLOR[currentTeam.color];
  const roboTeam = teams.find((team) => team.id === roboTeamId);

  const resetEffects = () => {
    setSongOverride(null);
    setCantanteMode(false);
    setBlockedPlayers([]);
    setActiveEffect(null);
    setRoboTeamId(null);
  };

  const finishTurn = (primaryCorrect: boolean, reboundTeamId?: string) => {
    fragmentTimer.stop();
    responseTimer.stop();
    reboundTimer.stop();
    if (primaryCorrect) adjustScore(currentTeam.id, POINTS_CORRECT);
    if (reboundTeamId) adjustScore(reboundTeamId, POINTS_CORRECT);

    const result: TurnResult = { teamId: currentTeam.id, song: currentSong, correct: primaryCorrect, reboundTeamId };
    const nextResults = [...results, result];
    setResults(nextResults);
    setLastMessage(primaryCorrect ? `+${POINTS_CORRECT} · ${currentTeam.name}` : reboundTeamId ? `Robo +${POINTS_CORRECT} · ${teams.find((team) => team.id === reboundTeamId)?.name}` : "0 puntos");
    resetEffects();

    if (turnIndex + 1 >= total) onComplete(nextResults);
    else {
      setTurnIndex((index) => index + 1);
      setPhase("idle");
    }
  };

  const startResponse = () => {
    setPhase("response");
    responseTimer.start(setup.responseDuration, () => setPhase("judging"));
  };

  const startFragment = () => {
    setPhase("fragment");
    fragmentTimer.start(setup.fragmentDuration, startResponse);
  };

  const judge = (correct: boolean) => {
    if (correct) return finishTurn(true);
    if (roboTeamId) {
      setPhase("rebound");
      reboundTimer.start(ROBO_REBOUND_DURATION, () => finishTurn(false));
    } else finishTurn(false);
  };

  const openWildcard = (teamId: string) => {
    pausedPhase.current = phase;
    if (phase === "fragment") fragmentTimer.stop();
    if (phase === "response") responseTimer.stop();
    if (phase === "rebound") reboundTimer.stop();
    setWildcardTeamId(teamId);
  };

  const resumePaused = () => {
    const paused = pausedPhase.current;
    if (paused === "fragment") fragmentTimer.resume(startResponse);
    if (paused === "response") responseTimer.resume(() => setPhase("judging"));
    if (paused === "rebound") reboundTimer.resume(() => finishTurn(false));
    pausedPhase.current = null;
  };

  const closeWildcard = () => {
    setWildcardTeamId(null);
    resumePaused();
  };

  const handleWildcardUsed = (teamId: string, effect: WildcardEffect) => {
    if (effect.wildcardId === "tiempo") {
      const seconds = effect.tiempo?.extraSeconds ?? 10;
      if (pausedPhase.current === "fragment") fragmentTimer.addTime(seconds);
      if (pausedPhase.current === "response") responseTimer.addTime(seconds);
      setActiveEffect(`⏱ +${seconds}s`);
    }
    if (effect.wildcardId === "cantante") {
      setCantanteMode(true);
      setActiveEffect("🎤 Solo artista necesario");
    }
    if (effect.wildcardId === "silencio" && effect.silencio) {
      setBlockedPlayers((prev) => [...prev, effect.silencio!.playerName]);
      setActiveEffect(`🔇 ${effect.silencio.playerName} no puede ayudar en este reto`);
    }
    if (effect.wildcardId === "robo") {
      setRoboTeamId(teamId);
      setActiveEffect(`🎭 Robo de ${teams.find((team) => team.id === teamId)?.name}: si hay fallo, rebote exclusivo`);
    }
    if (effect.wildcardId === "otra") {
      const reserve = setup.reserveSongByTeam[currentTeam.id];
      if (reserve && (reserve.title.trim() || reserve.artist.trim())) {
        setSongOverride(reserve);
        setActiveEffect("🔄 Canción de reserva activada");
      } else setActiveEffect("🔄 El presentador elige otra canción");
    }
    setWildcardTeamId(null);
    resumePaused();
  };

  const timer = phase === "fragment" ? fragmentTimer : phase === "response" ? responseTimer : reboundTimer;
  const timerLabel = phase === "fragment" ? "fragmento" : phase === "response" ? "respuesta" : "robo";

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60 flex justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Ronda 1 · Lo básico</p>
          <p className="text-sm text-zinc-400 mt-1">Turno {turnIndex + 1}/{total} · Canción {turn.songIndex + 1}/{SONGS_PER_TEAM}</p>
        </div>
        <span className={`px-3 py-1.5 h-fit rounded-full text-xs font-black ${color.badge}`}>{currentTeam.name}</span>
      </header>

      <div className="flex gap-2 px-4 py-3 border-b border-canvas-700/60 justify-center flex-wrap">
        {teams.map((team) => <div key={team.id} className="px-4 py-2 rounded-xl bg-canvas-800 text-center"><p className={`text-xs font-bold ${TEAM_COLOR[team.color].text}`}>{team.name}</p><p className="text-xl font-black">{team.score}</p></div>)}
      </div>

      {activeEffect && <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-black text-center">{activeEffect}</div>}
      {blockedPlayers.length > 0 && <div className="mx-4 mt-2 text-center text-xs text-zinc-500">Silenciados este reto: {blockedPlayers.join(", ")}</div>}

      <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col justify-center gap-5">
        {lastMessage && phase === "idle" && <div className="text-center rounded-xl bg-canvas-900 border border-canvas-700 py-2 text-sm font-bold text-zinc-300">{lastMessage}</div>}

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-600">Presentador</p>
          <p className={`text-2xl font-black mt-2 ${cantanteMode ? "line-through text-zinc-600" : "text-white"}`}>{currentSong.title || "Canción"}</p>
          <p className="text-zinc-400 mt-1">{currentSong.artist}</p>
          {cantanteMode && <p className="text-amber-400 text-xs font-black mt-2">Solo hace falta acertar el artista</p>}
        </div>

        {phase === "idle" && <button onClick={startFragment} className="w-full py-5 rounded-2xl bg-white text-zinc-900 font-black text-xl">▶ Reproducir fragmento</button>}

        {(phase === "fragment" || phase === "response" || phase === "rebound") && <div className="flex justify-center"><TimerRing remaining={timer.remaining} progress={timer.progress} label={timerLabel} color={color.ring} /></div>}

        {phase === "fragment" && <button onClick={() => { fragmentTimer.stop(); startResponse(); }} className="w-full py-3 rounded-xl bg-canvas-800 font-bold">Terminar fragmento →</button>}
        {phase === "response" && <button onClick={() => { responseTimer.stop(); setPhase("judging"); }} className="w-full py-3 rounded-xl bg-canvas-800 font-bold">Responder ahora →</button>}

        {phase === "judging" && <div className="grid grid-cols-2 gap-3"><button onClick={() => judge(false)} className="py-4 rounded-2xl bg-rose-950/50 border border-rose-700/40 text-rose-300 font-black">✗ Fallo</button><button onClick={() => judge(true)} className="py-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 font-black">✓ +{POINTS_CORRECT}</button></div>}

        {phase === "rebound" && roboTeam && <div className="space-y-3"><div className="text-center"><p className="text-amber-300 font-black">🎭 Rebote exclusivo de {roboTeam.name}</p><p className="text-xs text-zinc-500">{ROBO_REBOUND_DURATION}s para responder</p></div><div className="grid grid-cols-2 gap-3"><button onClick={() => finishTurn(false)} className="py-4 rounded-2xl bg-rose-950/40 border border-rose-700/30 text-rose-300 font-black">No acierta</button><button onClick={() => finishTurn(false, roboTeam.id)} className="py-4 rounded-2xl bg-amber-500 text-zinc-950 font-black">Robo +{POINTS_CORRECT}</button></div></div>}

        {phase !== "judging" && phase !== "rebound" && (
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => {
              const context: WildcardContext = team.id === currentTeam.id ? "my_turn" : "rival_turn";
              const disabled = ["supercomodin", ...(phase !== "fragment" && phase !== "response" ? ["tiempo"] : []), ...(phase !== "idle" ? ["otra"] : []), ...(roboTeamId ? ["robo"] : [])];
              const locked = game ? teamWildcardLocked(game.teams.find((item) => item.id === team.id) ?? team, game.currentRound) : false;
              const count = availableCount(team.wildcards, context, disabled, locked);
              return <button key={team.id} disabled={count === 0} onClick={() => openWildcard(team.id)} className={`py-2.5 rounded-xl text-xs font-black border ${count ? "bg-canvas-900 border-canvas-700 text-zinc-300" : "bg-canvas-900/40 border-canvas-800 text-zinc-700"}`}>🃏 {team.name} · {count}</button>;
            })}
          </div>
        )}
      </div>

      {wildcardTeamId && (() => {
        const wildcardTeam = teams.find((team) => team.id === wildcardTeamId)!;
        const context: WildcardContext = wildcardTeamId === currentTeam.id ? "my_turn" : "rival_turn";
        const disabled = ["supercomodin", ...(phase !== "fragment" && phase !== "response" ? ["tiempo"] : []), ...(phase !== "idle" ? ["otra"] : []), ...(roboTeamId ? ["robo"] : [])];
        return <WildcardModal team={wildcardTeam} allTeams={teams} context={context} disabledIds={disabled} silencioTargetTeamId={currentTeam.id} onClose={closeWildcard} onUsed={(effect) => handleWildcardUsed(wildcardTeam.id, effect)} />;
      })()}
    </div>
  );
}
