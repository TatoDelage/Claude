export type WildcardId =
  | "tiempo"
  | "silencio"
  | "cantante"
  | "robo"
  | "otra"
  | "supercomodin";

/** Defensa: usable only on your own turn. Ataque: rival turn only. Universal: always. */
export type WildcardType = "defensa" | "ataque" | "universal";

export interface Wildcard {
  id: WildcardId;
  name: string;
  emoji: string;
  description: string;
  used: boolean;
  type: WildcardType;
}

export interface Player {
  id: string;
  name: string;
  isCaptain: boolean;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  wildcards: Wildcard[];
  /** Last normal round in which this team used a wildcard. Supercomodín does not consume this quota. */
  lastWildcardRound?: number;
  color: TeamColor;
  players: Player[];
}

export type TeamColor = "violet" | "amber" | "sky" | "rose";

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
