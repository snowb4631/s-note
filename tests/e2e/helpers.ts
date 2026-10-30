import type { Locator, Page } from "@playwright/test";

export const shot = (name: string) => `artifacts/e2e/${name}.png`;

export async function openEditor(page: Page, base = "") {
  await page.goto(`${base}/`);
  await page.locator('[data-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

export const reasonText = (page: Page) => page.getByRole("textbox", { name: "매수/매도 이유" });
export const memoText = (page: Page) => page.getByRole("textbox", { name: "메모" });

/** Draws a zig-zag: real touch through CDP on touch projects, a mouse drag otherwise. */
export async function draw(page: Page, target: Locator, touch: boolean, start = 0.1, end = 0.9) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const at = (t: number) => ({
    x: box.x + box.width * (start + (end - start) * t),
    y: box.y + box.height * (0.5 + 0.3 * Math.sin(t * Math.PI * 6)),
  });
  const steps = 30;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: string, p?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: p ? [p] : [] });
    await send("touchStart", at(0));
    for (let i = 1; i <= steps; i += 1) await send("touchMove", at(i / steps));
    await send("touchEnd");
    await cdp.detach();
  } else {
    await page.mouse.move(at(0).x, at(0).y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) await page.mouse.move(at(i / steps).x, at(i / steps).y);
    await page.mouse.up();
  }
}

export const inkPaths = (target: Locator) => target.locator("path").count();
