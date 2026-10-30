import { z } from "zod";
import { MAX_AMOUNT, MAX_PRICE, MAX_QUANTITY, MAX_STOP_LOSS_PCT, reconcileTotal, resolveStopLoss } from "./calc";
import { parseImageDataUrl } from "./image";
import { BOXES, CELL_VALUE_WIDTH, MIN_VALUE_SIZE, TYPE, maxLines } from "./layout";
import { measure, normalizeText, wrapText } from "./text";

export const MAX_TICKER_CHARS = 40;
export const MAX_BODY_CHARS = 600;
export const MAX_STROKES = 200;
export const MAX_POINTS_PER_STROKE = 1000;
export const MAX_POINTS_PER_FIELD = 10_000;
export const COORD_MAX = 10_000;
export const PRESSURE_MAX = 100;
/** Requests above this are refused before parsing; Vercel's own limit is 4.5MB. */
export const MAX_BODY_BYTES = 4_000_000;

export const strokeSchema = z
  .object({
    /** true when the device reports no pressure and perfect-freehand should simulate it. */
    sim: z.boolean(),
    /** Flat x,y,pressure triples: x,y in 0..10000 of the writing box, pressure in 0..100. */
    pts: z
      .array(z.number().int().min(0).max(COORD_MAX))
      .min(3)
      .max(MAX_POINTS_PER_STROKE * 3),
  })
  .strict()
  .refine((s) => s.pts.length % 3 === 0, "좌표 형식이 올바르지 않습니다.")
  .refine((s) => s.pts.every((v, i) => i % 3 !== 2 || v <= PRESSURE_MAX), "필압 값이 올바르지 않습니다.");

export type Stroke = z.infer<typeof strokeSchema>;

const strokes = z
  .array(strokeSchema)
  .max(MAX_STROKES)
  .refine(
    (list) => list.reduce((sum, s) => sum + s.pts.length / 3, 0) <= MAX_POINTS_PER_FIELD,
    "필기가 너무 많습니다.",
  );

const writingParts = {
  mode: z.enum(["text", "draw"]),
  text: z.string().max(MAX_BODY_CHARS * 2).transform(normalizeText),
  strokes,
};

function writingField(box: (typeof BOXES)["reasonWriting" | "memoWriting"]) {
  return z
    .object(writingParts)
    .strict()
    .superRefine((field, ctx) => {
      if (Array.from(field.text).length > MAX_BODY_CHARS) {
        ctx.addIssue({ code: "custom", path: ["text"], message: "글자 수가 너무 많습니다." });
      } else if (wrapText(field.text, TYPE.body, box.w).length > maxLines(box)) {
        ctx.addIssue({ code: "custom", path: ["text"], message: "칸을 넘칠 만큼 내용이 깁니다." });
      }
    });
}

const money = (max: number) => z.number().int().min(0).max(max).nullable();

export const MIN_DATE = "1990-01-01";
export const MAX_DATE = "2099-12-31";
export const DATE_MESSAGE = `날짜는 ${MIN_DATE}부터 ${MAX_DATE}까지만 입력할 수 있어요.`;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, DATE_MESSAGE)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= MIN_DATE && v <= MAX_DATE;
  }, DATE_MESSAGE);

export const isValidDate = (v: string) => isoDate.safeParse(v).success;

const stopLossPct = z
  .number()
  .min(0)
  .max(MAX_STOP_LOSS_PCT)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "손절매 비율은 소수 둘째 자리까지 입력할 수 있어요.")
  .nullable();

