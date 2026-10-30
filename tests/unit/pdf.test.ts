import fs from "node:fs";
import path from "node:path";
import resolveImage from "@react-pdf/image";
import { describe, expect, it } from "vitest";
import { MAX_AMOUNT, MAX_PRICE } from "@/lib/card/calc";
import { parseImageDataUrl } from "@/lib/card/image";
import { BOXES, CELL_VALUE_WIDTH, TYPE, maxLines } from "@/lib/card/layout";
import { buildScene } from "@/lib/card/scene";
import { MAX_BODY_BYTES, cardSchema, emptyCard } from "@/lib/card/schema";
import { measure, wrapText } from "@/lib/card/text";
import { renderCardPdf } from "@/pdf/render";
import { MAX_PDF_BYTES } from "@/server/mail";
import { ARTIFACTS, pdfInfo, pdfToPng } from "./pdf-tools";
import { maxImage, typicalCard, worstRaw } from "./sample";

const A4 = { w: 841.89, h: 595.28 };

async function assertOnePage(pdf: Buffer) {
  const info = await pdfInfo(pdf);
  expect(info.pages).toBe(1);
  expect(Math.abs(info.width - A4.w)).toBeLessThan(1);
  expect(Math.abs(info.height - A4.h)).toBeLessThan(1);
  return info;
}

describe("card PDF", () => {
  it("renders a typical card with Korean text, no hyphens added", async () => {
    const pdf = await renderCardPdf(typicalCard());
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    fs.writeFileSync(path.join(ARTIFACTS, "typical.pdf"), pdf);
    await pdfToPng(pdf, path.join(ARTIFACTS, "typical.png"));
    const info = await assertOnePage(pdf);
    const flat = info.text.replace(/\n/g, "");
    for (const s of ["매매일지", "예시전자 우선주", "8,676,000원", "손절 기준은 직전 저점", "예상과 달랐던 이유"]) {
      expect(flat.replace(/\s/g, "")).toContain(s.replace(/\s/g, ""));
    }
    expect(flat).toContain("띄어쓰기없이아주길게이어지는");
    expect(flat).not.toContain("-이");
    expect(flat.replace("스노트 - 매매", "")).not.toMatch(/[가-힣]-/);
  });

  it.each(["text", "draw"] as const)("worst case (%s) stays one A4 landscape page", async (mode) => {
    const raw = worstRaw(mode);
    const body = JSON.stringify({ card: raw, email: "a".repeat(64) + "@example.com", turnstileToken: "t".repeat(4096) });
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_BODY_BYTES);
    expect(Buffer.byteLength(body)).toBeLessThan(4.5 * 1024 * 1024);

    const card = cardSchema.parse(raw);
    expect(wrapText(card.reason.text, TYPE.body, BOXES.reasonWriting.w)).toHaveLength(maxLines(BOXES.reasonWriting));
    expect(wrapText(card.memo.text, TYPE.body, BOXES.memoWriting.w)).toHaveLength(maxLines(BOXES.memoWriting));

    const started = Date.now();
    const pdf = await renderCardPdf(card);
    const elapsed = Date.now() - started;
    await assertOnePage(pdf);
    fs.writeFileSync(path.join(ARTIFACTS, `worst-${mode}.pdf`), pdf);
    await pdfToPng(pdf, path.join(ARTIFACTS, `worst-${mode}.png`));
    console.log(`worst-${mode}: body=${Buffer.byteLength(body)} pdf=${pdf.length} renderMs=${elapsed}`);
    expect(pdf.length).toBeLessThan(MAX_PDF_BYTES / 2);
  });

  it("renders an empty card on one page", async () => {
    await assertOnePage(await renderCardPdf(emptyCard("2026-10-30")));
  });
});

