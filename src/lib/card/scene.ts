import { formatDate, formatNumber, resolveStopLoss } from "./calc";
import { parseImageDataUrl } from "./image";
import {
  BODY_BASELINE,
  BOXES,
  type Box,
  CELL_PAD,
  COLORS,
  GRID_STEP,
  MIN_VALUE_SIZE,
  PAGE,
  TYPE,
  maxLines,
} from "./layout";
import type { Card } from "./schema";
import { strokeToPath } from "./strokes";
import { measure, normalizeText, wrapText } from "./text";

// A card becomes a flat list of primitives in page points. The HTML preview and the PDF
// only draw this list, which is what makes them the same picture.
export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; rx?: number; dash?: string; opacity?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dash?: string }
  | { t: "text"; x: number; y: number; size: number; fill: string; value: string }
  | { t: "path"; d: string; fill: string; opacity?: number }
  | { t: "image"; x: number; y: number; w: number; h: number; href: string };

const FOOTER = "스노트 - 매매 기록 도구이며 투자 권유가 아닙니다.";

function fitSize(text: string, size: number, width: number): number {
  const w = measure(text, size);
  if (w <= width) return size;
  return Math.max(MIN_VALUE_SIZE, Math.floor((size * width * 10) / w) / 10);
}

function marker(x: number, y: number, w: number, h: number): Prim {
  // A slightly uneven highlighter band.
  const d = `M${x} ${y + 2}L${x + w} ${y}L${x + w + 2} ${y + h - 2}L${x - 1} ${y + h}Z`;
  return { t: "path", d, fill: COLORS.highlight, opacity: 0.85 };
}

function cell(out: Prim[], box: Box, label: string) {
  out.push({ t: "line", x1: box.x, y1: box.y + box.h, x2: box.x + box.w, y2: box.y + box.h, stroke: COLORS.ink, sw: 1 });
  out.push({ t: "text", x: box.x + 2, y: box.y + 14, size: TYPE.label, fill: COLORS.inkSoft, value: label });
}

function value(out: Prim[], box: Box, text: string, suffix = "", align: "left" | "right" = "left") {
  if (!text) return;
  const full = text + suffix;
  const width = box.w - CELL_PAD * 2;
  const size = fitSize(full, TYPE.value, width);
  const x = align === "right" ? box.x + box.w - CELL_PAD - measure(full, size) : box.x + CELL_PAD;
  out.push({ t: "text", x, y: box.y + box.h - 9, size, fill: COLORS.ink, value: full });
}

/** react-pdf collapses runs of spaces and drops leading ones, so the scene does it for both. */
const collapse = (text: string) => text.replace(/ +/g, " ").replace(/^ | $/gm, "");

function writing(out: Prim[], box: Box, field: Card["reason"]) {
  for (let i = 1; i <= maxLines(box); i += 1) {
    const y = box.y + i * TYPE.bodyLeading - 1;
    out.push({ t: "line", x1: box.x, y1: y, x2: box.x + box.w, y2: y, stroke: COLORS.rule, sw: 0.6, dash: "2 3" });
  }
  if (field.mode === "draw") {
    for (const stroke of field.strokes) {
      const d = strokeToPath(stroke, box);
      if (d) out.push({ t: "path", d, fill: COLORS.ink });
    }
    return;
  }
  wrapText(collapse(normalizeText(field.text)), TYPE.body, box.w).forEach((line, i) => {
    if (line) out.push({ t: "text", x: box.x, y: box.y + i * TYPE.bodyLeading + BODY_BASELINE, size: TYPE.body, fill: COLORS.ink, value: line });
  });
}

export function buildScene(card: Card): Prim[] {
  const out: Prim[] = [{ t: "rect", x: 0, y: 0, w: PAGE.w, h: PAGE.h, fill: COLORS.paper }];

  for (let x = GRID_STEP; x < PAGE.w; x += GRID_STEP) {
    out.push({ t: "line", x1: x, y1: 0, x2: x, y2: PAGE.h, stroke: COLORS.grid, sw: 0.4 });
  }
  for (let y = GRID_STEP; y < PAGE.h; y += GRID_STEP) {
    out.push({ t: "line", x1: 0, y1: y, x2: PAGE.w, y2: y, stroke: COLORS.grid, sw: 0.4 });
  }

  out.push(marker(26, 40, 126, 20));
  out.push({ t: "text", x: 30, y: 58, size: TYPE.title, fill: COLORS.ink, value: "매매일지" });
  const brand = "스노트";
  out.push({ t: "text", x: 814 - measure(brand, TYPE.brand), y: 58, size: TYPE.brand, fill: COLORS.inkSoft, value: brand });

  cell(out, BOXES.date, "날짜");
  value(out, BOXES.date, formatDate(card.date));
  cell(out, BOXES.ticker, "종목");
  value(out, BOXES.ticker, collapse(normalizeText(card.ticker).replace(/\n/g, " ")));

  const side = BOXES.side;
  cell(out, side, "매수 / 매도");
  const half = side.w / 2;
  const options = [
    { key: "buy", text: "매수", x: side.x },
    { key: "sell", text: "매도", x: side.x + half },
  ] as const;
  for (const option of options) {
    const w = measure(option.text, TYPE.value);
    const tx = option.x + (half - w) / 2;
    if (card.side === option.key) out.push(marker(tx - 8, side.y + 22, w + 16, 22));
    out.push({
      t: "text",
      x: tx,
      y: side.y + side.h - 9,
      size: TYPE.value,
      fill: card.side === option.key ? COLORS.ink : COLORS.rule,
      value: option.text,
    });
  }

  cell(out, BOXES.quantity, "수량");
  value(out, BOXES.quantity, formatNumber(card.quantity), "주", "right");
  cell(out, BOXES.price, "1주당 가격");
  value(out, BOXES.price, formatNumber(card.price), "원", "right");
  cell(out, BOXES.total, "총 거래금액");
  value(out, BOXES.total, formatNumber(card.total), "원", "right");
  cell(out, BOXES.stopLoss, "손절매 금액(예정)");
  value(out, BOXES.stopLoss, resolveStopLoss(card).text, "", "right");

  const frame = BOXES.reasonFrame;
  out.push({ t: "rect", ...frame, stroke: COLORS.ink, sw: 1, rx: 4 });
  out.push({ t: "text", x: frame.x + 12, y: frame.y + 19, size: TYPE.label + 1, fill: COLORS.ink, value: "매수/매도 이유" });
  writing(out, BOXES.reasonWriting, card.reason);

  const slot = BOXES.imageSlot;
  out.push({ t: "rect", ...slot, fill: COLORS.slot, stroke: COLORS.rule, sw: 0.8, dash: "4 3", rx: 3 });
  const image = card.image ? parseImageDataUrl(card.image) : null;
  if (card.image && image) {
    const scale = Math.min((slot.w - 8) / image.width, (slot.h - 8) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    out.push({ t: "image", x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2, w, h, href: card.image });
  }

  const memo = BOXES.memoFrame;
  out.push({ t: "rect", ...memo, stroke: COLORS.ink, sw: 1, rx: 4 });
  out.push({ t: "text", x: memo.x + 12, y: memo.y + 19, size: TYPE.label + 1, fill: COLORS.ink, value: "메모" });
  out.push({ t: "text", x: memo.x + 44, y: memo.y + 19, size: TYPE.label - 1, fill: COLORS.inkSoft, value: "예상과 달랐던 이유 등" });
  writing(out, BOXES.memoWriting, card.memo);

  out.push({ t: "text", x: 28, y: 574, size: TYPE.footer, fill: COLORS.inkSoft, value: FOOTER });
  return out;
}
