"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import { setRemoteRound } from "@/lib/supabaseRest";
import Scoreboard from "@/components/Scoreboard";
import RoundTracker from "@/components/RoundTracker";
import WildcardModal from "@/components/WildcardModal";
import VictoryScreen from "@/components/VictoryScreen";
import HostLobby from "@/components/HostLobby";

const ROUND_ROUTES: Record<number, string> = { 1: "/round1", 2: "/round2", 3: "/round3", 4: "/round4", 5: "/round5" };
const ROUND_LABELS: Record<number, string> = { 1: "Entrar en Lo básico →", 2: "Entrar en Territorio →", 3: "Entrar en Duelos →", 4: "Entrar en Cultura musical →", 5: "Entrar en Relámpago →" };
const ROUND_ICONS: Record<number, string> = { 1: "🎵", 2: "🧭", 3: "⚔️", 4: "🧠", 5: "⚡" };
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
    const hostToken = localStorage.getItem("adivina_host_token");
    if (!code || !hostToken) return;
    setRemoteRound(code, hostToken, game.currentRound).catch(() => {});
  }, [hydrated, game?.currentRound]);

  if (!hydrated || !game) return null;

  const handleReset = () => { resetGame(); router.replace("/"); };
  const handleStartGame = () => setGame({
    ...game,
    currentRound: 1,
    rounds: game.rounds.map((round) => ({ ...round, status: round.number === 1 ? "active" : "pending" })),
  });
  const allRoundsDone = game.rounds.every((r) => r.status === "completed");
  const toggleDevMode = () => { const next = !devMode; setDevMode(next); localStorage.setItem(DEV_KEY, next ? "1" : "0"); };
  const jumpToRound = (roundNumber: number) => {
    const roundStatus = (n: number): RoundStatus => n < roundNumber ? "completed" : n === roundNumber ? "active" : "pending";
    setGame({ ...game, currentRound: roundNumber, rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })) });
    router.push(ROUND_ROUTES[roundNumber]);
  };

  const activeRound = game.rounds.find((r) => r.status === "active");
  const activeRoute = activeRound ? ROUND_ROUTES[activeRound.number] : null;
  const inLobby = game.currentRound === 0;

  return (
    <main className="game-stage min-h-screen text-cream-50">
      <header className="sticky top-0 z-10 bg-canvas-950/80 backdrop-blur-xl border-b border-canvas-700/45 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-black text-cream-50 truncate">🎵 Adivina la Canción</span>
          {inLobby ? <span className="ml-1 text-xs game-muted">Lobby</span> : activeRound ? <span className="ml-1 text-xs game-muted truncate">R{activeRound.number} · {activeRound.name}</span> : null}
          {devMode && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gold-300/10 text-gold-300 border border-gold-300/20 tracking-wide">DEV</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDevMode} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${devMode ? "text-gold-300" : "text-zinc-700 hover:text-zinc-500"}`}>{devMode ? "⚙ dev on" : "⚙ dev"}</button>
          {!inLobby && <button onClick={() => setShowVictory(true)} className="text-xs text-zinc-600 hover:text-cream-200 transition-colors">Terminar</button>}
        </div>
      </header>

      {inLobby ? <HostLobby onStarted={handleStartGame} /> : (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-9">
          {activeRound && (
            <section className="game-panel rounded-[2rem] p-5 sm:p-6 flex items-center justify-between gap-4 overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent" />
              <div className="min-w-0 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gold-300/[0.08] border border-gold-300/15 flex items-center justify-center text-2xl flex-shrink-0">{ROUND_ICONS[activeRound.number]}</div>
                <div className="min-w-0">
                  <p className="game-kicker">En curso · Ronda {activeRound.number}</p>
                  <p className="game-title text-2xl truncate mt-1">{activeRound.name}</p>
                  <p className="text-xs game-muted mt-1 truncate">{activeRound.shortDesc}</p>
                </div>
              </div>
              {activeRoute ? (
                <button onClick={() => router.push(activeRoute)} className="game-primary flex-shrink-0 px-4 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all">{ROUND_LABELS[activeRound.number]}</button>
              ) : <span className="flex-shrink-0 text-xs text-zinc-600 italic">Próximamente</span>}
            </section>
          )}

          {devMode && (
            <div className="bg-gold-300/[0.035] border border-gold-300/15 rounded-2xl px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-gold-300/70 uppercase tracking-widest">Saltar a ronda · dev</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ROUND_ROUTES).map(([num, route]) => {
                  const n = Number(num);
                  const round = game.rounds.find((r) => r.number === n);
                  const isCurrent = game.currentRound === n;
                  return <button key={n} onClick={() => jumpToRound(n)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${isCurrent ? "bg-gold-300/15 text-gold-300 border border-gold-300/25" : "bg-canvas-800 text-zinc-400 hover:bg-canvas-700 hover:text-cream-100"}`}>R{n} · {round?.name ?? route}</button>;
                })}
              </div>
            </div>
          )}

          <Scoreboard teams={game.teams} onWildcard={(teamId) => setWildcardTeamId(teamId)} />
          <div className="border-t border-canvas-700/40" />
          <RoundTracker rounds={game.rounds} />
          <div className="h-6" />
        </div>
      )}

      {wildcardTeamId && (() => { const wildcardTeam = game.teams.find((t) => t.id === wildcardTeamId); return wildcardTeam ? <WildcardModal team={wildcardTeam} allTeams={game.teams} onClose={() => setWildcardTeamId(null)} onUsed={() => setWildcardTeamId(null)} /> : null; })()}
      {!inLobby && (showVictory || allRoundsDone) && <VictoryScreen teams={game.teams} onNewGame={handleReset} />}
    </main>
  );
}