describe("stop-loss on the card", () => {
  const texts = async (pdf: Buffer) => (await pdfInfo(pdf)).text.replace(/\s/g, "");

  it("prints amount then percent, in both modes, and writes the PNGs to look at", async () => {
    const pct = { ...typicalCard(), stopLossMode: "pct", stopLossPct: 5, stopLoss: 1 } as const;
    const parsed = cardSchema.parse(pct);
    const pdf = await renderCardPdf(parsed);
    fs.writeFileSync(path.join(ARTIFACTS, "stoploss-pct.pdf"), pdf);
    await pdfToPng(pdf, path.join(ARTIFACTS, "stoploss-pct.png"));
    expect(await texts(pdf)).toContain("68,685원(5%)");
    expect(await texts(pdf)).not.toContain("433,800");
  });

  it.each([
    ["max price, percent mode", { price: MAX_PRICE, stopLossMode: "pct", stopLossPct: 0.01 }, "999,899,999,999원(0.01%)"],
    ["max price, 100%", { price: MAX_PRICE, stopLossMode: "pct", stopLossPct: 100 }, "0원(100%)"],
    ["max amount above the price", { price: 1, stopLoss: MAX_AMOUNT }, "999,999,999,999,999원(1주당가격초과)"],
    ["amount equal to the price", { price: MAX_PRICE, stopLoss: MAX_PRICE }, "999,999,999,999원(0%)"],
  ])("%s fits the field and stays one page", async (name, patch, expected) => {
    const card = cardSchema.parse({ ...(worstRaw("text") as object), ...patch });
    const prim = buildScene(card).flatMap((p) => (p.t === "text" && p.value.includes("원 (") ? [p] : []))[0];
    expect(prim).toBeTruthy();
    expect(measure(prim.value, prim.size)).toBeLessThanOrEqual(CELL_VALUE_WIDTH(BOXES.stopLoss) + 0.01);
    expect(prim.x).toBeGreaterThanOrEqual(BOXES.stopLoss.x);
    const pdf = await renderCardPdf(card);
    await assertOnePage(pdf);
    expect(await texts(pdf)).toContain(expected);
    const file = name.replace(/\W+/g, "-");
    fs.writeFileSync(path.join(ARTIFACTS, `stoploss-${file}.pdf`), pdf);
    await pdfToPng(pdf, path.join(ARTIFACTS, `stoploss-${file}.png`));
  });
});

describe("image privacy", () => {
  // react-pdf's module-level cache is keyed by the bytes' base64. A probe carrying the key but
  // unusable bytes only resolves if an entry with that key exists.
  const probe = (image: string) => resolveImage({ data: { toString: () => Buffer.from(parseImageDataUrl(image)!.bytes).toString("base64") }, format: "jpg" } as never, { cache: true });
  const usable = (result: Promise<unknown> | unknown) => Promise.resolve(result).then((r) => Boolean((r as { data?: unknown } | undefined)?.data), () => false);

  it("the probe does detect a cached image (control)", async () => {
    const image = maxImage(); // random, so its key cannot collide with the next test
    const bytes = Buffer.from(parseImageDataUrl(image)!.bytes);
    await resolveImage({ data: bytes, format: "jpg" }, { cache: true });
    expect(await usable(probe(image))).toBe(true);
  });

  it("a rendered card's image is not left in the renderer's cache", async () => {
    const card = typicalCard();
    await renderCardPdf(card);
    expect(await usable(probe(card.image!))).toBe(false);
  });
});

describe("vector handwriting", () => {
  it("draws strokes as paths: a card without an attachment has no raster image", async () => {
    const { OPS, getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await renderCardPdf({ ...typicalCard(), image: null });
    const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
    const ops = await (await doc.getPage(1)).getOperatorList();
    const images = ops.fnArray.filter((f) => f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject);
    expect(images).toHaveLength(0);
    expect(ops.fnArray.filter((f) => f === OPS.constructPath).length).toBeGreaterThan(3);
  });
});

describe("text fidelity", () => {
  it("every text primitive of the preview scene lands in the PDF with the same string and x", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const card = emptyCard("2026-10-30");
    const typed = { ...card, ticker: "  예시  전자 ", reason: { ...card.reason, text: "가나\n   가나\n가  나   다" } };
    const pdf = await renderCardPdf(typed);
    const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items.flatMap((i) => ("str" in i && i.str.trim() ? [{ s: i.str, x: i.transform[4] }] : []));
    const prims = buildScene(typed).flatMap((p) => (p.t === "text" ? [p] : []));
    expect(prims.map((p) => p.value)).toContain("가 나 다");
    for (const p of prims) {
      const hit = items.find((i) => i.s === p.value && Math.abs(i.x - p.x) < 0.5);
      expect(hit, `${p.value} at ${p.x}`).toBeTruthy();
    }
  });
});
