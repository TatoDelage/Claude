"use client";

import { useRef, useState } from "react";
import { Team } from "@/lib/types";
import { POINTS_WIN, PlayerTurnResult, Round5Result, Round5Setup, SongEntry, TiebreakResult } from "@/lib/round5";
import { useTimer } from "@/lib/useTimer";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { availableCount, teamWildcardLocked } from "@/lib/wildcardUtils";
import { useGame } from "@/context/GameContext";
import Tiebreak from "@/components/round5/Tiebreak";

const DISABLED = ["silencio", "robo", "supercomodin"];
const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500" },
  amber: { badge: "bg-amber-500", text: "text-amber-300", ring: "stroke-amber-500" },
  sky: { badge: "bg-sky-500", text: "text-sky-300", ring: "stroke-sky-500" },
  rose: { badge: "bg-rose-500", text: "text-rose-300", ring: "stroke-rose-500" },
};

type Phase = "ready" | "active" | "between" | "tiebreak";
interface OrderedPlayer { id: string; name: string; teamId: string; teamName: string; teamColor: string; isCaptain: boolean; }

function shuffle<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
function buildOrder(teams: Team[]): OrderedPlayer[] { const byTeam = teams.map((team) => shuffle(team.players).map((player) => ({ ...player, teamId: team.id, teamName: team.name, teamColor: team.color }))); const max = Math.max(0, ...byTeam.map((players) => players.length)); const order: OrderedPlayer[] = []; for (let i = 0; i < max; i += 1) byTeam.forEach((players) => { if (players[i]) order.push(players[i]); }); return order; }

