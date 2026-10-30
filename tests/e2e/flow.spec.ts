import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { expect, test } from "@playwright/test";
import { pdfInfo } from "../unit/pdf-tools";
import { draw, inkPaths, memoText, openEditor, reasonText, shot } from "./helpers";

const modeButton = (page: import("@playwright/test").Page, section: string, name: string) =>
  page.getByRole("region", { name: section, exact: true }).getByRole("button", { name, exact: true });

function largePhoto(): Buffer {
  const canvas = createCanvas(3000, 2000);
  const c = canvas.getContext("2d");
  const data = c.createImageData(3000, 2000);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = Math.random() * 255;
    data.data[i + 1] = (i / data.data.length) * 255;
    data.data[i + 2] = Math.random() * 255;
    data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  return canvas.toBuffer("image/png");
}

test("empty card shows today's date right away", async ({ page }) => {
  await openEditor(page);
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(page.locator('input[type="date"]')).toHaveValue(today);
});

test("total: auto, manual override survives edits, revert", async ({ page }) => {
  await openEditor(page);
  const q = page.getByRole("textbox", { name: "수량" });
  const p = page.getByRole("textbox", { name: "1주당 가격" });
  const total = page.getByRole("textbox", { name: "총 거래금액" });
  await q.fill("1200");
  await expect(q).toHaveValue("1,200");
  await p.fill("72300");
  await expect(total).toHaveValue("86,760,000");

  await total.fill("86000000");
  await expect(total).toHaveValue("86,000,000");
  await q.fill("10");
  await expect(total).toHaveValue("86,000,000");

  await page.getByRole("button", { name: "자동계산으로" }).click();
  await expect(total).toHaveValue("723,000");
  await q.fill("20");
  await expect(total).toHaveValue("1,446,000");
});

test("total: clearing stays empty, the next key is what was typed, only the button reverts", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("textbox", { name: "수량" }).fill("10");
  await page.getByRole("textbox", { name: "1주당 가격" }).fill("72300");
  const total = page.getByRole("textbox", { name: "총 거래금액" });
  await expect(total).toHaveValue("723,000");
  await total.fill("");
  await expect(total).toHaveValue("");
  await total.pressSequentially("5");
  await expect(total).toHaveValue("5");
  await page.getByRole("button", { name: "자동계산으로" }).click();
  await expect(total).toHaveValue("723,000");
  await expect(page.getByRole("button", { name: "자동계산으로" })).toHaveCount(0);
});

test("number fields refuse decimals, minus and over-limit values, and say so", async ({ page }) => {
  await openEditor(page);
  const price = page.getByRole("textbox", { name: "1주당 가격" });
  await price.fill("72300");
  await price.fill("72,300.5");
  await expect(price).toHaveValue("72,300");
  await expect(page.locator(".field-error")).toContainText("정수만");
  await price.fill("-100");
  await expect(price).toHaveValue("72,300");
  await price.fill("9999999999999");
  await expect(price).toHaveValue("72,300");
  await expect(page.locator(".field-error")).toContainText("최대");
  await price.fill("100");
  await expect(page.locator(".field-error")).toHaveCount(0);
});

