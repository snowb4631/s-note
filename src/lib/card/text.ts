import { RANGES, UNITS_PER_EM, WIDTHS } from "./metrics.generated";

// Line breaking is a pure function of the font's advance table so the browser preview
// and the server PDF always break at the same characters. The font has no kerning.
let table: Map<number, number> | null = null;

function widths(): Map<number, number> {
  if (table) return table;
  const map = new Map<number, number>();
  let i = 0;
  for (const [start, count] of RANGES) {
    for (let cp = start; cp < start + count; cp += 1, i += 2) {
      map.set(cp, parseInt(WIDTHS.slice(i, i + 2), 36));
    }
  }
  table = map;
  return map;
}

export const REPLACEMENT = "?";

export function isSupported(char: string): boolean {
  return char === "\n" || widths().has(char.codePointAt(0)!);
}

// Common characters the font lacks, mapped to the nearest glyph it has.
const MAPPED: Record<string, string> = {
  "\u00A0": " ",
  "\u3000": " ",
  "\u00B7": "\u318D",
  "\u2022": "\u318D",
  "\u30FB": "\u318D",
  "\u2026": "...",
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2212": "-",
  "\u2192": "->",
  "\u2190": "<-",
  "\u25B2": "+", // Korean quotes use these for up and down
  "\u25B3": "+",
  "\u25BC": "-",
  "\u25BD": "-",
  "\u203B": "*",
  "\u300C": "\u2018",
  "\u300D": "\u2019",
  "\u300E": "\u201C",
  "\u300F": "\u201D",
};
const MAPPED_RE = new RegExp(`[${Object.keys(MAPPED).join("")}]`, "g");

/**
 * NFC, LF newlines, tabs to spaces, no control or bidi characters; anything the font
 * lacks becomes "?" so preview and PDF show the same thing instead of a fallback or tofu.
 */
export function normalizeText(input: string): string {
  const cleaned = input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(MAPPED_RE, (c) => MAPPED[c])
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g, "");
  let out = "";
  for (const char of cleaned) out += isSupported(char) ? char : REPLACEMENT;
  return out;
}

export function hasUnsupported(input: string): boolean {
  const count = (text: string) => text.split(REPLACEMENT).length;
  return count(normalizeText(input)) > count(input);
}

function charWidth(char: string, size: number): number {
  return ((widths().get(char.codePointAt(0)!) ?? UNITS_PER_EM) / UNITS_PER_EM) * size;
}

export function measure(text: string, size: number): number {
  let total = 0;
  for (const char of text) total += charWidth(char, size);
  return total;
}

/** Breaks at spaces when possible and between any two characters for long unspaced Korean. */
export function wrapText(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const chars = Array.from(paragraph);
    let start = 0;
    let lastSpace = -1;
    let width = 0;
    let i = 0;
    while (i < chars.length) {
      const w = charWidth(chars[i], size);
      if (chars[i] === " ") {
        // A space may hang past the edge; it is the break itself.
        lastSpace = i;
        width += w;
        i += 1;
        continue;
      }
      if (width + w > maxWidth && i > start) {
        const breakAt = lastSpace >= start ? lastSpace + 1 : i;
        lines.push(chars.slice(start, breakAt).join("").trimEnd());
        start = breakAt;
        lastSpace = -1;
        i = start;
        width = 0;
        continue;
      }
      width += w;
      i += 1;
    }
    lines.push(chars.slice(start).join("").trimEnd());
  }
  return lines;
}
