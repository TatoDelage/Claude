"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round4Setup, Round4Result, ROUND4_KEY } from "@/lib/round4";
import { GameState, RoundStatus } from "@/lib/types";
import Setup from "@/components/round4/Setup";
import Play from "@/components/round4/Play";
import Results from "@/components/round4/Results";

type Phase = "setup" | "playing" | "results";

export default function Round4Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round4Setup | null>(null);
  const [result, setResult] = useState<Round4Result | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 4) router.replace("/game");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleSetupDone = (s: Round4Setup) => {
    setSetup(s);
    setPhase("playing");
    localStorage.setItem(ROUND4_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: Round4Result) => {
    setResult(r);
    setPhase("results");
  };

  const handleContinue = () => {
    const roundStatus = (n: number): RoundStatus =>
      n < 5 ? "completed" : n === 5 ? "active" : "pending";
    const combined: GameState = {
      ...game,
      currentRound: 5,
      rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })),
    };
    setGame(combined);
    localStorage.removeItem(ROUND4_KEY);
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
      {phase === "results" && setup && result && (
        <Results result={result} teams={game.teams} onContinue={handleContinue} />
      )}
    </>
  );
}
