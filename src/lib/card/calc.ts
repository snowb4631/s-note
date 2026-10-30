export const MAX_QUANTITY = 999_999_999_999;
export const MAX_PRICE = 999_999_999_999;
export const MAX_AMOUNT = 999_999_999_999_999;

/** Quantity × price; null when either is empty or the result is outside the card's range. */
export function computeTotal(quantity: number | null, price: number | null): number | null {
  if (quantity === null || price === null) return null;
  const total = quantity * price;
  return Number.isSafeInteger(total) && total <= MAX_AMOUNT ? total : null;
}

export function exceedsMaxTotal(quantity: number | null, price: number | null): boolean {
  return quantity !== null && price !== null && computeTotal(quantity, price) === null;
}

type TotalState = { quantity: number | null; price: number | null; total: number | null; totalManual: boolean };

/** A manually edited total is never overwritten by recalculation. */
export function reconcileTotal<T extends TotalState>(state: T): T {
  return state.totalManual ? state : { ...state, total: computeTotal(state.quantity, state.price) };
}

/** Typing into the total switches to manual, even to empty. Only resetTotalToAuto reverts; a no-op edit changes nothing. */
export function setManualTotal<T extends TotalState>(state: T, total: number | null): T {
  if (total === state.total) return state;
  return { ...state, total, totalManual: true };
}

export function resetTotalToAuto<T extends TotalState>(state: T): T {
  return reconcileTotal({ ...state, totalManual: false });
}

export function formatNumber(value: number | null): string {
  return value === null ? "" : value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const NOT_AN_INTEGER = /[.\-\u2010-\u2015\u2212\uFF0D\uFF0E]/;

/** Keeps digits only. Decimal points and minus signs are refused rather than stripped into another number. */
export function parseDigits(input: string, max: number): number | null | "over" | "invalid" {
  if (NOT_AN_INTEGER.test(input)) return "invalid";
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return value > max ? "over" : value;
}

export const MAX_STOP_LOSS_PCT = 100;

/** Percent in hundredths, so 12.34 is exact from here on. */
const toHundredths = (pct: number) => Math.round(pct * 100);
const roundedDiv = (a: bigint, b: bigint) => (a * 2n + b) / (b * 2n);

export function formatPercent(pct: number | null): string {
  return pct === null ? "" : String(pct);
}

/** "" is empty, a trailing "." or "%" is fine while typing. Up to 2 decimals, 0..100. */
export function parsePercent(input: string): number | null | "over" | "invalid" {
  const text = input.trim().replace(/%$/, "").trimEnd();
  if (text === "" || text === ".") return null;
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(text)) return "invalid";
  const value = Number(text);
  return value > MAX_STOP_LOSS_PCT ? "over" : value;
}

export type StopLossMode = "won" | "pct";
export type StopLossState = { price: number | null; stopLoss: number | null; stopLossMode: StopLossMode; stopLossPct: number | null };
export type StopLossView = {
  amount: number | null;
  pct: number | null;
  /** Won mode with an amount above the price: the percent is not shown as a number. */
  overPrice: boolean;
  /** % mode with a percent but no price to apply it to. */
  needsPrice: boolean;
  /** What the preview, the PDF and the editor print. */
  text: string;
};

/**
 * The only place that relates the per-share stop price, its percent drop and the base. Editor,
 * preview, PDF and server all go through it. The base is the price per share; 0 counts as no
 * base. Quantity and total play no part. BigInt because price x hundredths passes 2^53 at the
 * card's maximum.
 */
export function resolveStopLoss(state: StopLossState): StopLossView {
  const base = state.price !== null && state.price > 0 ? BigInt(state.price) : null;
  if (state.stopLossMode === "pct") {
    const pct = state.stopLossPct;
    if (pct === null) return { amount: null, pct: null, overPrice: false, needsPrice: false, text: "" };
    if (base === null) return { amount: null, pct, overPrice: false, needsPrice: true, text: `${formatPercent(pct)}%` };
    const amount = Number(roundedDiv(base * BigInt(10_000 - toHundredths(pct)), 10_000n));
    return { amount, pct, overPrice: false, needsPrice: false, text: `${formatNumber(amount)}원 (${formatPercent(pct)}%)` };
  }
  const amount = state.stopLoss;
  if (amount === null) return { amount: null, pct: null, overPrice: false, needsPrice: false, text: "" };
  const won = `${formatNumber(amount)}원`;
  if (base === null) return { amount, pct: null, overPrice: false, needsPrice: false, text: won };
  if (BigInt(amount) > base) return { amount, pct: null, overPrice: true, needsPrice: false, text: `${won} (1주당 가격 초과)` };
  const pct = Number(roundedDiv((base - BigInt(amount)) * 10_000n, base)) / 100;
  return { amount, pct, overPrice: false, needsPrice: false, text: `${won} (${formatPercent(pct)}%)` };
}

/** Switching the unit carries the current value across. */
export function setStopLossMode<T extends StopLossState>(state: T, mode: StopLossMode): T {
  if (mode === state.stopLossMode) return state;
  const view = resolveStopLoss(state);
  return mode === "pct"
    ? { ...state, stopLossMode: mode, stopLossPct: view.pct }
    : { ...state, stopLossMode: mode, stopLoss: view.amount };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/** The user's local date, not UTC. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
