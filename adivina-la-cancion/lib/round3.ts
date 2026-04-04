export const SONGS_TOTAL = 5;   // songs to input in setup form
export const CORRECT_TO_WIN = 5; // correct answers needed to end the round
export const ROUND3_KEY = "adivina_round3";
export const DEFAULT_RESPONSE_DURATION = 15;
export const POINTS_CORRECT = 20;
export const POINTS_FAIL = -10;

export interface SongEntry {
  title: string;
  artist: string;
}

export type ReboundChoice = "pass" | "correct" | "wrong";

export interface ReboundResult {
  teamId: string;
  choice: ReboundChoice;
}

export interface TurnResult {
  songIndex: number;
  song: SongEntry;
  buzzerTeamId: string;
  primaryCorrect: boolean;
  rebounds: ReboundResult[];
}

export interface Round3Setup {
  responseDuration: number;
  songs: SongEntry[];
}

export function emptySongs(): SongEntry[] {
  return Array.from({ length: SONGS_TOTAL }, () => ({ title: "", artist: "" }));
}

export function scoresByTeam(results: TurnResult[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of results) {
    map[r.buzzerTeamId] = (map[r.buzzerTeamId] ?? 0) + (r.primaryCorrect ? POINTS_CORRECT : POINTS_FAIL);
    for (const rb of r.rebounds) {
      if (rb.choice === "correct") map[rb.teamId] = (map[rb.teamId] ?? 0) + POINTS_CORRECT;
      else if (rb.choice === "wrong") map[rb.teamId] = (map[rb.teamId] ?? 0) + POINTS_FAIL;
    }
  }
  return map;
}
