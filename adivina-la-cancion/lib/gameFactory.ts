import { GameState, Team, Player, Wildcard, Round, TeamColor, WildcardType } from "./types";

export interface PlayerConfig {
  name: string;
  isCaptain: boolean;
}

export interface TeamConfig {
  name: string;
  players: PlayerConfig[];
}

const TEAM_COLORS: TeamColor[] = ["violet", "amber", "teal", "rose"];

const WILDCARD_TYPES: Record<string, WildcardType> = {
  tiempo: "defensa",
  cantante: "defensa",
  otra: "defensa",
  silencio: "ataque",
  robo: "ataque",
  supercomodin: "universal",
};

const WILDCARDS: Omit<Wildcard, "used">[] = [
  {
    id: "tiempo",
    name: "Tiempo",
    emoji: "⏱️",
    description: "Tiempo extra de escucha",
    type: WILDCARD_TYPES.tiempo,
  },
  {
    id: "silencio",
    name: "Silencio",
    emoji: "🔇",
    description: "Bloquea un jugador rival",
    type: WILDCARD_TYPES.silencio,
  },
  {
    id: "cantante",
    name: "Cantante",
    emoji: "🎤",
    description: "Solo acertar el artista",
    type: WILDCARD_TYPES.cantante,
  },
  {
    id: "robo",
    name: "Robo",
    emoji: "🎭",
    description: "Roba la canción del rival",
    type: WILDCARD_TYPES.robo,
  },
  {
    id: "otra",
    name: "Otra canción",
    emoji: "🔄",
    description: "Cambia la canción sin penalización",
    type: WILDCARD_TYPES.otra,
  },
  {
    id: "supercomodin",
    name: "Supercomodín",
    emoji: "⭐",
    description: "Tararear y predecir aciertos",
    type: WILDCARD_TYPES.supercomodin,
  },
];

const ROUNDS: Round[] = [
  {
    number: 1,
    name: "Lo básico",
    shortDesc: "5 canciones por equipo · +10 / 0",
    status: "pending",
  },
  {
    number: 2,
    name: "Subimos nivel",
    shortDesc: "5 canciones · con rebote · comodines",
    status: "pending",
  },
  {
    number: 3,
    name: "Pulsadores",
    shortDesc: "5 en total · quien pulsa responde · +20 / -10",
    status: "pending",
  },
  {
    number: 4,
    name: "Cultura musical",
    shortDesc: "Tema libre · por turnos · +100 / -50",
    status: "pending",
  },
  {
    number: 5,
    name: "Relámpago",
    shortDesc: "1 min individual · máx canciones · +100",
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

  const rounds: Round[] = ROUNDS.map((r) => ({ ...r }));
  rounds[0].status = "active";

  return { teams, currentRound: 1, rounds };
}

export const GAME_STATE_KEY = "adivina_game_state";
