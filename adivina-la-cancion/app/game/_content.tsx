"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { RoundStatus } from "@/lib/types";
import { setRemoteRound } from "@/lib/supabaseRest";
import Scoreboard from "@/components/Scoreboard";
import RoundTracker from "@/components/RoundTracker";
import WildcardModal from "@/components/WildcardModal";
import VictoryScreen from "@/components/VictoryScreen";
import HostLobby from "@/components/HostLobby";

const ROUTES: Record<number, string> = { 1: "/round1", 2: "/round2", 3: "/round3", 4: "/round4", 5: "/round5" };
const LABELS: Record<number, string> = { 1: "Entrar en Lo básico →", 2: "Entrar en Territorio →", 3: "Entrar en Duelos →", 4: "Entrar en Cultura musical →", 5: "Entrar en Relámpago →" };
const ICONS: Record<number, string> = { 1: "🎵", 2: "🧭", 3: "⚔️", 4: "🧠", 5: "⚡" };
const DEV_KEY = "adivina_dev";

export default function GameContent() {
  const router = useRouter();
  const { game, hydrated, resetGame, setGame } = useGame();
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [devMode, setDevMode] = useState(() => typeof window !== "undefined" && localStorage.getItem(DEV_KEY) === "1");

  useEffect(() => { if (hydrated && !game) router.replace("/"); }, [hydrated, game, router]);
  useEffect(() => {
    if (!hydrated || !game || game.currentRound <= 0) return;
    const code = localStorage.getItem("adivina_join_code");
    const token = localStorage.getItem("adivina_host_token");
    if (code && token) setRemoteRound(code, token, game.currentRound).catch(() => {});
  }, [hydrated, game?.currentRound]);

  if (!hydrated || !game) return null;

  const inLobby = game.currentRound === 0;
  const activeRound = game.rounds.find((round) => round.status === "active");
  const allRoundsDone = game.rounds.every((round) => round.status === "completed");
  const canUseSuper = game.currentRound >= 3 && game.currentRound <= 5;

  const handleReset = () => { resetGame(); router.replace("/"); };
  const handleStartGame = () => setGame({ ...game, currentRound: 1, rounds: game.rounds.map((round) => ({ ...round, status: round.number === 1 ? "active" : "pending" })) });
  const jumpToRound = (roundNumber: number) => {
    const status = (n: number): RoundStatus => n < roundNumber ? "completed" : n === roundNumber ? "active" : "pending";
    setGame({ ...game, currentRound: roundNumber, rounds: game.rounds.map((round) => ({ ...round, status: status(round.number) })) });
    router.push(ROUTES[roundNumber]);
  };
  const toggleDev = () => { const next = !devMode; setDevMode(next); localStorage.setItem(DEV_KEY, next ? "1" : "0"); };
  const handleFinish = () => {
    if (window.confirm("¿Terminar la partida y mostrar el resultado final?")) setShowVictory(true);
  };

  return (
    <main className="game-stage min-h-screen text-cream-50">
      <header className="sticky top-0 z-10 bg-canvas-950/80 backdrop-blur-xl border-b border-canvas-700/45 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0"><span className="text-sm font-black truncate">🎵 Adivina la Canción</span>{activeRound && <span className="text-xs game-muted truncate">R{activeRound.number} · {activeRound.name}</span>}{devMode && <span className="text-[10px] font-black text-gold-300">DEV</span>}</div>
        <div className="flex gap-3"><button onClick={toggleDev} className="text-[10px] text-zinc-600">⚙ dev</button>{!inLobby && <button onClick={handleFinish} className="text-xs text-zinc-600">Terminar</button>}</div>
      </header>

      {inLobby ? <HostLobby onStarted={handleStartGame} /> : <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {activeRound && <section className="game-panel rounded-[2rem] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex items-center gap-4 min-w-0"><div className="w-12 h-12 rounded-2xl bg-gold-300/[0.08] border border-gold-300/15 flex items-center justify-center text-2xl">{ICONS[activeRound.number]}</div><div className="min-w-0"><p className="game-kicker">En curso · Ronda {activeRound.number}</p><p className="game-title text-2xl truncate mt-1">{activeRound.name}</p><p className="text-xs game-muted mt-1 sm:truncate">{activeRound.shortDesc}</p></div></div><button onClick={() => router.push(ROUTES[activeRound.number])} className="game-primary w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-black flex-shrink-0">{LABELS[activeRound.number]}</button></section>}

        {canUseSuper && <section className="rounded-2xl border border-gold-300/20 bg-gold-300/[0.04] p-4"><p className="text-xs uppercase tracking-widest text-gold-300 font-black">⭐ Supercomodín</p><p className="text-sm game-muted mt-1">Solo puede usarlo un equipo que vaya perdiendo. Pulsa su botón de Supercomodín en el marcador.</p></section>}

        {devMode && <div className="rounded-2xl border border-gold-300/15 p-3 flex flex-wrap gap-2">{Object.keys(ROUTES).map((value) => { const round = Number(value); return <button key={round} onClick={() => jumpToRound(round)} className="px-3 py-1.5 rounded-xl bg-canvas-800 text-xs font-bold">R{round}</button>; })}</div>}

        <Scoreboard
          teams={game.teams}
          onWildcard={canUseSuper ? (teamId) => setWildcardTeamId(teamId) : undefined}
          wildcardIds={["supercomodin"]}
          wildcardLabel="⭐ Supercomodín"
        />
        <div className="border-t border-canvas-700/40" />
        <RoundTracker rounds={game.rounds} />
      </div>}

      {wildcardTeamId && (() => {
        const team = game.teams.find((item) => item.id === wildcardTeamId);
        return team ? <WildcardModal team={team} allTeams={game.teams} context="free" onlyIds={["supercomodin"]} onClose={() => setWildcardTeamId(null)} onUsed={() => setWildcardTeamId(null)} /> : null;
      })()}
      {!inLobby && (showVictory || allRoundsDone) && <VictoryScreen teams={game.teams} onNewGame={handleReset} />}
    </main>
  );
}
