import type { Card } from "./card/schema";

// Hands the card to /send in memory, so a failed save costs nothing. A full page load empties
// it, and /send then falls back to the saved draft.
export type PendingSend = { card: Card; saveFailed: boolean };

let pending: PendingSend | null = null;

export const getPendingSend = () => pending;
export function setPendingSend(value: PendingSend | null): void {
  pending = value;
}
