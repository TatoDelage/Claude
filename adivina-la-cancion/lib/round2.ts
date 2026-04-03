import { Team } from "./types";

export const SONGS_PER_TEAM = 5;
export const ROUND2_KEY = "adivina_round2";
export const DEFAULT_FRAGMENT_DURATION = 10;
export const DEFAULT_RESPONSE_DURATION = 15;
export const POINTS_CORRECT = 20;
export const POINTS_FAIL = -10;

export interface SongEntry {
  title: string;
  artist: string;
}

export interface TurnDef {
  teamId: string;
  songIndex: number;
}

export type ReboundChoice = "pass" | "correct" | "wrong";

export interface ReboundResult {
  teamId: string;
  choice: ReboundChoice;
}

export interface TurnResult {
  teamId: string;
  song: SongEntry;
  primaryCorrect: boolean;
  rebounds: ReboundResult[];
}

export interface Round2Setup {
  fragmentDuration: number;
  responseDuration: number;
  songsByTeam: Record<string, SongEntry[]>;
  turnOrder: TurnDef[];
}

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

export function emptySongs(): SongEntry[] {
  return Array.from({ length: SONGS_PER_TEAM }, () => ({ title: "", artist: "" }));
}

export function totalTurns(setup: Round2Setup): number {
  return setup.turnOrder.length;
}

export function scoresByTeam(results: TurnResult[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of results) {
    map[r.teamId] = (map[r.teamId] ?? 0) + (r.primaryCorrect ? POINTS_CORRECT : POINTS_FAIL);
    for (const rb of r.rebounds) {
      if (rb.choice === "correct") map[rb.teamId] = (map[rb.teamId] ?? 0) + POINTS_CORRECT;
      else if (rb.choice === "wrong") map[rb.teamId] = (map[rb.teamId] ?? 0) + POINTS_FAIL;
    }
  }
  return map;
}
