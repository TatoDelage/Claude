export const ROUND5_KEY = "adivina_round5";
export const BANK_SIZE = 15;
export const TURN_DURATION = 60; // default; configurable in Setup
export const MIN_TURN_DURATION = 15;
export const MAX_TURN_DURATION = 120;
export const POINTS_WIN = 100;

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
}

export interface PlayerTurnResult {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  correct: number;
  songsShown: number;
}

export interface Round5Setup {
  songs: SongEntry[];
  turnDuration: number;
  visualDistractions: boolean;
}

export interface Round5Result {
  playerResults: PlayerTurnResult[];
  correctByTeam: Record<string, number>;
  /** Empty array = tie (no points awarded). Otherwise contains the single winning team id. */
  winningTeamIds: string[];
}

export function songId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyBank(): SongEntry[] {
  return Array.from({ length: BANK_SIZE }, () => ({ id: songId(), title: "", artist: "" }));
}
