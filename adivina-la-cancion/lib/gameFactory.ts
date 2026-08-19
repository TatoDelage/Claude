import { GameState, Team, Player, Wildcard, Round, TeamColor, WildcardType } from "./types";

export interface PlayerConfig {
  name: string;
  isCaptain: boolean;
}

export interface TeamConfig {
  name: string;
  players: PlayerConfig[];
}

const TEAM_COLORS: TeamColor[] = ["violet", "amber", "sky", "rose"];

const WILDCARD_TYPES: Record<string, WildcardType> = {
  tiempo: "defensa",
  cantante: "defensa",
  otra: "defensa",
  silencio: "ataque",
  robo: "ataque",
  supercomodin: "universal",
};

const WILDCARDS: Omit<Wildcard, "used">[] = [
  { id: "tiempo", name: "Tiempo", emoji: "⏱️", description: "Tiempo extra de escucha", type: WILDCARD_TYPES.tiempo },
  { id: "silencio", name: "Silencio", emoji: "🔇", description: "Bloquea un jugador rival", type: WILDCARD_TYPES.silencio },
  { id: "cantante", name: "Cantante", emoji: "🎤", description: "Solo acertar el artista", type: WILDCARD_TYPES.cantante },
  { id: "robo", name: "Robo", emoji: "🎭", description: "Roba la canción del rival", type: WILDCARD_TYPES.robo },
  { id: "otra", name: "Otra canción", emoji: "🔄", description: "Cambia la canción sin penalización", type: WILDCARD_TYPES.otra },
  { id: "supercomodin", name: "Supercomodín", emoji: "⭐", description: "Tararear y predecir aciertos", type: WILDCARD_TYPES.supercomodin },
];

export const OFFICIAL_ROUNDS: Round[] = [
  {
    number: 1,
    name: "Lo básico",
    shortDesc: "Reconocimiento · 5 canciones por equipo · +10 / 0",
    status: "pending",
  },
  {
    number: 2,
    name: "Territorio",
    shortDesc: "Categorías · estrategia · +20 / -10 · rebote",
    status: "pending",
  },
  {
    number: 3,
    name: "Duelos",
    shortDesc: "Enfrentamientos 1v1 · orden secreto · pulsador",
    status: "pending",
  },
  {
    number: 4,
    name: "Cultura musical",
    shortDesc: "Retos de conocimiento · respuestas por turnos",
    status: "pending",
  },
  {
    number: 5,
    name: "Relámpago",
    shortDesc: "Contrarreloj individual · máximo de aciertos · +100",
    status: "pending",
  },
];

export function createGame(teamConfigs: TeamConfig[]): GameState {
  const teams: Team[] = teamConfigs.map((config, i) => {
    const players: Player[] = config.players.map((p, j) => ({
      id: `team-${i}-player-${j}`,
      name: p.name,
      isCaptain: p.isCaptain,
    }));
    return {
      id: `team-${i}`,
      name: config.name,
      score: 0,
      color: TEAM_COLORS[i],
      wildcards: WILDCARDS.map((w) => ({ ...w, used: false })),
      players,
    };
  });

  const rounds: Round[] = OFFICIAL_ROUNDS.map((r) => ({ ...r }));
  return { teams, currentRound: 0, rounds };
}

export const GAME_STATE_KEY = "adivina_game_state";