function TimerRing({ remaining, progress, color }: { remaining: number; progress: number; color: string }) { const r = 68; const c = 2 * Math.PI * r; return <div className="relative flex items-center justify-center"><svg width="170" height="170" className="-rotate-90"><circle cx="85" cy="85" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800"/><circle cx="85" cy="85" r={r} fill="none" stroke="currentColor" strokeWidth="8" className={remaining <= 10 ? "stroke-red-500" : color} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round"/></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-6xl font-black">{remaining}</span><span className="text-[10px] uppercase tracking-widest text-zinc-500">segundos</span></div></div>; }

export default function Play({ setup, teams, onComplete }: { setup: Round5Setup; teams: Team[]; onComplete: (result: Round5Result) => void }) {
  const { game, setGame } = useGame();
  const timer = useTimer();
  const [order] = useState(() => buildOrder(teams));
  const [phase, setPhase] = useState<Phase>("ready");
  const [playerIndex, setPlayerIndex] = useState(0);
  const [bank, setBank] = useState<SongEntry[]>(() => shuffle(setup.songs));
  const [songIndex, setSongIndex] = useState(0);
  const [turnCorrect, setTurnCorrect] = useState(0);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [results, setResults] = useState<PlayerTurnResult[]>([]);
  const [tieIds, setTieIds] = useState<string[]>([]);
  const [wildcardOpen, setWildcardOpen] = useState(false);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const snap = useRef({ playerIndex: 0, turnCorrect: 0, shownIds: [] as string[], bank: [] as SongEntry[], results: [] as PlayerTurnResult[] });

  snap.current = { playerIndex, turnCorrect, shownIds, bank, results };
  const current = order[playerIndex];
  const song = bank[songIndex];
  const color = current ? TEAM_COLOR[current.teamColor] : TEAM_COLOR.violet;

  const totals = (items: PlayerTurnResult[]) => { const map: Record<string, number> = {}; items.forEach((item) => { map[item.teamId] = (map[item.teamId] ?? 0) + item.correct; }); return map; };

  const finishRound = (winnerId: string, history: TiebreakResult[] = []) => {
    const scoreMap = totals(results);
    if (game) setGame({ ...game, teams: game.teams.map((team) => team.id === winnerId ? { ...team, score: team.score + POINTS_WIN } : team) });
    onComplete({ playerResults: results, correctByTeam: scoreMap, winningTeamIds: [winnerId], tiebreaks: history });
  };

  const evaluateRound = (items: PlayerTurnResult[]) => {
    const scoreMap = totals(items);
    const max = Math.max(...teams.map((team) => scoreMap[team.id] ?? 0));
    const winners = teams.filter((team) => (scoreMap[team.id] ?? 0) === max).map((team) => team.id);
    if (winners.length === 1) { setResults(items); setTimeout(() => finishRound(winners[0], []), 0); }
    else { setResults(items); setTieIds(winners); setPhase("tiebreak"); }
  };

  const finishTurn = () => {
    timer.stop();
    const index = snap.current.playerIndex;
    const player = order[index];
    if (!player) return;
    const turnResult: PlayerTurnResult = { playerId: player.id, playerName: player.name, teamId: player.teamId, teamName: player.teamName, teamColor: player.teamColor, correct: snap.current.turnCorrect, songsShown: snap.current.shownIds.length };
    const nextResults = [...snap.current.results, turnResult];
    const shown = new Set(snap.current.shownIds);
    const remaining = snap.current.bank.filter((item) => !shown.has(item.id));
    setResults(nextResults); setBank(remaining.length ? remaining : shuffle(setup.songs)); setSongIndex(0); setTurnCorrect(0); setShownIds([]); setCantanteMode(false); setActiveEffect(null);
    if (index + 1 >= order.length) evaluateRound(nextResults); else setPhase("between");
  };

  const startTurn = () => { setPhase("active"); timer.start(setup.turnDuration, finishTurn); };
  const advanceSong = (correct: boolean) => {
    if (!song) return;
    const nextShown = [...shownIds, song.id]; setShownIds(nextShown); snap.current.shownIds = nextShown;
    if (correct) { const nextCorrect = turnCorrect + 1; setTurnCorrect(nextCorrect); snap.current.turnCorrect = nextCorrect; }
    setCantanteMode(false); setActiveEffect(null);
    if (songIndex + 1 >= bank.length) finishTurn(); else setSongIndex((index) => index + 1);
  };

  const runningTotals = totals(results);
  if (current && phase === "active") runningTotals[current.teamId] = (runningTotals[current.teamId] ?? 0) + turnCorrect;

  const handleWildcard = (effect: WildcardEffect) => {
    if (effect.wildcardId === "tiempo") { const seconds = effect.tiempo?.extraSeconds ?? 10; timer.addTime(seconds); setActiveEffect(`⏱ +${seconds}s`); }
    if (effect.wildcardId === "cantante") { setCantanteMode(true); setActiveEffect("🎤 Solo artista necesario"); }
    if (effect.wildcardId === "otra") { advanceSong(false); setActiveEffect("🔄 Canción cambiada"); }
    setWildcardOpen(false); timer.resume(finishTurn);
  };

  if (!order.length) return <div className="min-h-screen bg-canvas-950 text-white flex items-center justify-center">Sin jugadores registrados.</div>;
  if (phase === "tiebreak") return <Tiebreak teams={teams} initialTeamIds={tieIds} songs={setup.songs} onWinner={(winner, history) => finishRound(winner, history)} />;

  const liveTeam = game?.teams.find((team) => team.id === current?.teamId) ?? teams.find((team) => team.id === current?.teamId);
  const locked = liveTeam && game ? teamWildcardLocked(liveTeam, game.currentRound) : false;
  const wildcardCount = liveTeam ? availableCount(liveTeam.wildcards, "my_turn", DISABLED, locked) : 0;

  return <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
    <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60"><p className="text-xs uppercase tracking-widest text-zinc-500 font-black">Ronda 5 · Relámpago</p><p className="text-sm text-zinc-400 mt-1">Jugador {playerIndex + 1}/{order.length} · {setup.turnDuration}s</p></header>
    {setup.visualDistractions && <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/25 p-2 text-center text-xs font-black text-amber-300">🔥 DISTRACCIONES ACTIVADAS · sin tocar jugador, dispositivo ni pantalla</div>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-canvas-700/60">{teams.map((team) => <div key={team.id} className="rounded-xl bg-canvas-800 p-3 text-center"><p className={`text-xs font-black ${TEAM_COLOR[team.color].text}`}>{team.name}</p><p className="text-3xl font-black">{runningTotals[team.id] ?? 0}</p><p className="text-[10px] text-zinc-600">aciertos</p></div>)}</div>
    {activeEffect && <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/25 p-2 text-center text-xs font-black text-amber-300">{activeEffect}</div>}

    <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col justify-center gap-5">
      {phase === "ready" && <><div className="text-center"><p className={`font-black ${color.text}`}>{current.teamName}</p><h1 className="text-4xl font-black mt-2">{current.name}</h1><p className="text-zinc-500 mt-2">{bank.length} canciones en el banco</p></div><button onClick={startTurn} className="w-full py-5 rounded-2xl bg-white text-zinc-900 font-black text-xl">▶ Empezar turno</button></>}
      {phase === "active" && <><div className="flex justify-between"><div><p className={`font-black ${color.text}`}>{current.name}</p><p className="text-xs text-zinc-500">{current.teamName}</p></div><p className="text-3xl font-black text-emerald-400">{turnCorrect}</p></div><div className="flex justify-center"><TimerRing remaining={timer.remaining} progress={timer.progress} color={color.ring}/></div><div className="rounded-2xl bg-canvas-900 border border-canvas-700 p-5 text-center">{cantanteMode && <p className="text-xs text-amber-400 font-black mb-2">🎤 SOLO ARTISTA</p>}<p className={`text-2xl font-black ${cantanteMode ? "line-through text-zinc-600" : ""}`}>{song?.title}</p><p className="text-zinc-400 mt-1">{song?.artist}</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => advanceSong(false)} className="py-5 rounded-2xl bg-canvas-800 font-black">→ Paso</button><button onClick={() => advanceSong(true)} className="py-5 rounded-2xl bg-emerald-600 font-black text-xl">✓ Acierto</button></div><button disabled={!wildcardCount} onClick={() => { timer.stop(); setWildcardOpen(true); }} className={`w-full py-2.5 rounded-xl border text-xs font-black ${wildcardCount ? "bg-canvas-900 border-canvas-700" : "bg-canvas-900/40 border-canvas-800 text-zinc-700"}`}>🃏 {current.teamName} · {wildcardCount} disponibles</button></>}
      {phase === "between" && <><div className="text-center"><p className="text-xs uppercase tracking-widest text-zinc-500">Turno terminado</p><p className="text-5xl font-black mt-2">{results[results.length - 1]?.correct ?? 0}</p><p className="text-zinc-500">aciertos</p></div><button onClick={() => { setPlayerIndex((index) => index + 1); setPhase("ready"); }} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black">Siguiente jugador →</button></>}
    </div>

    {wildcardOpen && liveTeam && <WildcardModal team={liveTeam} allTeams={teams} context="my_turn" disabledIds={DISABLED} onClose={() => { setWildcardOpen(false); timer.resume(finishTurn); }} onUsed={handleWildcard} />}
  </div>;
}
