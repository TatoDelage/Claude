"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round2Setup, TurnResult, ROUND2_KEY, scoresByTeam } from "@/lib/round2";
import { GameState, RoundStatus } from "@/lib/types";
import Setup from "@/components/round2/Setup";
import Play from "@/components/round2/Play";
import Results from "@/components/round2/Results";

type Phase = "setup" | "playing" | "results";

export default function Round2Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round2Setup | null>(null);
  const [results, setResults] = useState<TurnResult[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 2) router.replace("/game");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleSetupDone = (s: Round2Setup) => {
    setSetup(s);
    setPhase("playing");
    localStorage.setItem(ROUND2_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: TurnResult[]) => {
    setResults(r);
    setPhase("results");
  };

  const handleContinue = () => {
    const deltas = results.length > 0 ? scoresByTeam(results) : {};
    const roundStatus = (n: number): RoundStatus =>
      n < 3 ? "completed" : n === 3 ? "active" : "pending";
    const combined: GameState = {
      ...game,
      teams: game.teams.map((t) => ({ ...t, score: t.score + (deltas[t.id] ?? 0) })),
      currentRound: 3,
      rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })),
    };
    setGame(combined);
    localStorage.removeItem(ROUND2_KEY);
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