test("stop-loss: units, per-share base, missing price, amount above price, preview and PDF", async ({ page }, info) => {
  await openEditor(page);
  const unit = page.getByRole("combobox", { name: "손절매 입력 단위" });
  const converted = page.getByTestId("stop-converted");
  await expect(unit).toHaveValue("won");
  await expect(page.getByRole("textbox", { name: "손절매 금액" })).toHaveAttribute("placeholder", "1주당 손절 가격");

  // Percent with no price: no amount, and the reason. A total is not a base.
  await unit.selectOption("pct");
  const pct = page.getByRole("textbox", { name: "손절매 비율" });
  await pct.pressSequentially("5.5");
  await expect(pct).toHaveValue("5.5");
  await expect(converted).toHaveText("5.5%");
  await expect(page.getByTestId("stop-needs-price")).toBeVisible();
  await page.getByRole("textbox", { name: "총 거래금액" }).fill("1000000");
  await expect(converted).toHaveText("5.5%");
  await page.getByRole("button", { name: "자동계산으로" }).click();

  // The amount follows the price only, never quantity or a manual total.
  await pct.fill("5");
  await page.getByRole("textbox", { name: "수량" }).fill("10");
  await page.getByRole("textbox", { name: "1주당 가격", exact: true }).fill("72300");
  await expect(page.getByRole("textbox", { name: "총 거래금액" })).toHaveValue("723,000");
  await expect(converted).toHaveText("68,685원 (5%)");
  await expect(page.getByTestId("stop-needs-price")).toHaveCount(0);
  await page.getByRole("textbox", { name: "수량" }).fill("20");
  await expect(page.getByRole("textbox", { name: "총 거래금액" })).toHaveValue("1,446,000");
  await expect(converted).toHaveText("68,685원 (5%)");
  await page.getByRole("textbox", { name: "총 거래금액" }).fill("1000000");
  await expect(converted).toHaveText("68,685원 (5%)");
  await page.getByRole("textbox", { name: "1주당 가격", exact: true }).fill("80000");
  await expect(converted).toHaveText("76,000원 (5%)");
  await page.getByRole("textbox", { name: "1주당 가격", exact: true }).fill("72300");
  await expect(converted).toHaveText("68,685원 (5%)");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ path: shot(`stoploss-editor-${info.project.name}`) });
  await pct.fill("101");
  await expect(pct).toHaveValue("5");
  await expect(page.locator(".field-error")).toContainText("0부터 100까지");
  await pct.fill("1.234");
  await expect(pct).toHaveValue("5");

  await page.getByRole("button", { name: "미리보기" }).click();
  const card = page.getByTestId("preview-card");
  await expect(card.getByText("68,685원 (5%)")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await card.screenshot({ path: shot(`stoploss-preview-${info.project.name}`) });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF 다운로드" }).click()]);
  const pdf = fs.readFileSync(await download.path());
  fs.writeFileSync(`artifacts/e2e/stoploss-${info.project.name}.pdf`, pdf);
  expect((await pdfInfo(pdf)).text.replace(/\s/g, "")).toContain("68,685원(5%)");
  await page.getByRole("button", { name: "닫기" }).click();

  // Back to won: the amount carries over, percent is derived.
  await unit.selectOption("won");
  const won = page.getByRole("textbox", { name: "손절매 금액" });
  await expect(won).toHaveValue("68,685");
  await won.fill("1250");
  await expect(converted).toHaveText("1,250원 (98.27%)");
  await won.fill("72300");
  await expect(converted).toHaveText("72,300원 (0%)");
  await expect(page.getByTestId("stop-over-price")).toHaveCount(0);

  // Above the price.
  await won.fill("2000000");
  await expect(converted).toHaveText("2,000,000원 (1주당 가격 초과)");
  await expect(page.getByTestId("stop-over-price")).toBeVisible();

  // Survives a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await expect(page.getByTestId("stop-converted")).toHaveText("2,000,000원 (1주당 가격 초과)");
});

