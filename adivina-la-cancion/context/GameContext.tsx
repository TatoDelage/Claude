"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { GameState, WildcardId } from "@/lib/types";
import { GAME_STATE_KEY, OFFICIAL_ROUNDS } from "@/lib/gameFactory";

interface GameContextValue {
  game: GameState | null;
  hydrated: boolean;
  setGame: (state: GameState) => void;
  adjustScore: (teamId: string, delta: number) => void;
  applyScores: (deltas: Record<string, number>) => void;
  useWildcard: (teamId: string, wildcardId: WildcardId) => boolean;
  setRoundActive: (roundNumber: number) => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function migrateRoundDefinitions(state: GameState): GameState {
  return {
    ...state,
    teams: state.teams.map((team) => ({ ...team, lastWildcardRound: team.lastWildcardRound })),
    rounds: OFFICIAL_ROUNDS.map((official) => {
      const saved = state.rounds.find((round) => round.number === official.number);
      return { ...official, status: saved?.status ?? official.status };
    }),
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGameState] = useState<GameState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GAME_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        const migrated = migrateRoundDefinitions(parsed);
        setGameState(migrated);
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify(migrated));
      }
    } catch {
      // Corrupted local data is ignored.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((state: GameState) => {
    setGameState(state);
    if (typeof window !== "undefined") localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  }, []);

  const setGame = useCallback((state: GameState) => persist(state), [persist]);

  const adjustScore = useCallback((teamId: string, delta: number) => {
    if (!game) return;
    persist({
      ...game,
      teams: game.teams.map((team) => team.id === teamId ? { ...team, score: team.score + delta } : team),
    });
  }, [game, persist]);

  const applyScores = useCallback((deltas: Record<string, number>) => {
    if (!game) return;
    persist({
      ...game,
      teams: game.teams.map((team) => ({ ...team, score: team.score + (deltas[team.id] ?? 0) })),
    });
  }, [game, persist]);

  const useWildcard = useCallback((teamId: string, wildcardId: WildcardId): boolean => {
    if (!game) return false;
    const team = game.teams.find((item) => item.id === teamId);
    const wildcard = team?.wildcards.find((item) => item.id === wildcardId);
    if (!team || !wildcard || wildcard.used) return false;

    const isSuper = wildcardId === "supercomodin";
    if (!isSuper && game.currentRound > 0 && team.lastWildcardRound === game.currentRound) return false;

    persist({
      ...game,
      teams: game.teams.map((item) => item.id === teamId ? {
        ...item,
        lastWildcardRound: isSuper ? item.lastWildcardRound : game.currentRound,
        wildcards: item.wildcards.map((wc) => wc.id === wildcardId ? { ...wc, used: true } : wc),
      } : item),
    });
    return true;
  }, [game, persist]);

  const setRoundActive = useCallback((roundNumber: number) => {
    if (!game) return;
    persist({
      ...game,
      currentRound: roundNumber,
      rounds: game.rounds.map((round) => ({
        ...round,
        status: round.number < roundNumber ? "completed" : round.number === roundNumber ? "active" : "pending",
      })),
    });
  }, [game, persist]);

  const resetGame = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(GAME_STATE_KEY);
    setGameState(null);
  }, []);

  return (
    <GameContext.Provider value={{ game, hydrated, setGame, adjustScore, applyScores, useWildcard, setRoundActive, resetGame }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
