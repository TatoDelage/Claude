import { Team } from "./types";

export const SONGS_PER_TEAM = 5;
export const ROUND1_KEY = "adivina_round1";
export const DEFAULT_FRAGMENT_DURATION = 10;
export const DEFAULT_RESPONSE_DURATION = 15;
export const POINTS_CORRECT = 10;

export interface SongEntry {
  title: string;
  artist: string;
}

// One entry in the pre-computed turn order
export interface TurnDef {
  teamId: string;
  songIndex: number; // 0–4
}

export interface TurnResult {
  teamId: string;
  song: SongEntry;
  correct: boolean;
}

export interface Round1Setup {
  fragmentDuration: number;
  responseDuration: number;
  songsByTeam: Record<string, SongEntry[]>; // teamId → 5 songs
  reserveSongByTeam: Record<string, SongEntry>; // teamId → 1 optional reserve song
  turnOrder: TurnDef[];
}

/** Build interleaved turn order starting from a random team. */
export function buildTurnOrder(teams: Team[]): TurnDef[] {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const order: TurnDef[] = [];
  for (let songIdx = 0; songIdx < SONGS_PER_TEAM; songIdx++) {
    for (const team of shuffled) {
      order.push({ teamId: team.id, songIndex: songIdx });
    }
  }
  return order;
}

/** Empty song list for a team. */
export function emptySongs(): SongEntry[] {
  return Array.from({ length: SONGS_PER_TEAM }, () => ({ title: "", artist: "" }));
}

/** Total turns in a round. */
export function totalTurns(setup: Round1Setup): number {
  return setup.turnOrder.length;
}

/** Points scored per team from results. */
export function scoresByTeam(results: TurnResult[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of results) {
    map[r.teamId] = (map[r.teamId] ?? 0) + (r.correct ? POINTS_CORRECT : 0);
  }
  return map;
}
