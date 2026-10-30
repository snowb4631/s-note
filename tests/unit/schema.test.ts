import { describe, expect, it } from "vitest";
import { MAX_AMOUNT } from "@/lib/card/calc";
import { MAX_IMAGE_BYTES, parseImageDataUrl } from "@/lib/card/image";
import { BOXES, TYPE, maxLines } from "@/lib/card/layout";
import { MAX_POINTS_PER_FIELD, MAX_POINTS_PER_STROKE, MAX_STROKES, cardSchema, emailSchema, emptyCard, isBlankCard, salvageCard } from "@/lib/card/schema";
import { wrapText } from "@/lib/card/text";
import { jpegDataUrl, pngDataUrl } from "./helpers";

const card = () => emptyCard("2026-10-30");
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

describe("cardSchema", () => {
  it("accepts an empty card", () => expect(cardSchema.safeParse(card()).success).toBe(true));
  it("rejects unknown fields", () => {
    expect(cardSchema.safeParse({ ...card(), pdf: "x" }).success).toBe(false);
  });
  it("rejects impossible dates", () => {
    expect(cardSchema.safeParse({ ...card(), date: "2026-02-30" }).success).toBe(false);
  });
  it("rejects dates outside the range with a Korean message", () => {
    for (const date of ["0002-10-30", "1989-12-31", "2100-01-01", "nonsense"]) {
      const result = cardSchema.safeParse({ ...card(), date });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("날짜는");
    }
    expect(cardSchema.safeParse({ ...card(), date: "1990-01-01" }).success).toBe(true);
  });
  it("rejects non-integer and negative numbers", () => {
    expect(cardSchema.safeParse({ ...card(), price: 1.5 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...card(), quantity: -1 }).success).toBe(false);
  });
  it("normalises text on parse", () => {
    const parsed = cardSchema.parse({ ...card(), ticker: "가\n나\u0007" });
    expect(parsed.ticker).toBe("가 나");
  });
  it("rejects a ticker too wide for its cell", () => {
    // Within the 40-character limit, so only the width check can refuse it.
    const result = cardSchema.safeParse({ ...card(), ticker: "빠".repeat(40) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("종목 이름이 칸을 넘칩니다.");
  });
  it("rejects newline stuffing that would overflow the box", () => {
    const n = maxLines(BOXES.reasonWriting);
    const reason = (text: string) => ({ ...card(), reason: { mode: "text", text, strokes: [] } });
    expect(cardSchema.safeParse(reason("가\n".repeat(n - 1) + "가")).success).toBe(true);
    expect(cardSchema.safeParse(reason("가\n".repeat(n) + "가")).success).toBe(false);
  });
  it("rejects long text that wraps past the box", () => {
    const text = "힣".repeat(599);
    expect(wrapText(text, TYPE.body, BOXES.reasonWriting.w).length).toBeGreaterThan(maxLines(BOXES.reasonWriting));
    expect(cardSchema.safeParse({ ...card(), reason: { mode: "text", text, strokes: [] } }).success).toBe(false);
  });
  it("bounds strokes", () => {
    const stroke = (points: number) => ({ sim: true, pts: Array.from({ length: points * 3 }, () => 50) });
    const memo = (strokes: unknown[]) => ({ ...card(), memo: { mode: "draw", text: "", strokes } });
    expect(cardSchema.safeParse(memo([stroke(MAX_POINTS_PER_STROKE)])).success).toBe(true);
    expect(cardSchema.safeParse(memo([stroke(MAX_POINTS_PER_STROKE + 1)])).success).toBe(false);
    expect(cardSchema.safeParse(memo(Array.from({ length: MAX_STROKES + 1 }, () => stroke(1)))).success).toBe(false);
    expect(cardSchema.safeParse(memo(Array.from({ length: 11 }, () => stroke(MAX_POINTS_PER_FIELD / 10)))).success).toBe(false);
  });
  it("rejects malformed stroke data", () => {
    const memo = (s: unknown) => ({ ...card(), memo: { mode: "draw", text: "", strokes: [s] } });
    expect(cardSchema.safeParse(memo({ sim: true, pts: [1, 2] })).success).toBe(false);
    expect(cardSchema.safeParse(memo({ sim: true, pts: [1, 2, 101] })).success).toBe(false);
    expect(cardSchema.safeParse(memo({ sim: true, pts: [10001, 2, 1] })).success).toBe(false);
  });
});

describe("stop-loss fields", () => {
  it("a draft saved before the percent option still loads", () => {
    const old: Record<string, unknown> = { ...card(), stopLoss: 100 };
    delete old.stopLossMode;
    delete old.stopLossPct;
    expect(cardSchema.parse(old)).toMatchObject({ stopLoss: 100, stopLossMode: "won", stopLossPct: null });
  });
  it("recomputes what a client sends, so amount and percent cannot disagree", () => {
    const lying = { ...card(), quantity: 10, price: 72_300, total: 1, stopLossMode: "pct", stopLossPct: 5, stopLoss: 999 };
    expect(cardSchema.parse(lying)).toMatchObject({ total: 723_000, stopLoss: 68_685, stopLossPct: 5 });
    const won = { ...card(), price: 1_000, stopLoss: 50, stopLossPct: 99 };
    expect(cardSchema.parse(won)).toMatchObject({ stopLoss: 50, stopLossPct: null });
  });
  it("a manual total or a quantity does not change the percent result", () => {
    const pct = { ...card(), price: 1_000, stopLossMode: "pct", stopLossPct: 10 };
    expect(cardSchema.parse({ ...pct, total: 1, totalManual: true }).stopLoss).toBe(900);
    expect(cardSchema.parse({ ...pct, quantity: 999 }).stopLoss).toBe(900);
    expect(cardSchema.parse({ ...card(), total: 1_000, totalManual: true, stopLossMode: "pct", stopLossPct: 10 }).stopLoss).toBeNull();
  });
  it("old drafts: % mode recomputes under the new base, won mode keeps its amount", () => {
    const old = { ...card(), quantity: 10, price: 72_300, total: 723_000, stopLoss: 36_150 };
    expect(cardSchema.parse({ ...old, stopLossMode: "pct", stopLossPct: 5 }).stopLoss).toBe(68_685);
    expect(cardSchema.parse({ ...old, stopLossMode: "won", stopLossPct: null }).stopLoss).toBe(36_150);
    expect(cardSchema.parse({ ...old, stopLoss: MAX_AMOUNT }).stopLoss).toBe(MAX_AMOUNT);
  });
  it.each([-1, 100.01, 1.234])("rejects a percent of %s", (stopLossPct) => {
    expect(cardSchema.safeParse({ ...card(), stopLossMode: "pct", stopLossPct }).success).toBe(false);
  });
});

describe("isBlankCard", () => {
  it("a pre-filled date and a mode switch are still blank", () => {
    expect(isBlankCard(cardSchema.parse({ ...card(), memo: { mode: "draw", text: "", strokes: [] } }))).toBe(true);
  });
  it.each([{ ticker: "가" }, { side: "buy" }, { quantity: 1 }, { stopLoss: 1 }, { reason: { mode: "text", text: "가", strokes: [] } }])("%j is not blank", (patch) => {
    expect(isBlankCard(cardSchema.parse({ ...card(), ...patch }))).toBe(false);
  });
});

describe("salvageCard", () => {
  const today = "2026-10-31";
  it("passes a good draft through", () => {
    expect(salvageCard({ ...card(), ticker: "가" }, today)).toMatchObject({ repaired: false, card: { ticker: "가" } });
  });
  it("keeps the good fields of a damaged draft", () => {
    const result = salvageCard({ ...card(), ticker: "살아남은 종목", date: "0002-01-01", quantity: "many", extra: 1 }, today);
    expect(result).toMatchObject({ repaired: true, card: { ticker: "살아남은 종목", date: today, quantity: null } });
  });
  it("keeps the text when only the strokes are bad", () => {
    const result = salvageCard({ ...card(), reason: { mode: "text", text: "남는 글", strokes: "broken" } }, today);
    expect(result?.card.reason).toEqual({ mode: "text", text: "남는 글", strokes: [] });
  });
  it.each([[null], ["text"], [{ nothing: "usable" }]])("%j is not a draft", (raw) => {
    expect(salvageCard(raw, today)).toBeNull();
  });
});

describe("image validation", () => {
  it("accepts a real JPEG with its dimensions", () => {
    expect(parseImageDataUrl(jpegDataUrl(320, 200))).toMatchObject({ format: "jpg", width: 320, height: 200 });
  });
  it("rejects PNG, which the renderer would decode in full", () => {
    expect(parseImageDataUrl(pngDataUrl(30, 20))).toBeNull();
  });
  it("bounds dimensions to what the browser compressor emits", () => {
    expect(parseImageDataUrl(jpegDataUrl(1600, 1600))).not.toBeNull();
    expect(parseImageDataUrl(jpegDataUrl(1601, 10))).toBeNull();
    expect(parseImageDataUrl(jpegDataUrl(6000, 6000))).toBeNull();
  });
  it.each([
    "https://example.com/a.png",
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/gif;base64,R0lGODlh",
    "data:text/html;base64,PGh0bWw+",
    "data:image/png,rawdata",
    "",
  ])("rejects %s", (url) => {
    expect(parseImageDataUrl(url)).toBeNull();
    expect(cardSchema.safeParse({ ...card(), image: url }).success).toBe(false);
  });
  it("rejects a type that does not match the magic bytes", () => {
    const png = pngDataUrl(4, 4).split(",")[1];
    expect(parseImageDataUrl(`data:image/jpeg;base64,${png}`)).toBeNull();
  });
  it("rejects files over the decoded size limit", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(parseImageDataUrl(`data:image/jpeg;base64,${b64(big)}`)).toBeNull();
  });
  it("rejects huge pixel dimensions and truncated headers", () => {
    expect(parseImageDataUrl(jpegDataUrl(60_000, 60_000))).toBeNull();
    expect(parseImageDataUrl(`data:image/jpeg;base64,${b64(new Uint8Array([0xff, 0xd8, 0xff]))}`)).toBeNull();
  });
});

describe("emailSchema", () => {
  it.each(["me@example.com", "a.b+tag@sub.example.co.kr"])("accepts %s", (v) => {
    expect(emailSchema.safeParse(v).success).toBe(true);
  });
  it.each([
    "a@b.com\r\nBcc: x@y.com",
    "a@b.com\n",
    " a@b.com",
    "a@b.com,c@d.com",
    "a@b.com;c@d.com",
    "Name <a@b.com>",
    '"a b"@c.com',
    "a..b@c.com",
    "a@b",
    "a@-b.com",
    "x".repeat(250) + "@b.com",
    "",
  ])("rejects %j", (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false);
  });
});
