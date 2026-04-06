export const ROUND4_KEY = "adivina_round4";
export const DEFAULT_TURN_DURATION = 15;
export const POINTS_WIN = 100;
export const POINTS_LOSE = -50;

export interface Round4Setup {
  topic: string;
  turnDuration: number;
}

export interface Round4Result {
  topic: string;
  usedAnswers: string[];
  losingTeamId: string;
  winningTeamIds: string[];
  endReason: "timeout" | "invalid";
}
