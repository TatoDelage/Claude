import { Team, Wildcard } from "./types";

export type WildcardContext = "my_turn" | "rival_turn" | "free";

export function teamWildcardLocked(team: Team, currentRound: number): boolean {
  return currentRound > 0 && team.lastWildcardRound === currentRound;
}

export function isAvailable(
  wc: Wildcard,
  context: WildcardContext,
  disabledIds?: string[],
  roundLocked = false,
  onlyIds?: string[]
): boolean {
  if (wc.used) return false;
  if (onlyIds && !onlyIds.includes(wc.id)) return false;
  if (disabledIds?.includes(wc.id)) return false;
  if (roundLocked && wc.id !== "supercomodin") return false;
  if (context === "free") return true;
  if (wc.type === "universal") return true;
  if (wc.type === "defensa") return context === "my_turn";
  if (wc.type === "ataque") return context === "rival_turn";
  return false;
}

export function blockedReason(
  wc: Wildcard,
  context: WildcardContext,
  disabledIds?: string[],
  roundLocked = false,
  onlyIds?: string[]
): string | null {
  if (wc.used) return "Gastado";
  if (onlyIds && !onlyIds.includes(wc.id)) return "No disponible aquí";
  if (disabledIds?.includes(wc.id)) return "No disponible en esta ronda";
  if (roundLocked && wc.id !== "supercomodin") return "Ya usaste 1 comodín esta ronda";
  if (context === "free") return null;
  if (wc.type === "universal") return null;
  if (wc.type === "defensa" && context === "rival_turn") return "Solo en tu turno";
  if (wc.type === "ataque" && context === "my_turn") return "Solo en turno rival";
  return null;
}

export function availableCount(
  wildcards: Wildcard[],
  context: WildcardContext,
  disabledIds?: string[],
  roundLocked = false,
  onlyIds?: string[]
): number {
  return wildcards.filter((wc) => isAvailable(wc, context, disabledIds, roundLocked, onlyIds)).length;
}