test("stop-loss at maximum values stays inside its cell in the editor", async ({ page }, info) => {
  await openEditor(page);
  await page.getByRole("textbox", { name: "1주당 가격", exact: true }).fill("999999999999");
  const unit = page.getByRole("combobox", { name: "손절매 입력 단위" });
  await unit.selectOption("pct");
  await page.getByRole("textbox", { name: "손절매 비율" }).fill("0.01");
  const converted = page.getByTestId("stop-converted");
  await expect(converted).toHaveText("999,899,999,999원 (0.01%)");
  await unit.selectOption("won");
  await page.getByRole("textbox", { name: "손절매 금액" }).fill("999999999999999");
  await expect(converted).toHaveText("999,999,999,999,999원 (1주당 가격 초과)");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const cell = (await page.locator(".field", { has: converted }).boundingBox())!;
  const text = (await converted.boundingBox())!;
  expect(text.x).toBeGreaterThanOrEqual(cell.x - 1);
  expect(text.x + text.width).toBeLessThanOrEqual(cell.x + cell.width + 1);
  // The longer value must not push the input out of the cell either.
  const input = (await page.getByRole("textbox", { name: "손절매 금액" }).boundingBox())!;
  expect(input.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
  expect(input.y + input.height).toBeLessThanOrEqual(cell.y + cell.height + 1);
  await page.screenshot({ path: shot(`stoploss-editor-max-${info.project.name}`) });
});

test("date: bad values are refused with a Korean message, typing a year still works", async ({ page }) => {
  await openEditor(page);
  const date = page.locator('input[type="date"]');
  await expect(date).toHaveAttribute("min", "1990-01-01");
  await expect(date).toHaveAttribute("max", "2099-12-31");
  await date.fill("2026-03-05");
  await date.fill("0002-03-05");
  await expect(date).toHaveValue("0002-03-05"); // held while typing
  // Touch emulation will not focus a date input from script, so send what leaving it sends.
  await date.evaluate((el) => el.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  await expect(date).toHaveValue("2026-03-05");
  await expect(page.locator(".field-error")).toContainText("날짜는");
  await date.fill("2027-01-02");
  await expect(page.locator(".field-error")).toHaveCount(0);
});

const seedStores = (page: import("@playwright/test").Page, idbValue: unknown, lsValue: unknown) =>
  page.evaluate(
    ([a, b]) =>
      new Promise<void>((resolve, reject) => {
        if (b) localStorage.setItem("snote.draft", JSON.stringify(b));
        const open = indexedDB.open("snote", 1);
        open.onsuccess = () => {
          const tx = open.result.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put(a, "current");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [idbValue, lsValue],
  );
const draft = (ticker: string) => ({
  date: "2026-10-30", ticker, side: null, quantity: null, price: null, total: null, totalManual: false, stopLoss: null,
  reason: { mode: "text", text: "", strokes: [] }, memo: { mode: "text", text: "", strokes: [] }, image: null,
});
// Keeps the editor's own autosave from overwriting a seeded store before the reload.
const reloadSeeded = async (page: import("@playwright/test").Page) => {
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
};

test("a newer localStorage draft beats a stale IndexedDB one", async ({ page }) => {
  await openEditor(page);
  await page.waitForTimeout(500);
  await seedStores(page, { savedAt: 1, card: draft("오래된 카드") }, { savedAt: 2, card: draft("최신 카드") });
  await reloadSeeded(page);
  await expect(page.getByRole("textbox", { name: "종목" })).toHaveValue("최신 카드");
});

test("a draft from before this version, without the stop-loss fields, still loads", async ({ page }) => {
  await openEditor(page);
  await page.waitForTimeout(500);
  await seedStores(page, { ...draft("옛 형식"), stopLoss: 5000 }, null);
  await reloadSeeded(page);
  await expect(page.getByRole("textbox", { name: "종목" })).toHaveValue("옛 형식");
  await expect(page.getByRole("textbox", { name: "손절매 금액" })).toHaveValue("5,000");
  await expect(page.getByTestId("draft-repaired")).toHaveCount(0);
});

test("an old stop-loss draft: % mode recomputes on the price, won mode keeps its amount", async ({ page }) => {
  await openEditor(page);
  await page.waitForTimeout(500);
  const old = { ...draft("옛 기준"), quantity: 10, price: 72300, total: 723000, stopLoss: 36150 };
  await seedStores(page, { ...old, stopLossMode: "pct", stopLossPct: 5 }, null);
  await reloadSeeded(page);
  await expect(page.getByTestId("stop-converted")).toHaveText("68,685원 (5%)");
  await seedStores(page, { ...old, stopLossMode: "won", stopLossPct: null }, null);
  await reloadSeeded(page);
  await expect(page.getByRole("textbox", { name: "손절매 금액" })).toHaveValue("36,150");
  await expect(page.getByTestId("stop-converted")).toHaveText("36,150원 (50%)");
});

test("a corrupt draft keeps its good fields and says so", async ({ page }) => {
  await openEditor(page);
  await page.waitForTimeout(500);
  await seedStores(page, { savedAt: 1, card: { ...draft("살아남은 종목"), date: "0002-99-99", quantity: "많이", junk: true } }, null);
  await reloadSeeded(page);
  await expect(page.getByRole("textbox", { name: "종목" })).toHaveValue("살아남은 종목");
  await expect(page.getByTestId("draft-repaired")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "수량" })).toHaveValue("");
});

test("a failed save loses nothing on the way to /send; reload falls back to the draft and warns", async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new Error("denied"); };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (value.includes('"strokes":[{')) throw new DOMException("quota", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await openEditor(page);
  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await modeButton(page, "메모", "필기").click();
  await draw(page, page.getByTestId("pad"), page.viewportSize()!.width < 500);
  await expect(page.getByTestId("save-status")).toContainText("필기와 이미지는");
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await expect(page.getByTestId("send-warning")).toContainText("새로고침하면 사라져요");

  const sent: { card?: { memo: { strokes: unknown[] } } }[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/send")) sent.push(r.postDataJSON());
  });
  await page.getByLabel("받을 이메일 주소").fill("me@example.com");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("send-done")).toBeVisible();
  expect(sent[0].card!.memo.strokes.length).toBe(1);

  await page.reload();
  await expect(page.getByTestId("send-warning")).toContainText("빠진 카드");
  await expect(page.getByTestId("send-card")).toBeVisible();
});

