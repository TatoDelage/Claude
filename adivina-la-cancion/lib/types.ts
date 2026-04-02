export type WildcardId =
  | "tiempo"
  | "silencio"
  | "cantante"
  | "robo"
  | "otra"
  | "supercomodin";

export interface Wildcard {
  id: WildcardId;
  name: string;
  emoji: string;
  description: string;
  used: boolean;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  wildcards: Wildcard[];
  color: TeamColor;
}

export type TeamColor = "violet" | "amber" | "teal" | "rose";

export type RoundStatus = "pending" | "active" | "completed";

export interface Round {
  number: number;
  name: string;
  shortDesc: string;
  status: RoundStatus;
}

export interface GameState {
  teams: Team[];
  currentRound: number;
  rounds: Round[];
}
