import { Wildcard } from "./types";

export type WildcardContext = "my_turn" | "rival_turn" | "free";

export function isAvailable(wc: Wildcard, context: WildcardContext, disabledIds?: string[]): boolean {
  if (wc.used) return false;
  if (disabledIds?.includes(wc.id)) return false;
  if (context === "free") return true;
  if (wc.type === "universal") return true;
  if (wc.type === "defensa") return context === "my_turn";
  if (wc.type === "ataque") return context === "rival_turn";
  return false;
}

export function blockedReason(wc: Wildcard, context: WildcardContext, disabledIds?: string[]): string | null {
  if (wc.used) return null;
  if (disabledIds?.includes(wc.id)) return "No disponible\nen esta ronda";
  if (context === "free") return null;
  if (wc.type === "universal") return null;
  if (wc.type === "defensa" && context === "rival_turn") return "Solo en tu turno";
  if (wc.type === "ataque" && context === "my_turn") return "Solo en turno rival";
  return null;
}

export function availableCount(wildcards: Wildcard[], context: WildcardContext, disabledIds?: string[]): number {
  return wildcards.filter((wc) => isAvailable(wc, context, disabledIds)).length;
}
