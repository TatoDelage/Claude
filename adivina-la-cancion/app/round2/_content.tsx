"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";

const TURNS_PER_TEAM = 5;
const DEFAULT_CATEGORIES = ["Rock", "Pop", "Español", "2000s", "2010s", "80s/90s", "Indie", "Latino", "Bandas sonoras"];

type Turn = { teamId: string; choices: string[] };
type Result = { teamId: string; category: string; title: string; artist: string; outcome: "correct" | "wrong"; reboundTeamId?: string };

function sampleThree(pool: string[], offset: number) {
  if (pool.length <= 3) return [...pool];
  const picks: string[] = [];
  for (let i = 0; picks.length < 3 && i < pool.length * 2; i += 1) {
    const item = pool[(offset * 3 + i * 2 + i) % pool.length];
    if (!picks.includes(item)) picks.push(item);
  }
  return picks;
}

export default function Round2Content() {
  const router = useRouter();
  const { game, hydrated, setGame, adjustScore } = useGame();
  const [phase, setPhase] = useState<"setup" | "playing" | "results">("setup");
  const [categoryText, setCategoryText] = useState(DEFAULT_CATEGORIES.join(", "));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [awaitingRebound, setAwaitingRebound] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 2) router.replace("/game");
  }, [hydrated, game, router]);

  const categories = useMemo(() => categoryText.split(",").map((x) => x.trim()).filter(Boolean), [categoryText]);
  if (!hydrated || !game) return null;

  const currentTurn = turns[turnIndex];
  const currentTeam = currentTurn ? game.teams.find((t) => t.id === currentTurn.teamId) : null;
  const rivals = currentTeam ? game.teams.filter((t) => t.id !== currentTeam.id) : [];

  const startRound = () => {
    if (categories.length < 3) return;
    const generated: Turn[] = [];
    for (let round = 0; round < TURNS_PER_TEAM; round += 1) {
      game.teams.forEach((team, teamIndex) => generated.push({ teamId: team.id, choices: sampleThree(categories, round * game.teams.length + teamIndex) }));
    }
    setTurns(generated);
    setPhase("playing");
  };

  const resetTurn = () => {
    setSelectedCategory(null); setTitle(""); setArtist(""); setAwaitingRebound(false);
  };

  const nextTurn = () => {
    if (turnIndex + 1 >= turns.length) { setPhase("results"); return; }
    setTurnIndex((i) => i + 1); resetTurn();
  };

  const markCorrect = () => {
    if (!currentTeam || !selectedCategory || !title.trim() || !artist.trim()) return;
    adjustScore(currentTeam.id, 20);
    setResults((r) => [...r, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "correct" }]);
    nextTurn();
  };

  const markWrong = () => {
    if (!currentTeam || !selectedCategory || !title.trim() || !artist.trim()) return;
    adjustScore(currentTeam.id, -10);
    setAwaitingRebound(true);
  };

  const finishWrong = (reboundTeamId?: string) => {
    if (!currentTeam || !selectedCategory) return;
    if (reboundTeamId) adjustScore(reboundTeamId, 10);
    setResults((r) => [...r, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "wrong", reboundTeamId }]);
    nextTurn();
  };

  const continueToRound3 = () => {
    const roundStatus = (n: number): RoundStatus => n < 3 ? "completed" : n === 3 ? "active" : "pending";
    const updated: GameState = { ...game, currentRound: 3, rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })) };
    setGame(updated); router.replace("/game");
  };

  if (phase === "setup") return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header><p className="text-xs uppercase tracking-widest text-zinc-500">Ronda 2</p><h1 className="text-3xl font-black mt-1">Territorio</h1><p className="text-zinc-400 mt-2">Cada equipo elige entre 3 categorías. Acierto +20, fallo −10 y rebote +10.</p></header>
        <section className="rounded-2xl border border-canvas-700 bg-canvas-900 p-5 space-y-4">
          <div><p className="font-black">Pool de categorías</p><p className="text-sm text-zinc-500 mt-1">Sepáralas por comas. El Motor Musical las generará automáticamente más adelante.</p></div>
          <textarea value={categoryText} onChange={(e) => setCategoryText(e.target.value)} rows={5} className="w-full rounded-xl bg-canvas-800 border border-canvas-700 px-3 py-3 text-sm focus:outline-none focus:border-zinc-500" />
          <div className="flex flex-wrap gap-2">{categories.map((c) => <span key={c} className="px-2.5 py-1 rounded-full bg-canvas-800 text-xs text-zinc-300">{c}</span>)}</div>
        </section>
        <section className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-emerald-950/20 border border-emerald-800/40 py-3"><p className="text-2xl font-black text-emerald-400">+20</p><p className="text-xs text-zinc-500">Acierto</p></div>
          <div className="rounded-xl bg-rose-950/20 border border-rose-800/40 py-3"><p className="text-2xl font-black text-rose-400">−10</p><p className="text-xs text-zinc-500">Fallo</p></div>
          <div className="rounded-xl bg-amber-950/20 border border-amber-800/40 py-3"><p className="text-2xl font-black text-amber-400">+10</p><p className="text-xs text-zinc-500">Rebote</p></div>
        </section>
        <button onClick={startRound} disabled={categories.length < 3} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black disabled:opacity-40">Empezar Territorio</button>
      </div>
    </main>
  );

  if (phase === "results") {
    const summary = game.teams.map((team) => ({ team, correct: results.filter((r) => r.teamId === team.id && r.outcome === "correct").length, rebounds: results.filter((r) => r.reboundTeamId === team.id).length }));
    return <main className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-2xl mx-auto space-y-6"><header><p className="text-xs uppercase tracking-widest text-zinc-500">Territorio completado</p><h1 className="text-3xl font-black mt-1">Resultados</h1></header><div className="space-y-3">{summary.map(({ team, correct, rebounds }) => <div key={team.id} className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4 flex items-center justify-between"><div><p className="font-black">{team.name}</p><p className="text-sm text-zinc-500">{correct} aciertos · {rebounds} rebotes</p></div><p className="text-2xl font-black">{team.score}</p></div>)}</div><button onClick={continueToRound3} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black">Continuar a Duelos →</button></div></main>;
  }

  return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-widest text-zinc-500">Territorio · {turnIndex + 1}/{turns.length}</p><h1 className="text-2xl font-black mt-1">Turno de {currentTeam?.name}</h1></div><span className="text-sm text-zinc-500">{Math.floor(turnIndex / game.teams.length) + 1}/{TURNS_PER_TEAM}</span></header>

        {!selectedCategory ? <section className="rounded-2xl border border-canvas-700 bg-canvas-900 p-5 space-y-4"><div><p className="text-xs uppercase tracking-widest text-zinc-500">Elige territorio</p><p className="font-black text-xl mt-1">¿Dónde quieres jugar?</p></div><div className="grid gap-3">{currentTurn?.choices.map((choice) => <button key={choice} onClick={() => setSelectedCategory(choice)} className="rounded-2xl bg-canvas-800 hover:bg-canvas-700 border border-canvas-700 py-5 text-lg font-black active:scale-[.98] transition-all">{choice}</button>)}</div></section> : (
          <section className="rounded-2xl border border-amber-700/40 bg-amber-950/10 p-5 space-y-4">
            <div><p className="text-xs uppercase tracking-widest text-amber-500">Territorio elegido</p><p className="text-2xl font-black mt-1">{selectedCategory}</p><p className="text-sm text-zinc-500 mt-1">Por ahora el presentador elige una canción válida de esta categoría e introduce los datos.</p></div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la canción" className="w-full rounded-xl bg-canvas-800 border border-canvas-700 px-3 py-3 focus:outline-none focus:border-zinc-500" />
            <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artista" className="w-full rounded-xl bg-canvas-800 border border-canvas-700 px-3 py-3 focus:outline-none focus:border-zinc-500" />
            {!awaitingRebound ? <div className="grid grid-cols-2 gap-3"><button onClick={markWrong} disabled={!title.trim() || !artist.trim()} className="py-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 font-black disabled:opacity-30">Falló −10</button><button onClick={markCorrect} disabled={!title.trim() || !artist.trim()} className="py-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 font-black disabled:opacity-30">Correcto +20</button></div> : <div className="space-y-3"><p className="text-sm font-black text-center">¿Hay rebote?</p><div className="grid gap-2">{rivals.map((team) => <button key={team.id} onClick={() => finishWrong(team.id)} className="py-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 font-bold">{team.name} acierta el rebote +10</button>)}<button onClick={() => finishWrong()} className="py-3 rounded-xl bg-canvas-800 text-zinc-400 font-bold">Nadie acierta</button></div></div>}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">{game.teams.map((team) => <div key={team.id} className="rounded-xl bg-canvas-900 border border-canvas-700 px-3 py-2 flex justify-between"><span className="text-sm text-zinc-400">{team.name}</span><span className="font-black">{team.score}</span></div>)}</div>
      </div>
    </main>
  );
}
