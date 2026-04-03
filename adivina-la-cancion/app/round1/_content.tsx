"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round1Setup, TurnResult, ROUND1_KEY, scoresByTeam } from "@/lib/round1";
import { GameState, RoundStatus } from "@/lib/types";
import Setup from "@/components/round1/Setup";
import Play from "@/components/round1/Play";
import Results from "@/components/round1/Results";

type Phase = "setup" | "playing" | "results";

export default function Round1Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round1Setup | null>(null);
  const [results, setResults] = useState<TurnResult[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 1) router.replace("/game");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleSetupDone = (s: Round1Setup) => {
    setSetup(s);
    setPhase("playing");
    localStorage.setItem(ROUND1_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: TurnResult[]) => {
    setResults(r);
    setPhase("results");
  };

  const handleContinue = () => {
    // Combine score application + round advancement into one setGame call to
    // avoid the stale-closure bug where the second persist() would overwrite
    // the first one's localStorage write using the old game reference.
    const deltas = results.length > 0 ? scoresByTeam(results) : {};
    const roundStatus = (n: number): RoundStatus =>
      n < 2 ? "completed" : n === 2 ? "active" : "pending";
    const combined: GameState = {
      ...game,
      teams: game.teams.map((t) => ({ ...t, score: t.score + (deltas[t.id] ?? 0) })),
      currentRound: 2,
      rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })),
    };
    setGame(combined);
    localStorage.removeItem(ROUND1_KEY);
    router.replace("/game");
  };

  return (
    <>
      {phase === "setup" && (
        <Setup teams={game.teams} onStart={handleSetupDone} />
      )}
      {phase === "playing" && setup && (
        <Play setup={setup} teams={game.teams} onComplete={handlePlayDone} />
      )}
      {phase === "results" && setup && (
        <Results results={results} teams={game.teams} onContinue={handleContinue} />
      )}
    </>
  );
}
