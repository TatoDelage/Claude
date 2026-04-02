"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round1Setup, TurnResult, ROUND1_KEY, scoresByTeam } from "@/lib/round1";
import Setup from "@/components/round1/Setup";
import Play from "@/components/round1/Play";
import Results from "@/components/round1/Results";

type Phase = "setup" | "playing" | "results";

export default function Round1Page() {
  const router = useRouter();
  const { game, applyScores, setRoundActive } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round1Setup | null>(null);
  const [results, setResults] = useState<TurnResult[]>([]);

  // Redirect if no game
  useEffect(() => {
    if (!game) router.replace("/");
  }, [game, router]);

  if (!game) return null;

  const handleSetupDone = (s: Round1Setup) => {
    setSetup(s);
    setPhase("playing");
    // Persist setup in case of page refresh
    localStorage.setItem(ROUND1_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: TurnResult[]) => {
    setResults(r);
    setPhase("results");
  };

  const handleContinue = () => {
    // Apply scores to global game state and mark round 1 as completed
    if (results.length > 0) {
      applyScores(scoresByTeam(results));
    }
    setRoundActive(2);
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