test("a provider failure reads as clean Korean on /send", async ({ page }) => {
  await page.route("**/api/send", (route) =>
    route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, code: "mail_failed", message: "메일 발송 요청이 많아 지금은 보낼 수 없습니다. 잠시 후 다시 시도해 주세요." }) }),
  );
  await openEditor(page);
  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await page.getByLabel("받을 이메일 주소").fill("me@example.com");
  await page.getByTestId("send-button").click();
  await expect(page.locator('main [role="alert"]')).toContainText("잠시 후 다시 시도");
  await expect(page.getByTestId("send-done")).toHaveCount(0);
});

test("a blank card cannot be mailed", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByRole("button", { name: "이메일로 받기" })).toBeDisabled();
  await expect(page.getByTestId("blank-note")).toBeVisible();
  await page.waitForTimeout(500);
  await page.goto("/send");
  await expect(page.getByText("보낼 카드가 없어요")).toBeVisible();
});

test("새 카드: asks inline first, then clears everything including undo and stale notes", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs += 1;
    void d.dismiss();
  });
  await openEditor(page);
  // An empty card resets without asking.
  await page.getByRole("button", { name: "새 카드" }).click();
  await expect(page.getByTestId("reset-confirm")).toHaveCount(0);

  await memoText(page).fill("빠".repeat(2000));
  await expect(page.getByText("칸이 가득 찼어요")).toBeVisible();
  await page.getByTestId("image-input").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByText("이미지를 읽지 못했어요")).toBeVisible();

  await page.getByRole("button", { name: "새 카드" }).click();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(memoText(page)).not.toHaveValue("");

  await page.getByRole("button", { name: "새 카드" }).click();
  await page.getByRole("button", { name: "지우고 새로 쓰기" }).click();
  await expect(memoText(page)).toHaveValue("");
  await expect(page.getByText("칸이 가득 찼어요")).toHaveCount(0);
  await expect(page.getByText("이미지를 읽지 못했어요")).toHaveCount(0);
  expect(dialogs).toBe(0);

  await page.waitForTimeout(500);
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await expect(memoText(page)).toHaveValue("");
});

test("새 카드 drops undo history", async ({ page }) => {
  await openEditor(page);
  await modeButton(page, "메모", "필기").click();
  await draw(page, page.getByTestId("pad"), page.viewportSize()!.width < 500);
  await page.getByRole("button", { name: "새 카드" }).click();
  await page.getByRole("button", { name: "지우고 새로 쓰기" }).click();
  await modeButton(page, "메모", "필기").click();
  await expect(page.getByRole("button", { name: "되돌리기" })).toBeDisabled();
});

test("image compression: a slow earlier pick cannot overwrite a later one or a reset", async ({ page }) => {
  await openEditor(page);
  const input = page.getByTestId("image-input");
  const tiny = createCanvas(40, 30);
  tiny.getContext("2d").fillRect(0, 0, 40, 30);
  const small = { name: "small.png", mimeType: "image/png", buffer: tiny.toBuffer("image/png") };
  const big = { name: "big.png", mimeType: "image/png", buffer: largePhoto() };
  await input.setInputFiles(big);
  await input.setInputFiles(small);
  const img = page.getByAltText("첨부한 이미지");
  await expect(img).toBeVisible();
  await page.waitForTimeout(2500);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(40);

  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByTestId("image-input").setInputFiles(big);
  await page.getByRole("button", { name: "새 카드" }).click();
  await page.waitForTimeout(2500);
  await expect(page.getByAltText("첨부한 이미지")).toHaveCount(0);
});

