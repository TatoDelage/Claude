import { GameState, Team, Wildcard, Round, TeamColor } from "./types";

const TEAM_COLORS: TeamColor[] = ["violet", "amber", "teal", "rose"];

const WILDCARDS: Omit<Wildcard, "used">[] = [
  {
    id: "tiempo",
    name: "Tiempo",
    emoji: "⏱️",
    description: "Tiempo extra de escucha",
  },
  {
    id: "silencio",
    name: "Silencio",
    emoji: "🔇",
    description: "Bloquea un jugador rival",
  },
  {
    id: "cantante",
    name: "Cantante",
    emoji: "🎤",
    description: "Solo acertar el artista",
  },
  {
    id: "robo",
    name: "Robo",
    emoji: "🎭",
    description: "Roba la canción del rival",
  },
  {
    id: "otra",
    name: "Otra canción",
    emoji: "🔄",
    description: "Cambia la canción sin penalización",
  },
  {
    id: "supercomodin",
    name: "Supercomodín",
    emoji: "⭐",
    description: "Tararear y predecir aciertos",
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

export function createGame(teamNames: string[]): GameState {
  const teams: Team[] = teamNames.map((name, i) => ({
    id: `team-${i}`,
    name,
    score: 0,
    color: TEAM_COLORS[i],
    wildcards: WILDCARDS.map((w) => ({ ...w, used: false })),
  }));

  const rounds: Round[] = ROUNDS.map((r) => ({ ...r }));
  rounds[0].status = "active";

  return { teams, currentRound: 1, rounds };
}

export const GAME_STATE_KEY = "adivina_game_state";
