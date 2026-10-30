import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { emptyCard } from "../../src/lib/card/schema";
import { openEditor, shot } from "./helpers";

const PROD = "http://localhost:3101";
const PROD_ADS = "http://localhost:3102";
const card = emptyCard("2026-10-30");

test("production without keys: both APIs fail closed with 503", async ({ request }) => {
  const send = await request.post(`${PROD}/api/send`, {
    data: { card, email: "me@example.com", turnstileToken: "x" },
  });
  expect(send.status()).toBe(503);
  const pdf = await request.post(`${PROD}/api/pdf`, { data: card });
  expect(pdf.status()).toBe(503);
  expect(await send.text()).not.toContain("me@example.com");
});

test("production UI reports the outage instead of pretending", async ({ page }) => {
  await openEditor(page, PROD);
  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "PDF 다운로드" }).click();
  await expect(page.locator('main [role="alert"]')).toContainText("쓸 수 없습니다");
  await page.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await page.getByLabel("받을 이메일 주소").fill("me@example.com");
  await page.getByTestId("send-button").click();
  await expect(page.locator('main [role="alert"]')).toContainText("쓸 수 없습니다");
  await expect(page.getByTestId("send-done")).toHaveCount(0);
});

test.describe("ads", () => {
  const adRequests = (page: import("@playwright/test").Page) => {
    const seen: string[] = [];
    // Never reach Google from a test.
    void page.route("**/*googlesyndication*/**", (route) => {
      seen.push(route.request().url());
      return route.abort();
    });
    return seen;
  };

  test("no variables: neither slot nor script on /send", async ({ page }) => {
    const seen = adRequests(page);
    await openEditor(page, PROD);
    await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
    await page.getByRole("button", { name: "미리보기" }).click();
    await page.getByRole("button", { name: "이메일로 받기" }).click();
    await page.waitForURL("**/send");
    await expect(page.getByTestId("send-card")).toBeVisible();
    await expect(page.getByTestId("ad-slot")).toHaveCount(0);
    await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
    expect(await page.content()).not.toContain("adsbygoogle");
    expect(seen).toEqual([]);
  });

  test("with variables: labelled slot on /send, far from buttons, no wait, only there", async ({ page }, info) => {
    const seen = adRequests(page);
    await openEditor(page, PROD_ADS);
    await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    await page.getByRole("textbox", { name: "종목" }).fill("비공개종목");
    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    await page.getByRole("button", { name: "이메일로 받기" }).click();
    await page.waitForURL("**/send");

    const slot = page.getByTestId("ad-slot");
    await expect(slot).toBeVisible();
    // The ad script shares this page, so card values stay out of its DOM.
    await expect(page.getByTestId("send-card-hidden")).toBeVisible();
    await expect(page.getByTestId("send-card")).toHaveCount(0);
    expect(await page.locator("body").innerHTML()).not.toContain("비공개종목");
    await expect(slot.getByText("광고", { exact: true })).toBeVisible();
    await expect(page.locator('script[src*="pagead2.googlesyndication.com"]')).toHaveCount(1);
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    expect(seen[0]).toContain("client=ca-pub-1234567890123456");

    // Send button is usable at once: no countdown, no disabled state.
    await expect(page.getByTestId("send-button")).toBeEnabled();

    const button = (await page.getByTestId("send-button").boundingBox())!;
    const back = (await page.getByRole("link", { name: "카드로 돌아가기" }).boundingBox())!;
    const ad = (await slot.boundingBox())!;
    expect(ad.y - (button.y + button.height)).toBeGreaterThanOrEqual(150);
    expect(ad.y - (back.y + back.height)).toBeGreaterThanOrEqual(100);
    await page.screenshot({ path: shot(`send-ads-${info.project.name}`), fullPage: true });

    for (const path of ["/guides", "/privacy", "/"]) {
      await page.goto(`${PROD_ADS}${path}`);
      await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    }
  });
});

test("security headers are set on every page", async ({ request }) => {
  const res = await request.get(`${PROD}/`);
  expect(res.headers()["content-security-policy"]).toBe("base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
});

test("a Turnstile script that cannot load is explained", async ({ page }) => {
  // Never reach Cloudflare from a test.
  await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());
  await openEditor(page, "http://localhost:3105");
  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await expect(page.getByTestId("turnstile-error")).toContainText("불러오지 못해");
});

test("content pages: disclaimer on every page, six guides, privacy draft", async ({ page }, info) => {
  await page.goto(`${PROD}/guides`);
  const links = page.locator('a[href^="/guides/"]');
  await expect(links).toHaveCount(6);
  await page.screenshot({ path: shot(`guides-${info.project.name}`), fullPage: true });
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  for (const href of hrefs) {
    const res = await page.goto(`${PROD}${href}`);
    expect(res!.status()).toBe(200);
    await expect(page.getByTestId("disclaimer")).toContainText("투자 권유가 아닙니다");
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.screenshot({ path: shot(`guide-${info.project.name}`), fullPage: true });

  await page.goto(`${PROD}/privacy`);
  await expect(page.getByTestId("review-note")).toContainText("전문가의 검토");
  await expect(page.locator("main")).toContainText("[확인 필요]");
  await expect(page.locator("main")).toContainText("최대 24시간");
  await page.screenshot({ path: shot(`privacy-${info.project.name}`), fullPage: true });

  const list = "artifacts/banned-phrases.json";
  if (fs.existsSync(list)) {
    const body = (await page.content()).toLowerCase();
    for (const phrase of JSON.parse(fs.readFileSync(list, "utf8")).phrases as string[]) expect(body).not.toContain(phrase.toLowerCase());
  }
});