test("eraser: a fast jump across a stroke erases it; events before a re-render do not bring strokes back", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "mouse only");
  await openEditor(page);
  await modeButton(page, "메모", "필기").click();
  const pad = page.getByTestId("pad");
  const box = (await pad.boundingBox())!;
  const line = async (fy: number) => {
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * fy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * fy, { steps: 6 });
    await page.mouse.up();
  };
  await line(0.25);
  await line(0.75);
  await line(0.5);
  await expect.poll(() => inkPaths(pad)).toBe(3);
  await page.getByRole("button", { name: "지우개" }).click();

  // One event on each side of the middle stroke, nothing between.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.up();
  await expect.poll(() => inkPaths(pad)).toBe(2);

  // Two moves in one task, each hitting a different stroke.
  await pad.evaluate((el, b) => {
    const at = (type: string, fy: number) =>
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "mouse", button: 0, clientX: b.x + b.width * 0.5, clientY: b.y + b.height * fy }));
    el.setPointerCapture = () => {};
    at("pointerdown", 0.02);
    at("pointermove", 0.25);
    at("pointermove", 0.75);
    at("pointerup", 0.75);
  }, box);
  await expect.poll(() => inkPaths(pad)).toBe(0);
  await page.waitForTimeout(200);
  await expect.poll(() => inkPaths(pad)).toBe(0);
});

