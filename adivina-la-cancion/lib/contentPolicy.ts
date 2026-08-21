import { BaselineDifficulty } from "./content";

export type ContentMode = "song-bank" | "category-song" | "challenge";

export interface RoundContentPolicy {
  round: 1 | 2 | 3 | 4 | 5;
  mode: ContentMode;
  purpose: string;
  baselineDifficulties?: BaselineDifficulty[];
  requiresArtist: boolean;
  avoidRepeatsWithinRound: boolean;
  avoidRepeatsWithinGame: boolean;
  defaultSongCount?: number;
  reserveSongCount?: number;
}

/**
 * Product-level rules for the future Music Engine.
 * Player affinity will later refine difficulty; these are only neutral defaults.
 */
export const ROUND_CONTENT_POLICIES: Record<1 | 2 | 3 | 4 | 5, RoundContentPolicy> = {
  1: {
    round: 1,
    mode: "song-bank",
    purpose: "Reconocimiento musical general y accesible por equipos.",
    baselineDifficulties: ["easy", "medium"],
    requiresArtist: true,
    avoidRepeatsWithinRound: true,
    avoidRepeatsWithinGame: true,
    defaultSongCount: 5,
    reserveSongCount: 1,
  },
  2: {
    round: 2,
    mode: "category-song",
    purpose: "Una canción válida dentro del territorio consumible elegido.",
    baselineDifficulties: ["medium", "hard"],
    requiresArtist: true,
    avoidRepeatsWithinRound: true,
    avoidRepeatsWithinGame: true,
    defaultSongCount: 10,
  },
  3: {
    round: 3,
    mode: "song-bank",
    purpose: "Canciones equilibradas para competir con pulsador.",
    baselineDifficulties: ["easy", "medium", "hard"],
    requiresArtist: true,
    avoidRepeatsWithinRound: true,
    avoidRepeatsWithinGame: true,
    defaultSongCount: 6,
    reserveSongCount: 1,
  },
  4: {
    round: 4,
    mode: "challenge",
    purpose: "Retos de cultura musical basados en conceptos, no necesariamente en reproducir canciones.",
    requiresArtist: false,
    avoidRepeatsWithinRound: false,
    avoidRepeatsWithinGame: false,
  },
  5: {
    round: 5,
    mode: "song-bank",
    purpose: "Reconocimiento rápido: canciones muy identificables y ritmo alto.",
    baselineDifficulties: ["easy", "medium"],
    requiresArtist: true,
    avoidRepeatsWithinRound: true,
    avoidRepeatsWithinGame: true,
    defaultSongCount: 15,
  },
};
