"use client";

import { useRef, useState } from "react";
import { Team } from "@/lib/types";
import { SongEntry, TIEBREAK_DURATION, TiebreakResult } from "@/lib/round5";
import { useTimer } from "@/lib/useTimer";

const TEAM_TEXT: Record<string, string> = { violet: "text-violet-300", amber: "text-amber-300", sky: "text-sky-300", rose: "text-rose-300" };
const TEAM_RING: Record<string, string> = { violet: "stroke-violet-500", amber: "stroke-amber-500", sky: "stroke-sky-500", rose: "stroke-rose-500" };

type Phase = "select" | "ready" | "active";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

function TimerRing({ remaining, progress, color }: { remaining: number; progress: number; color: string }) {
  const r = 64; const c = 2 * Math.PI * r;
  return <div className="relative flex items-center justify-center"><svg width="160" height="160" className="-rotate-90"><circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800"/><circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="8" className={remaining <= 10 ? "stroke-red-500" : color} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round"/></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-6xl font-black">{remaining}</span><span className="text-[10px] uppercase tracking-widest text-zinc-500">desempate</span></div></div>;
}

export default function Tiebreak({ teams, initialTeamIds, songs, onWinner }: { teams: Team[]; initialTeamIds: string[]; songs: SongEntry[]; onWinner: (winnerTeamId: string, history: TiebreakResult[]) => void }) {
  const timer = useTimer();
  const [phase, setPhase] = useState<Phase>("select");
  const [teamIds, setTeamIds] = useState(initialTeamIds);
  const [reps, setReps] = useState<Record<string, string>>(() => Object.fromEntries(initialTeamIds.map((id) => [id, teams.find((team) => team.id === id)?.players[0]?.id ?? ""])));
  const [round, setRound] = useState(1);
  const [teamIndex, setTeamIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [songOrder, setSongOrder] = useState<SongEntry[]>([]);
  const [songIndex, setSongIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [history, setHistory] = useState<TiebreakResult[]>([]);
  const snap = useRef({ teamIndex: 0, correct: 0, scores: {} as Record<string, number>, teamIds: initialTeamIds });
  snap.current = { teamIndex, correct, scores, teamIds };

  const teamId = teamIds[teamIndex];
  const team = teams.find((item) => item.id === teamId);
  const rep = team?.players.find((player) => player.id === reps[teamId]);
  const song = songOrder[songIndex];

  const finishTurn = () => {
    timer.stop();
    const currentTeamId = snap.current.teamIds[snap.current.teamIndex];
    const nextScores = { ...snap.current.scores, [currentTeamId]: snap.current.correct };
    setScores(nextScores);
    if (snap.current.teamIndex + 1 < snap.current.teamIds.length) { setTeamIndex((value) => value + 1); setPhase("ready"); return; }
    const max = Math.max(...snap.current.teamIds.map((id) => nextScores[id] ?? 0));
    const winners = snap.current.teamIds.filter((id) => (nextScores[id] ?? 0) === max);
    const result: TiebreakResult = { round, scores: nextScores, teamIds: [...snap.current.teamIds] };
    const nextHistory = [...history, result];
    setHistory(nextHistory);
    if (winners.length === 1) { onWinner(winners[0], nextHistory); return; }
    setTeamIds(winners); setScores({}); setTeamIndex(0); setRound((value) => value + 1); setPhase("ready");
  };

  const startTurn = () => {
    const ordered = shuffle(songs);
    setSongOrder(ordered); setSongIndex(0); setCorrect(0); snap.current.correct = 0; setPhase("active");
    timer.start(TIEBREAK_DURATION, finishTurn);
  };

  const advanceSong = (isCorrect: boolean) => {
    if (isCorrect) { setCorrect((value) => value + 1); snap.current.correct += 1; }
    if (songIndex + 1 >= songOrder.length) finishTurn(); else setSongIndex((value) => value + 1);
  };

  if (phase === "select") return <div className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-xl mx-auto space-y-5"><header className="text-center"><p className="text-xs uppercase tracking-widest text-zinc-500 font-black">Relámpago · desempate</p><h1 className="text-4xl font-black mt-2">Elegid representante</h1><p className="text-zinc-500 text-sm mt-2">30 segundos por equipo. Si empatan otra vez, repetimos.</p></header>{teamIds.map((id) => { const item = teams.find((team) => team.id === id)!; return <section key={id} className="rounded-2xl bg-canvas-900 border border-canvas-700 p-4"><p className={`font-black ${TEAM_TEXT[item.color]}`}>{item.name}</p><select value={reps[id]} onChange={(event) => setReps((prev) => ({ ...prev, [id]: event.target.value }))} className="w-full mt-3 bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-3">{item.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></section>; })}<button onClick={() => setPhase("ready")} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black">Empezar desempate →</button></div></div>;

  if (phase === "ready") return <div className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-md mx-auto min-h-[75vh] flex flex-col items-center justify-center text-center gap-5"><p className="text-xs uppercase tracking-widest text-zinc-500 font-black">Desempate {round} · {teamIndex + 1}/{teamIds.length}</p><p className={`font-black ${team ? TEAM_TEXT[team.color] : ""}`}>{team?.name}</p><h1 className="text-4xl font-black">{rep?.name}</h1><p className="text-zinc-500">{TIEBREAK_DURATION}s · sin comodines</p><button onClick={startTurn} className="w-full py-5 rounded-2xl bg-white text-zinc-900 font-black text-xl">▶ Empezar</button></div></div>;

  return <div className="min-h-screen bg-canvas-950 text-white px-4 py-6"><div className="max-w-md mx-auto min-h-[85vh] flex flex-col items-center justify-between gap-5"><div className="text-center"><p className={`font-black ${team ? TEAM_TEXT[team.color] : ""}`}>{team?.name} · {rep?.name}</p><p className="text-4xl font-black text-emerald-400 mt-2">{correct}</p><p className="text-xs text-zinc-500">aciertos</p></div><TimerRing remaining={timer.remaining} progress={timer.progress} color={team ? TEAM_RING[team.color] : "stroke-white"}/><div className="w-full rounded-2xl bg-canvas-900 border border-canvas-700 p-5 text-center"><p className="text-2xl font-black">{song?.title}</p><p className="text-zinc-400 mt-1">{song?.artist}</p></div><div className="grid grid-cols-2 gap-2 w-full"><button onClick={() => advanceSong(false)} className="py-5 rounded-2xl bg-canvas-800 font-black">→ Paso</button><button onClick={() => advanceSong(true)} className="py-5 rounded-2xl bg-emerald-600 font-black text-xl">✓ Acierto</button></div></div></div>;
}
