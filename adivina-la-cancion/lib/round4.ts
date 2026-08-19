export const ROUND4_KEY = "adivina_round4";
export const DEFAULT_TURN_DURATION = 15;
export const DEFAULT_WINS_TO_WIN = 3;
export const POINTS_WIN = 100;

export interface Round4Setup {
  topic: string;
  turnDuration: number;
  winsToWin: number;
}

export interface Round4MatchSummary {
  matchNumber: number;
  topic: string;
  winnerTeamId: string;
  eliminatedTeamIds: string[];
  usedAnswers: string[];
}

export interface Round4Result {
  winnerTeamId: string;
  victoriesByTeam: Record<string, number>;
  winsToWin: number;
  matches: Round4MatchSummary[];
}
