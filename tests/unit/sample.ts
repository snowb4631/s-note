import { randomBytes } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { computeTotal } from "@/lib/card/calc";
import { MAX_AMOUNT, MAX_PRICE, MAX_QUANTITY } from "@/lib/card/calc";
import { BOXES, TYPE, maxLines } from "@/lib/card/layout";
import { MAX_POINTS_PER_FIELD, MAX_STROKES, type Card, type Stroke, cardSchema, emptyCard } from "@/lib/card/schema";
import { wrapText } from "@/lib/card/text";
import { MAX_IMAGE_BYTES } from "@/lib/card/image";

export function chartJpeg(): string {
  const canvas = createCanvas(640, 400);
  const c = canvas.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 640, 400);
  c.strokeStyle = "#c33";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(20, 340);
  [[120, 280], [220, 300], [320, 180], [420, 210], [520, 90], [620, 60]].forEach(([x, y]) => c.lineTo(x, y));
  c.stroke();
  c.fillStyle = "#123";
  c.fillRect(40, 30, 200, 26);
  return `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", 85).toString("base64")}`;
}

/** Wavy line of `points` points inside the box, in normalised stroke units. */
export function wave(row: number, rows: number, points: number, sim = true): Stroke {
  const pts: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const x = Math.round(300 + (9400 * i) / Math.max(points - 1, 1));
    const y = Math.round(((row + 0.5) / rows) * 10000 + Math.sin(i / 3) * (3000 / rows));
    pts.push(x, Math.min(10000, Math.max(0, y)), 50 + (i % 40));
  }
  return { sim, pts };
}

export function typicalCard(): Card {
  return cardSchema.parse({
    ...emptyCard("2026-10-30"),
    ticker: "예시전자 우선주",
    side: "buy",
    quantity: 120,
    price: 72300,
    total: computeTotal(120, 72300),
    stopLoss: 68685,
    reason: {
      mode: "text",
      text:
        "실적 발표 뒤 거래량이 늘면서 전고점을 넘어섰다. 계획한 분할 매수의 첫 번째 물량이다.\n" +
        "띄어쓰기없이아주길게이어지는한글문장도칸안에서자연스럽게줄이바뀌어야하고글자가잘리거나하이픈이붙으면안된다는것을확인한다.\n" +
        "손절 기준은 직전 저점 아래로 잡았다.",
      strokes: [],
    },
    memo: {
      mode: "draw",
      text: "",
      strokes: [wave(0, 3, 60), wave(1, 3, 60, false), wave(2, 3, 40)],
    },
    image: chartJpeg(),
  });
}

function fullText(box: typeof BOXES.reasonWriting | typeof BOXES.memoWriting): string {
  // Widest glyph in the font, as many as the validator will accept.
  let text = "";
  while (wrapText(text + "빠", TYPE.body, box.w).length <= maxLines(box)) text += "빠";
  return text;
}

/** ~1MB of incompressible but decodable image. */
export function maxImage(): string {
  const canvas = createCanvas(1400, 1000);
  const c = canvas.getContext("2d");
  const data = c.createImageData(1400, 1000);
  data.data.set(randomBytes(data.data.length));
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = 255;
  c.putImageData(data, 0, 0);
  for (let q = 90; q > 5; q -= 3) {
    const jpg = canvas.toBuffer("image/jpeg", q);
    if (jpg.length <= MAX_IMAGE_BYTES) return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  }
  throw new Error("could not produce image");
}

const allStrokes = (): Stroke[] => {
  const each = Math.floor(MAX_POINTS_PER_FIELD / MAX_STROKES);
  return Array.from({ length: MAX_STROKES }, (_, i) => wave(i % 20, 20, each));
};

export function worstRaw(mode: "text" | "draw"): unknown {
  return {
    date: "2026-12-28",
    ticker: "빠".repeat(29),
    side: "sell",
    quantity: MAX_QUANTITY,
    price: MAX_PRICE,
    total: MAX_AMOUNT,
    totalManual: true,
    stopLoss: MAX_AMOUNT,
    stopLossMode: "won",
    stopLossPct: null,
    // Text and strokes are both sent in full: that is the largest body the schema allows.
    reason: { mode, text: fullText(BOXES.reasonWriting), strokes: allStrokes() },
    memo: { mode, text: fullText(BOXES.memoWriting), strokes: allStrokes() },
    image: maxImage(),
  };
}
