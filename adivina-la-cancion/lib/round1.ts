import { SongDraft } from "./content";
import { Team } from "./types";

export const SONGS_PER_TEAM = 5;
export const ROUND1_KEY = "adivina_round1";
export const DEFAULT_FRAGMENT_DURATION = 10;
export const DEFAULT_RESPONSE_DURATION = 10;
export const ROBO_REBOUND_DURATION = 10;
export const POINTS_CORRECT = 10;

export type SongEntry = SongDraft;

export interface TurnDef {
  teamId: string;
  songIndex: number;
}

export interface TurnResult {
  teamId: string;
  song: SongEntry;
  correct: boolean;
  reboundTeamId?: string;
}

export interface Round1Setup {
  fragmentDuration: number;
  responseDuration: number;
  songsByTeam: Record<string, SongEntry[]>;
  reserveSongByTeam: Record<string, SongEntry>;
  turnOrder: TurnDef[];
}

export function buildTurnOrder(teams: Team[]): TurnDef[] {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const order: TurnDef[] = [];
  for (let songIdx = 0; songIdx < SONGS_PER_TEAM; songIdx++) {
    for (const team of shuffled) order.push({ teamId: team.id, songIndex: songIdx });
  }
  return order;
}

export function emptySongs(): SongEntry[] {
  return Array.from({ length: SONGS_PER_TEAM }, () => ({ title: "", artist: "" }));
}

export function totalTurns(setup: Round1Setup): number {
  return setup.turnOrder.length;
}

export function scoresByTeam(results: TurnResult[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const result of results) {
    if (result.correct) map[result.teamId] = (map[result.teamId] ?? 0) + POINTS_CORRECT;
    if (result.reboundTeamId) map[result.reboundTeamId] = (map[result.reboundTeamId] ?? 0) + POINTS_CORRECT;
  }
  return map;
}