const cardFields = z
  .object({
    date: isoDate,
    ticker: z
      .string()
      .max(MAX_TICKER_CHARS * 2)
      .transform((v) => normalizeText(v).replace(/\n/g, " "))
      .refine((v) => Array.from(v).length <= MAX_TICKER_CHARS, "종목 이름이 너무 깁니다.")
      .refine(
        (v) => measure(v, MIN_VALUE_SIZE) <= CELL_VALUE_WIDTH(BOXES.ticker),
        "종목 이름이 칸을 넘칩니다.",
      ),
    side: z.enum(["buy", "sell"]).nullable(),
    quantity: money(MAX_QUANTITY),
    price: money(MAX_PRICE),
    total: money(MAX_AMOUNT),
    totalManual: z.boolean(),
    stopLoss: money(MAX_AMOUNT),
    // Defaults let drafts saved before the percent option still load.
    stopLossMode: z.enum(["won", "pct"]).default("won"),
    stopLossPct: stopLossPct.default(null),
    reason: writingField(BOXES.reasonWriting),
    memo: writingField(BOXES.memoWriting),
    image: z
      .string()
      .nullable()
      // Only the validated data URL form survives; http(s) URLs fail here.
      .refine((v) => v === null || parseImageDataUrl(v) !== null, "JPEG 이미지(1MB 이하)만 첨부할 수 있습니다."),
  })
  .strict();

/** Derived values are recomputed, so whatever a client sends cannot make them disagree in the PDF. */
export const cardSchema = cardFields.transform((raw) => {
  const card = reconcileTotal(raw);
  return card.stopLossMode === "pct"
    ? { ...card, stopLoss: resolveStopLoss(card).amount }
    : { ...card, stopLossPct: null };
});

export type Card = z.infer<typeof cardSchema>;

/** Nothing a recipient could use. The date alone does not count: it is pre-filled. */
export function isBlankCard(card: Card): boolean {
  const empty = (f: Card["reason"]) => f.text.trim() === "" && f.strokes.length === 0;
  return (
    card.ticker.trim() === "" &&
    card.side === null &&
    card.quantity === null &&
    card.price === null &&
    card.total === null &&
    resolveStopLoss(card).text === "" &&
    empty(card.reason) &&
    empty(card.memo) &&
    card.image === null
  );
}

/**
 * Keeps every field of a stored draft that is still valid and resets the others, so one bad
 * value does not cost the whole card. null when nothing in it is usable.
 */
export function salvageCard(raw: unknown, today: string): { card: Card; repaired: boolean } | null {
  const whole = cardSchema.safeParse(raw);
  if (whole.success) return { card: whole.data, repaired: false };
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const base = emptyCard(today);
  const kept: Record<string, unknown> = {};
  let usable = 0;
  for (const [key, schema] of Object.entries(cardFields.shape)) {
    if (!(key in source)) continue;
    const field = schema.safeParse(source[key]);
    if (field.success) {
      kept[key] = source[key];
      usable += 1;
    } else if (key === "reason" || key === "memo") {
      const parts = source[key];
      const fallback = base[key] as Record<string, unknown>;
      const merged = { ...fallback };
      if (typeof parts === "object" && parts !== null) {
        for (const [part, partSchema] of Object.entries(writingParts)) {
          const value = (parts as Record<string, unknown>)[part];
          if (partSchema.safeParse(value).success) {
            merged[part] = value;
            usable += 1;
          }
        }
      }
      // Text can pass alone and still overflow the box.
      if (schema.safeParse(merged).success) kept[key] = merged;
    }
  }
  if (usable === 0) return null;
  const merged = cardSchema.safeParse({ ...base, ...kept });
  return { card: merged.success ? merged.data : base, repaired: true };
}

// No whitespace, quotes, commas, angle brackets or control characters: nothing that could
// add a header or a second recipient. Deliberately stricter than RFC 5322.
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;

export const emailSchema = z
  .string()
  .max(254)
  .refine((v) => EMAIL_RE.test(v) && !v.includes(".."), "이메일 주소를 확인해 주세요.");

export const sendSchema = z
  .object({
    card: cardSchema,
    email: emailSchema,
    turnstileToken: z.string().max(4096),
  })
  .strict();

export function emptyCard(date: string): Card {
  return {
    date,
    ticker: "",
    side: null,
    quantity: null,
    price: null,
    total: null,
    totalManual: false,
    stopLoss: null,
    stopLossMode: "won",
    stopLossPct: null,
    reason: { mode: "text", text: "", strokes: [] },
    memo: { mode: "text", text: "", strokes: [] },
    image: null,
  };
}