test("full flow: write, draw, attach, reload, preview, download, send", async ({ page }, info) => {
  const touch = info.project.name === "mobile";
  await openEditor(page);

  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await page.getByRole("button", { name: "매수", exact: true }).click();
  await page.getByRole("textbox", { name: "수량" }).fill("120");
  await page.getByRole("textbox", { name: "1주당 가격" }).fill("72300");
  await page.getByRole("textbox", { name: "손절매 금액" }).fill("68685");
  await reasonText(page).fill("실적 발표 뒤 거래량이 늘었다.\n띄어쓰기없는아주긴한글문장도칸안에서자연스럽게줄이바뀌는지확인한다.");

  // Image is compressed to 1MB or less in the browser.
  const photo = largePhoto();
  expect(photo.length).toBeGreaterThan(1_000_000);
  await page.getByTestId("image-input").setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: photo });
  const img = page.getByAltText("첨부한 이미지");
  await expect(img).toBeVisible();
  const decoded = await img.evaluate((el: HTMLImageElement) => {
    const b64 = el.src.split(",")[1];
    return { head: el.src.slice(0, 23), bytes: atob(b64).length };
  });
  expect(decoded.head).toBe("data:image/jpeg;base64,");
  expect(decoded.bytes).toBeLessThanOrEqual(1_000_000);

  // Handwriting in the memo.
  await modeButton(page, "메모", "필기").click();
  const pad = page.getByTestId("pad");
  await draw(page, pad, touch);
  await expect.poll(() => inkPaths(pad)).toBe(1);
  await draw(page, pad, touch, 0.2, 0.7);
  await expect.poll(() => inkPaths(pad)).toBe(2);

  // Undo, clear, and undo of clear.
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(() => inkPaths(pad)).toBe(1);
  await page.getByRole("button", { name: "전체 지우기" }).click();
  await expect.poll(() => inkPaths(pad)).toBe(0);
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(() => inkPaths(pad)).toBe(1);
  await draw(page, pad, touch, 0.2, 0.7);
  await expect.poll(() => inkPaths(pad)).toBe(2);

  // Eraser removes the stroke it touches.
  await page.getByRole("button", { name: "지우개" }).click();
  await draw(page, pad, touch, 0.75, 0.9);
  await expect.poll(() => inkPaths(pad)).toBe(1);
  await page.getByRole("button", { name: "펜", exact: true }).click();
  await draw(page, pad, touch, 0.75, 0.95);
  await expect.poll(() => inkPaths(pad)).toBe(2);

  await expect(page.getByTestId("save-status")).toContainText("임시 저장");
  await page.screenshot({ path: shot(`editor-${info.project.name}`), fullPage: true });

  // Reload restores everything, including image and strokes.
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await expect(page.getByRole("textbox", { name: "종목" })).toHaveValue("예시전자");
  await expect(page.getByRole("textbox", { name: "총 거래금액" })).toHaveValue("8,676,000");
  await expect(page.getByAltText("첨부한 이미지")).toBeVisible();
  await expect.poll(() => inkPaths(page.getByTestId("pad"))).toBe(2);

  // Preview, download.
  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.getByTestId("preview-dialog");
  await expect(preview.getByTestId("preview-card")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ path: shot(`preview-${info.project.name}`) });

  const [download] = await Promise.all([page.waitForEvent("download"), preview.getByRole("button", { name: "PDF 다운로드" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^snote-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = fs.readFileSync(await download.path());
  const meta = await pdfInfo(pdf);
  expect(meta.pages).toBe(1);
  expect(meta.width).toBeGreaterThan(meta.height);
  expect(meta.text.replace(/\s/g, "")).toContain("예시전자");

  // Separate send page reads the same draft.
  await preview.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await expect(page.getByTestId("send-card")).toBeVisible();
  await expect(page.getByTestId("ad-slot")).toHaveCount(0);
  await page.screenshot({ path: shot(`send-${info.project.name}`), fullPage: true });

  await page.getByLabel("받을 이메일 주소").fill("not-an-email");
  await page.getByTestId("send-button").click();
  await expect(page.locator('main [role="alert"]')).toContainText("이메일 주소");

  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.getByLabel("받을 이메일 주소").fill("me@example.com");
  await page.getByTestId("send-button").click();
  const done = page.getByTestId("send-done");
  await expect(done).toContainText("개발 모드");
  await expect(done).toContainText("보내지 않았습니다");
  expect(requests.filter((u) => u.includes("/api/send"))).toHaveLength(1);
  await page.screenshot({ path: shot(`send-done-${info.project.name}`) });

  await page.getByRole("button", { name: "새 카드 작성" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.locator('[data-ready="true"]').waitFor();
  await expect(page.getByRole("textbox", { name: "종목" })).toHaveValue("");
});

test("the card never reaches the server until the user asks", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posts.push(r.url());
  });
  await openEditor(page);
  await reasonText(page).fill("서버로 가면 안 되는 내용");
  await page.waitForTimeout(800);
  expect(posts.filter((u) => u.includes("/api/"))).toEqual([]);
});

test("oversized typed text is trimmed to what fits, and the card stays valid", async ({ page }) => {
  await openEditor(page);
  await memoText(page).fill("빠".repeat(2000));
  await expect(page.getByText("칸이 가득 찼어요")).toBeVisible();
  const value = await memoText(page).inputValue();
  expect(value.length).toBeLessThan(600);
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByTestId("preview-card")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF 다운로드" }).click()]);
  expect((await pdfInfo(fs.readFileSync(await download.path()))).pages).toBe(1);
});

test("/send without a draft asks to write one", async ({ page }) => {
  await page.goto("/send");
  await expect(page.getByText("보낼 카드가 없어요")).toBeVisible();
});

test.describe("storage failures", () => {
  test("IndexedDB and localStorage both broken: app still works and says so", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", { get() { throw new Error("denied"); } });
      Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
      Storage.prototype.getItem = () => { throw new DOMException("denied", "SecurityError"); };
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openEditor(page);
    await reasonText(page).fill("저장이 안 돼도 작성은 된다");
    await expect(page.getByTestId("save-status")).toContainText("임시 저장을 할 수 없어요");
    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(page.getByTestId("preview-card")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("IndexedDB down, localStorage over quota: keeps text, drops attachments", async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => { throw new Error("denied"); };
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (value.includes('"strokes":[{')) throw new DOMException("quota", "QuotaExceededError");
        original.call(this, key, value);
      };
    });
    await openEditor(page);
    await reasonText(page).fill("글자는 남는다");
    await modeButton(page, "메모", "필기").click();
    await draw(page, page.getByTestId("pad"), page.viewportSize()!.width < 500);
    await expect(page.getByTestId("save-status")).toContainText("필기와 이미지는 임시 저장하지 못했어요");
    await page.reload();
    await page.locator('[data-ready="true"]').waitFor();
    await expect(reasonText(page)).toHaveValue("글자는 남는다");
  });
});

