// Single source of geometry for the editor, the HTML preview and the PDF. Unit: PDF points.
export const PAGE = { w: 841.89, h: 595.28 } as const;

export const COLORS = {
  paper: "#FBF7E9",
  grid: "#DDE3D6",
  ink: "#1E2A4A",
  inkSoft: "#5A6480",
  rule: "#C9CFBF",
  highlight: "#FFE14D",
  slot: "#F3EEDC",
} as const;

export const GRID_STEP = 14.173; // 5mm

export type Box = { x: number; y: number; w: number; h: number };

export const CELL_H = 50;

export const BOXES = {
  date: { x: 28, y: 72, w: 190, h: CELL_H },
  ticker: { x: 226, y: 72, w: 400, h: CELL_H },
  side: { x: 634, y: 72, w: 180, h: CELL_H },
  quantity: { x: 28, y: 128, w: 190, h: CELL_H },
  price: { x: 226, y: 128, w: 190, h: CELL_H },
  total: { x: 424, y: 128, w: 195, h: CELL_H },
  stopLoss: { x: 627, y: 128, w: 187, h: CELL_H },
  reasonFrame: { x: 28, y: 186, w: 786, h: 216 },
  reasonWriting: { x: 40, y: 212, w: 500, h: 184 },
  imageSlot: { x: 556, y: 212, w: 246, h: 184 },
  memoFrame: { x: 28, y: 408, w: 786, h: 146 },
  memoWriting: { x: 40, y: 434, w: 762, h: 114 },
} as const satisfies Record<string, Box>;

export const TYPE = {
  title: 38,
  brand: 15,
  label: 14,
  value: 24,
  body: 17,
  bodyLeading: 21,
  footer: 12,
} as const;

/** Cell padding for single-line values. */
export const CELL_PAD = 10;
export const CELL_VALUE_WIDTH = (box: Box) => box.w - CELL_PAD * 2;
/** Distance from the top of a line slot to the text baseline. */
export const BODY_BASELINE = 16;
export const MIN_VALUE_SIZE = 12;

export const STROKE_SIZE = 2.6;

export const maxLines = (box: Box) => Math.floor(box.h / TYPE.bodyLeading);

/** Styles an editor field to sit exactly where the PDF puts it (large screens only). */
export function boxVars(box: Box): Record<string, string> {
  return {
    "--x": `${(box.x / PAGE.w) * 100}%`,
    "--y": `${(box.y / PAGE.h) * 100}%`,
    "--w": `${(box.w / PAGE.w) * 100}%`,
    "--h": `${(box.h / PAGE.h) * 100}%`,
  };
}
