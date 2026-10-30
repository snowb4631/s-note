import { describe, expect, it } from "vitest";
import { hasUnsupported, measure, normalizeText, wrapText } from "@/lib/card/text";

describe("normalizeText", () => {
  it("composes decomposed Hangul", () => expect(normalizeText("한")).toBe("한"));
  it("normalises newlines and strips controls and bidi overrides", () => {
    expect(normalizeText("a\r\nb\u0007‮c\td")).toBe("a\nbc d");
  });
  it("replaces characters the font lacks", () => expect(normalizeText("가😀나")).toBe("가?나"));
});

describe("characters the font lacks but has a near match for", () => {
  it.each([
    ["가\u00A0나", "가 나"],
    ["가\u3000나", "가 나"],
    ["가·나", "가ㆍ나"],
    ["끝…", "끝..."],
    ["1–2—3", "1-2-3"],
    ["가→나", "가->나"],
    ["▲3 ▼2", "+3 -2"],
  ])("%s", (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
    expect(hasUnsupported(input)).toBe(false);
  });
});

describe("wrapText", () => {
  const width = 200;
  it("breaks long unspaced Korean between characters and loses nothing", () => {
    const text = "가나다라마바사아자차카타파하".repeat(5);
    const lines = wrapText(text, 17, width);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
    for (const l of lines) expect(measure(l, 17)).toBeLessThanOrEqual(width);
  });
  it("prefers spaces", () => {
    const lines = wrapText("손절 기준을 먼저 적고 나서 들어간다 그리고 지킨다", 17, 120);
    expect(lines.join(" ")).toBe("손절 기준을 먼저 적고 나서 들어간다 그리고 지킨다");
    for (const l of lines) expect(measure(l, 17)).toBeLessThanOrEqual(120);
  });
  it("keeps explicit and empty lines", () => expect(wrapText("가\n\n나", 17, 100)).toEqual(["가", "", "나"]));
  it("terminates on a width smaller than a glyph", () => expect(wrapText("가나", 17, 1)).toEqual(["가", "나"]));
});
