"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { Round5Setup, Round5Result, ROUND5_KEY } from "@/lib/round5";
import { GameState, RoundStatus } from "@/lib/types";
import Setup from "@/components/round5/Setup";
import Play from "@/components/round5/Play";
import Results from "@/components/round5/Results";

type Phase = "setup" | "playing" | "results";

export default function Round5Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Round5Setup | null>(null);
  const [result, setResult] = useState<Round5Result | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 5) router.replace("/game");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleSetupDone = (s: Round5Setup) => {
    setSetup(s);
    setPhase("playing");
    localStorage.setItem(ROUND5_KEY, JSON.stringify(s));
  };

  const handlePlayDone = (r: Round5Result) => {
    setResult(r);
    setPhase("results");
  };

  const handleContinue = () => {
    // All 5 rounds completed — mark everything done and return to hub
    const combined: GameState = {
      ...game,
      currentRound: 6,
      rounds: game.rounds.map((r) => ({ ...r, status: "completed" as RoundStatus })),
    };
    setGame(combined);
    localStorage.removeItem(ROUND5_KEY);
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
