import { describe, expect, it } from "vitest";
import { eraserHits } from "@/lib/card/strokes";

const box = { x: 0, y: 0, w: 100, h: 100 }; // so 100 coordinate units = 1 point
const R = 7;
// A long straight stroke with only two points, across the middle.
const stroke = { sim: true, pts: [0, 5000, 50, 10000, 5000, 50] };

describe("eraserHits", () => {
  it("hits between a stroke's points, not only at them", () => {
    expect(eraserHits(stroke, box, [{ x: 5000, y: 5300 }], R)).toBe(true);
  });
  it("a fast drag that jumps across the stroke hits", () => {
    expect(eraserHits(stroke, box, [{ x: 5000, y: 1000 }, { x: 5000, y: 9000 }], R)).toBe(true);
  });
  it("a drag crossing at an angle, far from every sample, hits", () => {
    expect(eraserHits(stroke, box, [{ x: 2000, y: 0 }, { x: 8000, y: 10000 }], R)).toBe(true);
  });
  it("missing by more than the radius does not hit", () => {
    expect(eraserHits(stroke, box, [{ x: 5000, y: 5800 }], R)).toBe(false);
    expect(eraserHits(stroke, box, [{ x: 0, y: 6000 }, { x: 10000, y: 6000 }], R)).toBe(false);
  });
  it("uses page points on non-square boxes", () => {
    const wide = { x: 0, y: 0, w: 1000, h: 100 };
    const dot = { sim: true, pts: [5000, 5000, 50] };
    expect(eraserHits(dot, wide, [{ x: 5100, y: 5000 }], R)).toBe(false); // 10pt away in x
    expect(eraserHits(dot, wide, [{ x: 5000, y: 5500 }], R)).toBe(true); // 5pt away in y
  });
  it("handles a single-point stroke", () => {
    expect(eraserHits({ sim: true, pts: [100, 100, 50] }, box, [{ x: 100, y: 100 }], R)).toBe(true);
  });
});