test.describe("touch", () => {
  test("drawing does not scroll; the same gesture elsewhere does", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch only");
    await openEditor(page);
    await modeButton(page, "매수/매도 이유", "필기").click();
    const pad = page.getByTestId("pad");
    await pad.scrollIntoViewIfNeeded();
    expect(await pad.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");

    const swipe = async (x: number, y0: number, y1: number) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
      for (let i = 1; i <= 12; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 12 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await page.waitForTimeout(300);
    };

    const box = (await pad.boundingBox())!;
    const before = await page.evaluate(() => window.scrollY);
    await swipe(box.x + box.width / 2, box.y + box.height - 4, box.y + 4);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await expect.poll(() => inkPaths(pad)).toBe(1);

    // Control: the identical swipe on a part of the page outside the pad scrolls it.
    const header = (await page.getByRole("textbox", { name: "총 거래금액" }).boundingBox())!;
    await page.evaluate(() => window.scrollTo(0, 200));
    const start = await page.evaluate(() => window.scrollY);
    const y = header.y + start * 0 + 300;
    await swipe(6, y, y - 150);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(start);
  });

  test("zoom mode on a phone turns the pad sideways and maps touch correctly", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch only");
    await openEditor(page);
    await modeButton(page, "메모", "필기").click();
    const inline = (await page.getByTestId("pad").boundingBox())!;
    await page.getByRole("button", { name: "확대 필기" }).click();

    const dialog = page.getByRole("dialog", { name: "메모 확대 필기" });
    const pad = dialog.getByTestId("pad");
    await expect(pad).toBeVisible();
    const zoomed = (await pad.boundingBox())!;
    // Rotated: tall on screen and much longer than the inline pad.
    expect(zoomed.height).toBeGreaterThan(zoomed.width);
    expect(zoomed.height).toBeGreaterThan(inline.width * 1.8);

    // A swipe along the screen's vertical axis must become a stroke along the pad's x axis.
    const cdp = await page.context().newCDPSession(page);
    const x = zoomed.x + zoomed.width / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: zoomed.y + zoomed.height * 0.2 }] });
    for (let i = 1; i <= 12; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: zoomed.y + zoomed.height * (0.2 + (0.6 * i) / 12) }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await expect.poll(() => inkPaths(pad)).toBe(1);
    await page.screenshot({ path: shot("zoom-mobile") });

    await dialog.getByRole("button", { name: "완료" }).click();
    const bbox = await page.getByTestId("pad").locator("path").first().evaluate((el: SVGPathElement) => {
      const b = el.getBBox();
      const vb = (el.ownerSVGElement as SVGSVGElement).viewBox.baseVal;
      return { w: b.width / vb.width, h: b.height / vb.height, cx: (b.x - vb.x + b.width / 2) / vb.width };
    });
    expect(bbox.w).toBeGreaterThan(0.5);
    expect(bbox.h).toBeLessThan(0.3);
    expect(bbox.cx).toBeGreaterThan(0.4);
    expect(bbox.cx).toBeLessThan(0.6);
  });
});

test("desktop zoom mode writes to the same field", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop only");
  await openEditor(page);
  await modeButton(page, "매수/매도 이유", "필기").click();
  await page.getByRole("button", { name: "확대 필기" }).click();
  const dialog = page.getByRole("dialog", { name: "매수/매도 이유 확대 필기" });
  const pad = dialog.getByTestId("pad");
  await draw(page, pad, false);
  await expect.poll(() => inkPaths(pad)).toBe(1);
  await page.screenshot({ path: shot("zoom-desktop") });
  await dialog.getByRole("button", { name: "완료" }).click();
  await expect.poll(() => inkPaths(page.getByTestId("pad"))).toBe(1);
});
