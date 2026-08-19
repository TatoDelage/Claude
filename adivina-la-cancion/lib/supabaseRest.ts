import type { TeamConfig } from "./gameFactory";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Faltan las variables de entorno de Supabase");
}

function headers(extra?: Record<string, string>) {
  assertConfig();
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function generateJoinCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export interface RemoteGame {
  id: string;
  join_code: string;
  host_token?: string;
  status?: string;
  mode?: string;
  current_round?: number;
  buzzer_open?: boolean;
  buzzer_winner_player_id?: string | null;
  buzzer_opened_at?: string | null;
  buzzer_pressed_at?: string | null;
  buzzer_allowed_player_ids?: string[] | null;
  settings?: { teamCount?: number; teamNames?: string[] };
}

export interface RemoteGamePlayer {
  id: string;
  game_id: string;
  display_name: string;
  team_number: number | null;
  is_captain: boolean;
  is_presenter: boolean;
  device_active: boolean;
  sort_order: number;
  duel_order?: number | null;
}

export interface RemoteRoom { game: RemoteGame; players: RemoteGamePlayer[] }
export interface ClaimedPlayer { player_id: string; display_name: string; team_number: number | null; is_captain: boolean; is_presenter: boolean }
export interface BuzzerPressResult { won: boolean; winner_player_id: string | null; winner_name: string | null; winner_team_number: number | null; pressed_at: string | null }

export async function createRemoteGame(teamConfigs: TeamConfig[]): Promise<RemoteGame> {
  assertConfig();
  const joinCode = generateJoinCode();
  const hostToken = crypto.randomUUID();
  const gameResponse = await fetch(`${SUPABASE_URL}/rest/v1/games`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      join_code: joinCode, host_token: hostToken, mode: "local", status: "lobby", current_round: 0,
      settings: { teamCount: teamConfigs.length, teamNames: teamConfigs.map((team) => team.name) },
    }),
  });
  if (!gameResponse.ok) throw new Error(`No se pudo crear la partida (${gameResponse.status})`);
  const createdGames = (await gameResponse.json()) as RemoteGame[];
  const game = createdGames[0];
  const players = teamConfigs.flatMap((team, teamIndex) => team.players.map((player, playerIndex) => ({
    game_id: game.id, user_id: null, display_name: player.name, team_number: teamIndex + 1,
    is_captain: player.isCaptain, is_presenter: false, device_active: false, sort_order: playerIndex,
  })));
  if (players.length) {
    const playersResponse = await fetch(`${SUPABASE_URL}/rest/v1/game_players`, { method: "POST", headers: headers(), body: JSON.stringify(players) });
    if (!playersResponse.ok) throw new Error(`La partida se creó, pero no se pudieron guardar los jugadores (${playersResponse.status})`);
  }
  return { ...game, host_token: hostToken };
}

export async function startRemoteGame(code: string, hostToken: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_remote_game`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_host_token: hostToken }) });
  if (!response.ok) throw new Error("No se pudo empezar la partida");
}

export async function setRemoteRound(code: string, hostToken: string, round: number) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_game_round`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_host_token: hostToken, p_round: round }) });
  if (!response.ok) throw new Error("No se pudo sincronizar la ronda");
}

export async function getRemoteRoomByCode(code: string): Promise<RemoteRoom | null> {
  assertConfig();
  const normalized = code.trim().toUpperCase();
  const gameResponse = await fetch(`${SUPABASE_URL}/rest/v1/games?join_code=eq.${encodeURIComponent(normalized)}&select=id,join_code,status,mode,current_round,settings,buzzer_open,buzzer_winner_player_id,buzzer_opened_at,buzzer_pressed_at,buzzer_allowed_player_ids&limit=1`, { headers: headers(), cache: "no-store" });
  if (!gameResponse.ok) throw new Error(`No se pudo buscar la partida (${gameResponse.status})`);
  const games = (await gameResponse.json()) as RemoteGame[];
  const game = games[0];
  if (!game) return null;
  const playersResponse = await fetch(`${SUPABASE_URL}/rest/v1/game_players?game_id=eq.${game.id}&select=id,game_id,display_name,team_number,is_captain,is_presenter,device_active,sort_order,duel_order&order=team_number.asc,sort_order.asc`, { headers: headers(), cache: "no-store" });
  if (!playersResponse.ok) throw new Error(`No se pudieron cargar los jugadores (${playersResponse.status})`);
  return { game, players: (await playersResponse.json()) as RemoteGamePlayer[] };
}

export async function claimRemotePlayer(code: string, playerId: string, deviceToken: string): Promise<ClaimedPlayer> {
  assertConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_game_player`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_player_id: playerId, p_device_token: deviceToken }) });
  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("player_already_claimed")) throw new Error("Ese jugador ya está conectado desde otro dispositivo");
    throw new Error("No se pudo vincular este dispositivo con el jugador");
  }
  const player = ((await response.json()) as ClaimedPlayer[])[0];
  if (!player) throw new Error("No se pudo identificar al jugador");
  return player;
}

export async function submitRemoteDuelOrder(code: string, captainPlayerId: string, deviceToken: string, playerIds: string[]) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_duel_order`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_captain_player_id: captainPlayerId, p_device_token: deviceToken, p_ordered_player_ids: playerIds }) });
  if (!response.ok) throw new Error("No se pudo guardar el orden del equipo");
}

export async function openDuelBuzzer(code: string, hostToken: string, playerIds: string[]) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_duel_buzzer`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_host_token: hostToken, p_player_ids: playerIds }) });
  if (!response.ok) throw new Error("No se pudo abrir el duelo");
}

export async function openRemoteBuzzer(code: string, hostToken: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_game_buzzer`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_host_token: hostToken }) });
  if (!response.ok) throw new Error("No se pudo abrir el pulsador");
}

export async function closeRemoteBuzzer(code: string, hostToken: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/close_game_buzzer`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_host_token: hostToken }) });
  if (!response.ok) throw new Error("No se pudo cerrar el pulsador");
}

export async function pressRemoteBuzzer(code: string, playerId: string, deviceToken: string): Promise<BuzzerPressResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/press_game_buzzer`, { method: "POST", headers: headers(), body: JSON.stringify({ p_join_code: code.trim().toUpperCase(), p_player_id: playerId, p_device_token: deviceToken }) });
  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("player_not_allowed")) throw new Error("No estás jugando este duelo");
    throw new Error("No se pudo registrar el pulsador");
  }
  const rows = (await response.json()) as BuzzerPressResult[];
  return rows[0] ?? { won: false, winner_player_id: null, winner_name: null, winner_team_number: null, pressed_at: null };
}
