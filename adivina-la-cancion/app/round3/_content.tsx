"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round3Setup, TurnResult, ROUND3_KEY } from "@/lib/round3";
import { GameState, RoundStatus } from "@/lib/types";
import Setup from "@/components/round3/Setup";
import Play from "@/components/round3/Play";
import Results from "@/components/round3/Results";

type Phase = "setup" | "playing" | "results";

export default function Round3Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round3Setup | null>(null);
  const [results, setResults] = useState<TurnResult[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 3) router.replace("/game");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleSetupDone = (s: Round3Setup) => {
    setSetup(s);
    setPhase("playing");
    localStorage.setItem(ROUND3_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: TurnResult[]) => {
    setResults(r);
    setPhase("results");
  };

  const handleContinue = () => {
    const roundStatus = (n: number): RoundStatus =>
      n < 4 ? "completed" : n === 4 ? "active" : "pending";
    const combined: GameState = {
      ...game,
      currentRound: 4,
      rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })),
    };
    setGame(combined);
    localStorage.removeItem(ROUND3_KEY);
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
