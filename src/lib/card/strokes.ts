import { getStroke } from "perfect-freehand";
import type { Box } from "./layout";
import { STROKE_SIZE } from "./layout";
import { COORD_MAX, PRESSURE_MAX, type Stroke } from "./schema";

const round = (n: number) => Math.round(n * 100) / 100;

/** Stroke to an SVG path in page points. Used for the pad, the preview and the PDF alike. */
export function strokeToPath(stroke: Stroke, box: Box, scale = 1): string {
  const input: [number, number, number][] = [];
  for (let i = 0; i < stroke.pts.length; i += 3) {
    input.push([
      box.x + (stroke.pts[i] / COORD_MAX) * box.w,
      box.y + (stroke.pts[i + 1] / COORD_MAX) * box.h,
      stroke.pts[i + 2] / PRESSURE_MAX,
    ]);
  }
  const outline = getStroke(input, {
    size: STROKE_SIZE * scale,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.35,
    simulatePressure: stroke.sim,
    last: true,
  });
  if (outline.length < 2) return "";

  const [first] = outline;
  let d = `M${round(first[0])} ${round(first[1])}Q`;
  for (let i = 0; i < outline.length; i += 1) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${round(x0)} ${round(y0)} ${round((x0 + x1) / 2)} ${round((y0 + y1) / 2)} `;
  }
  return `${d.trimEnd()}Z`;
}

type Point = { x: number; y: number };

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/**
 * Whether the eraser's path, in stroke coordinates, comes within radius points of the stroke.
 * Both are treated as polylines: a fast drag moves far between events, and a stroke's own
 * points can be far apart too, so testing only sampled points misses real contact.
 */
export function eraserHits(stroke: Stroke, box: Box, path: Point[], radius: number): boolean {
  const toPage = (x: number, y: number): Point => ({ x: (x / COORD_MAX) * box.w, y: (y / COORD_MAX) * box.h });
  const eraser = path.map((p) => toPage(p.x, p.y));
  const line: Point[] = [];
  for (let i = 0; i < stroke.pts.length; i += 3) line.push(toPage(stroke.pts[i], stroke.pts[i + 1]));
  for (let e = 0; e < eraser.length; e += 1) {
    const e0 = eraser[e];
    const e1 = eraser[Math.min(e + 1, eraser.length - 1)];
    for (let s = 0; s < line.length; s += 1) {
      const s0 = line[s];
      const s1 = line[Math.min(s + 1, line.length - 1)];
      if (
        crosses(e0, e1, s0, s1) ||
        pointToSegment(e0, s0, s1) <= radius ||
        pointToSegment(e1, s0, s1) <= radius ||
        pointToSegment(s0, e0, e1) <= radius ||
        pointToSegment(s1, e0, e1) <= radius
      ) {
        return true;
      }
    }
  }
  return false;
}
