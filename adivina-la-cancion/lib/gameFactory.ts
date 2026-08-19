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
  { id: "tiempo", name: "Tiempo", emoji: "⏱️", description: "+10 segundos al reloj activo", type: WILDCARD_TYPES.tiempo },
  { id: "silencio", name: "Silencio", emoji: "🔇", description: "Bloquea a un jugador rival durante este reto", type: WILDCARD_TYPES.silencio },
  { id: "cantante", name: "Cantante", emoji: "🎤", description: "Solo hace falta acertar el artista", type: WILDCARD_TYPES.cantante },
  { id: "robo", name: "Robo", emoji: "🎭", description: "Si el rival falla, el rebote es exclusivamente tuyo", type: WILDCARD_TYPES.robo },
  { id: "otra", name: "Otra canción", emoji: "🔄", description: "Cambia la canción sin penalización", type: WILDCARD_TYPES.otra },
  { id: "supercomodin", name: "Supercomodín", emoji: "⭐", description: "Tararea, predice y roba hasta 40 puntos al líder", type: WILDCARD_TYPES.supercomodin },
];

export const OFFICIAL_ROUNDS: Round[] = [
  {
    number: 1,
    name: "Lo básico",
    shortDesc: "5 canciones por equipo · +10 / 0 · 10s + 10s",
    status: "pending",
  },
  {
    number: 2,
    name: "Territorio",
    shortDesc: "10 territorios consumibles · +20 / -10 · rebote +10",
    status: "pending",
  },
  {
    number: 3,
    name: "Duelos",
    shortDesc: "+20 por duelo ganado · +40 al campeón · pulsador",
    status: "pending",
  },
  {
    number: 4,
    name: "Cultura musical",
    shortDesc: "1 vida · primero a 3 victorias · +100 al campeón",
    status: "pending",
  },
  {
    number: 5,
    name: "Relámpago",
    shortDesc: "45s por jugador · desempate a 30s · +120 al campeón",
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
      lastWildcardRound: undefined,
      players,
    };
  });

  const rounds: Round[] = OFFICIAL_ROUNDS.map((r) => ({ ...r }));
  return { teams, currentRound: 0, rounds };
}

export const GAME_STATE_KEY = "adivina_game_state";
