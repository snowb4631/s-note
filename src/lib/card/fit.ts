import { CELL_VALUE_WIDTH, BOXES, MIN_VALUE_SIZE, TYPE, type Box, maxLines } from "./layout";
import { MAX_BODY_CHARS, MAX_TICKER_CHARS } from "./schema";
import { measure, normalizeText, wrapText } from "./text";

const fitsBody = (text: string, box: Box) => {
  const normal = normalizeText(text);
  return Array.from(normal).length <= MAX_BODY_CHARS && wrapText(normal, TYPE.body, box.w).length <= maxLines(box);
};

/** Trims the tail until the text fits the writing box; used for typing and paste. */
export function fitBody(text: string, box: Box): { text: string; trimmed: boolean } {
  if (fitsBody(text, box)) return { text, trimmed: false };
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fitsBody(chars.slice(0, mid).join(""), box)) lo = mid;
    else hi = mid - 1;
  }
  return { text: chars.slice(0, lo).join(""), trimmed: true };
}

export function fitTicker(text: string): string {
  const chars = Array.from(text.replace(/[\r\n]+/g, " ")).slice(0, MAX_TICKER_CHARS);
  while (chars.length > 0 && measure(normalizeText(chars.join("")), MIN_VALUE_SIZE) > CELL_VALUE_WIDTH(BOXES.ticker)) chars.pop();
  return chars.join("");
}
