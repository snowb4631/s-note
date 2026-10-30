import fs from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { expect, test } from "@playwright/test";
import { pdfToPng } from "../unit/pdf-tools";
import { chartJpeg, wave } from "../unit/sample";
import { openEditor } from "./helpers";

// The HTML preview and the real PDF, rasterised at the same size and compared pixel by pixel.
test("preview matches the PDF", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "one comparison is enough");
  const card = {
    date: "2026-10-30",
    ticker: "예시전자 우선주",
    side: "buy",
    quantity: 120,
    price: 72300,
    total: 8676000,
    totalManual: false,
    stopLoss: null,
    stopLossMode: "pct",
    stopLossPct: 5,
    reason: {
      mode: "text",
      text: "실적 발표 뒤 거래량이 늘면서 전고점을 넘어섰다. 계획한 분할 매수의 첫 번째 물량이다.\n띄어쓰기없이아주길게이어지는한글문장도칸안에서자연스럽게줄이바뀌어야하고글자가잘리거나하이픈이붙으면안된다는것을확인한다.\n손절 기준은 직전 저점 아래로 잡았다.",
      strokes: [],
    },
    memo: { mode: "draw", text: "", strokes: [wave(0, 3, 60), wave(1, 3, 60, false), wave(2, 3, 40)] },
    image: chartJpeg(),
  };

  const res = await request.post("/api/pdf", { data: card });
  expect(res.status()).toBe(200);
  const pdf = await res.body();
  fs.mkdirSync("artifacts/parity", { recursive: true });
  fs.writeFileSync("artifacts/parity/card.pdf", pdf);

  // Seed the draft through the real store so the preview goes through real code.
  await openEditor(page);
  await page.evaluate(
    (c) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("snote", 1);
        open.onsuccess = () => {
          const tx = open.result.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put(c, "current");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    card,
  );
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await page.getByRole("button", { name: "미리보기" }).click();
  const svg = page.getByTestId("preview-card");
  await expect(svg).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(300);
  const box = (await svg.boundingBox())!;
  const previewPng = "artifacts/parity/preview.png";
  await svg.screenshot({ path: previewPng });
  await expect(svg.getByText("68,685원 (5%)")).toBeVisible();

  const pdfPng = "artifacts/parity/pdf.png";
  await pdfToPng(Buffer.from(pdf), pdfPng, box.width / 841.89);

  const [a, b] = await Promise.all([loadImage(previewPng), loadImage(pdfPng)]);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(2);
  const grab = (img: typeof a) => {
    const c = createCanvas(w, h).getContext("2d");
    c.drawImage(img, 0, 0);
    return c.getImageData(0, 0, w, h).data;
  };
  const pa = grab(a);
  const pb = grab(b);

  const diffCanvas = createCanvas(w, h);
  const dc = diffCanvas.getContext("2d");
  const out = dc.createImageData(w, h);
  let sum = 0;
  let inkA = 0;
  let inkB = 0;
  let inkBoth = 0;
  let different = 0;
  const lum = (d: Uint8ClampedArray, i: number) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  for (let i = 0; i < pa.length; i += 4) {
    const la = lum(pa, i);
    const lb = lum(pb, i);
    const diff = Math.abs(la - lb);
    sum += diff;
    if (diff > 48) different += 1;
    const ia = la < 110;
    const ib = lb < 110;
    if (ia) inkA += 1;
    if (ib) inkB += 1;
    if (ia && ib) inkBoth += 1;
    out.data.set([255 - Math.min(255, diff * 3), 255 - Math.min(255, diff * 3), 255 - Math.min(255, diff * 3), 255], i);
  }
  dc.putImageData(out, 0, 0);
  fs.writeFileSync("artifacts/parity/diff.png", diffCanvas.toBuffer("image/png"));

  const pixels = pa.length / 4;
  const report = {
    size: `${w}x${h}`,
    meanLumaDiff: +(sum / pixels).toFixed(3),
    pctPixelsOver48: +((different / pixels) * 100).toFixed(3),
    inkIoU: +(inkBoth / (inkA + inkB - inkBoth)).toFixed(3),
  };
  fs.writeFileSync("artifacts/parity/report.json", JSON.stringify(report, null, 2));
  console.log("parity", report);
  expect(report.meanLumaDiff).toBeLessThan(3);
  expect(report.pctPixelsOver48).toBeLessThan(2);
  expect(report.inkIoU).toBeGreaterThan(0.75);
});
