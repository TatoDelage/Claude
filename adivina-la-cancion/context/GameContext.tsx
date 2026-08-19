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
  /** True once localStorage has been read on the client. */
  hydrated: boolean;
  setGame: (state: GameState) => void;
  adjustScore: (teamId: string, delta: number) => void;
  applyScores: (deltas: Record<string, number>) => void;
  useWildcard: (teamId: string, wildcardId: WildcardId) => void;
  setRoundActive: (roundNumber: number) => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function migrateRoundDefinitions(state: GameState): GameState {
  return {
    ...state,
    rounds: OFFICIAL_ROUNDS.map((official) => {
      const saved = state.rounds.find((round) => round.number === official.number);
      return {
        ...official,
        status: saved?.status ?? official.status,
      };
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
      // corrupted data — ignore
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((state: GameState) => {
    setGameState(state);
    if (typeof window !== "undefined") {
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    }
  }, []);

  const setGame = useCallback(
    (state: GameState) => persist(state),
    [persist]
  );

  const adjustScore = useCallback(
    (teamId: string, delta: number) => {
      if (!game) return;
      const updated: GameState = {
        ...game,
        teams: game.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + delta } : t
        ),
      };
      persist(updated);
    },
    [game, persist]
  );

  const useWildcard = useCallback(
    (teamId: string, wildcardId: WildcardId) => {
      if (!game) return;
      const updated: GameState = {
        ...game,
        teams: game.teams.map((t) =>
          t.id === teamId
            ? {
                ...t,
                wildcards: t.wildcards.map((w) =>
                  w.id === wildcardId ? { ...w, used: true } : w
                ),
              }
            : t
        ),
      };
      persist(updated);
    },
    [game, persist]
  );

  const setRoundActive = useCallback(
    (roundNumber: number) => {
      if (!game) return;
      const updated: GameState = {
        ...game,
        currentRound: roundNumber,
        rounds: game.rounds.map((r) => ({
          ...r,
          status:
            r.number < roundNumber
              ? "completed"
              : r.number === roundNumber
              ? "active"
              : "pending",
        })),
      };
      persist(updated);
    },
    [game, persist]
  );

  const applyScores = useCallback(
    (deltas: Record<string, number>) => {
      if (!game) return;
      const updated: GameState = {
        ...game,
        teams: game.teams.map((t) => ({
          ...t,
          score: t.score + (deltas[t.id] ?? 0),
        })),
      };
      persist(updated);
    },
    [game, persist]
  );

  const resetGame = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(GAME_STATE_KEY);
    }
    setGameState(null);
  }, []);

  return (
    <GameContext.Provider
      value={{ game, hydrated, setGame, adjustScore, applyScores, useWildcard, setRoundActive, resetGame }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
