import path from "node:path";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { isSupported, measure } from "@/lib/card/text";

const font = fontkit.openSync(path.resolve("src/fonts/NanumPenScript-Regular.ttf")) as unknown as {
  hasGlyphForCodePoint(cp: number): boolean;
  glyphForCodePoint(cp: number): { advanceWidth: number; id: number };
  availableFeatures: string[];
  unitsPerEm: number;
};

function ksx1001Hangul(): string[] {
  const decoder = new TextDecoder("euc-kr");
  const out: string[] = [];
  for (let lead = 0xb0; lead <= 0xc8; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      out.push(decoder.decode(new Uint8Array([lead, trail])));
    }
  }
  return out;
}

describe("Nanum Pen Script", () => {
  const hangul = ksx1001Hangul();

  it("the KS X 1001 list really is 2,350 distinct syllables", () => {
    expect(hangul).toHaveLength(2350);
    expect(new Set(hangul).size).toBe(2350);
    expect(hangul.every((c) => c >= "가" && c <= "힣")).toBe(true);
  });

  it("has a non-empty glyph for all 2,350", () => {
    const missing = hangul.filter((c) => {
      const cp = c.codePointAt(0)!;
      return !font.hasGlyphForCodePoint(cp) || font.glyphForCodePoint(cp).id === 0;
    });
    expect(missing).toEqual([]);
  });

  it("has the digits and punctuation the card prints", () => {
    const missing = [..."0123456789,.:()/-?원주"].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!));
    expect(missing).toEqual([]);
  });

  it("the generated width table matches the font", () => {
    for (const c of ["가", "힣", "A", "1", " "]) {
      expect(measure(c, 1000)).toBeCloseTo(font.glyphForCodePoint(c.codePointAt(0)!).advanceWidth, 5);
      expect(isSupported(c)).toBe(true);
    }
    expect(font.unitsPerEm).toBe(1000);
  });

  it("has no kerning or ligatures that would change widths", () => {
    expect(font.availableFeatures).not.toContain("kern");
    expect(font.availableFeatures).not.toContain("liga");
  });
});
