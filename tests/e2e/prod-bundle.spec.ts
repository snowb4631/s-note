import { expect, test } from "@playwright/test";
import { emptyCard } from "../../src/lib/card/schema";
import { pdfInfo } from "../unit/pdf-tools";
import { typicalCard } from "../unit/sample";

const APP = "http://localhost:3103";
const REDIS = "http://localhost:3104";

test("production bundle renders Korean PDFs (font traced, react-pdf external) and enforces 60/h", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "server only");
  await request.get(`${REDIS}/reset`);

  const ok = await request.post(`${APP}/api/pdf`, { data: typicalCard(), headers: { "x-real-ip": "203.0.113.50" } });
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toContain("no-store");
  const meta = await pdfInfo(await ok.body());
  expect(meta.pages).toBe(1);
  expect(meta.text.replace(/\s/g, "")).toContain("예시전자우선주");

  const light = emptyCard("2026-10-30");
  for (let i = 2; i <= 60; i += 1) {
    const r = await request.post(`${APP}/api/pdf`, { data: light, headers: { "x-real-ip": "203.0.113.50" } });
    expect(r.status(), `request ${i}`).toBe(200);
  }
  const blocked = await request.post(`${APP}/api/pdf`, { data: light, headers: { "x-real-ip": "203.0.113.50" } });
  expect(blocked.status()).toBe(429);
  // A different client is unaffected.
  const other = await request.post(`${APP}/api/pdf`, { data: light, headers: { "x-real-ip": "203.0.113.51" } });
  expect(other.status()).toBe(200);

  const seen = JSON.stringify(await (await request.get(`${REDIS}/seen`)).json());
  expect(seen).toContain("snote:pdf:ip");
  expect(seen).not.toContain("203.0.113");
});
