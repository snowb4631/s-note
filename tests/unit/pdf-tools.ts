import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const ARTIFACTS = path.resolve("artifacts");

async function open(pdf: Buffer) {
  return getDocument({ data: new Uint8Array(pdf), verbosity: 0, useSystemFonts: false }).promise;
}

export async function pdfInfo(pdf: Buffer) {
  const doc = await open(pdf);
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const [x0, y0, x1, y1] = page.view;
  const text = content.items.map((i) => ("str" in i ? i.str : "")).join("\n");
  const font = (await page.getOperatorList()).fnArray.length;
  return { pages: doc.numPages, width: x1 - x0, height: y1 - y0, text, ops: font };
}

export async function pdfToPng(pdf: Buffer, outPath: string, scale = 2): Promise<void> {
  const doc = await open(pdf);
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
}
