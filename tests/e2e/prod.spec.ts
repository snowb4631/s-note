import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { guides } from "../../src/content/guides";
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

  const GUIDE = `/guides/${guides[0].slug}`;
  const script = 'script[src*="pagead2.googlesyndication.com"]';
  const meta = 'head meta[name="google-adsense-account"]';

  test("no variables: no script, unit or meta anywhere, and ads.txt is 404", async ({ page, request }) => {
    const seen = adRequests(page);
    for (const path of ["/", "/privacy", "/guides", GUIDE]) {
      await page.goto(`${PROD}${path}`);
      await expect(page.locator(meta)).toHaveCount(0);
      await expect(page.locator(script)).toHaveCount(0);
      await expect(page.getByTestId("ad-slot")).toHaveCount(0);
    }
    expect(seen).toEqual([]);
    expect((await request.get(`${PROD}/ads.txt`)).status()).toBe(404);
  });

  test("both variables: script on guide pages, labelled unit well below the buttons", async ({ page }, info) => {
    const seen = adRequests(page);
    await page.goto(`${PROD_ADS}/guides`);
    await expect(page.locator(script)).toHaveCount(1);
    await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    expect(seen[0]).toContain("client=ca-pub-1234567890123456");

    await page.goto(`${PROD_ADS}${GUIDE}`);
    await expect(page.locator(script)).toHaveCount(1);
    const slot = page.getByTestId("ad-slot");
    await expect(slot.getByText("광고", { exact: true })).toBeVisible();
    await expect(slot.locator("ins.adsbygoogle")).toHaveAttribute("data-ad-slot", "1234567890");
    const article = (await page.locator("article").boundingBox())!;
    const ad = (await slot.boundingBox())!;
    expect(ad.y).toBeGreaterThan(article.y + article.height);
    for (const name of ["매매일지 카드 쓰기", "다른 글 보기"]) {
      const b = (await page.getByRole("link", { name }).boundingBox())!;
      expect(ad.y - (b.y + b.height)).toBeGreaterThanOrEqual(150);
    }
    await page.screenshot({ path: shot(`guide-ads-${info.project.name}`), fullPage: true });
  });

  test("both variables: / and /privacy load no script but carry the meta", async ({ page }) => {
    const seen = adRequests(page);
    for (const path of ["/", "/privacy"]) {
      await page.goto(`${PROD_ADS}${path}`);
      await expect(page.locator(meta)).toHaveAttribute("content", "ca-pub-1234567890123456");
      await expect(page.locator(script)).toHaveCount(0);
    }
    expect(seen).toEqual([]);
  });

  for (const [from, name, to] of [
    [GUIDE, "매매일지 카드 쓰기", "/"],
    ["/guides", "개인정보 처리방침", "/privacy"],
  ]) {
    test(`leaving ${from === GUIDE ? "a guide" : "the guide list"} by link for ${to} drops the script`, async ({ page }) => {
      adRequests(page);
      await page.goto(`${PROD_ADS}${from}`);
      await expect(page.locator(script)).toHaveCount(1);
      await page.getByRole("link", { name, exact: true }).click();
      await page.waitForURL(`${PROD_ADS}${to}`);
      await expect(page.locator(script)).toHaveCount(0);
    });
  }

  test("going back from a guide to the editor drops the script", async ({ page }) => {
    adRequests(page);
    await openEditor(page, PROD_ADS);
    await page.getByRole("link", { name: "가이드", exact: true }).click();
    await page.waitForURL("**/guides");
    await expect(page.locator(script)).toHaveCount(1);
    await page.goBack();
    await page.waitForURL(`${PROD_ADS}/`);
    await expect(page.locator(script)).toHaveCount(0);
  });

  test("client only: Auto ads on guide pages, no unit; a valid ads.txt", async ({ page, request }) => {
    const ONLY_CLIENT = "http://localhost:3107";
    adRequests(page);
    for (const path of ["/guides", GUIDE]) {
      await page.goto(`${ONLY_CLIENT}${path}`);
      await expect(page.locator(script)).toHaveCount(1);
      await expect(page.locator(meta)).toHaveCount(1);
      await expect(page.getByTestId("ad-slot")).toHaveCount(0);
      await expect(page.locator(".adsbygoogle")).toHaveCount(0);
    }
    // /send still needs a slot, as before.
    await page.goto(`${ONLY_CLIENT}/send`);
    await expect(page.locator(script)).toHaveCount(0);
    await expect(page.getByTestId("ad-slot")).toHaveCount(0);
    const res = await request.get(`${ONLY_CLIENT}/ads.txt`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    expect(await res.text()).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });

  test("the meta is in the served head, and an unknown guide is still a 404", async ({ request }) => {
    const html = await (await request.get(`${PROD_ADS}/privacy`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
    expect(html.slice(0, html.indexOf("</head>"))).toContain('name="google-adsense-account"');
    expect((await request.get(`${PROD}/guides/no-such-guide`)).status()).toBe(404);
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

test("content pages: disclaimer on every page, six guides, a finished privacy page", async ({ page }, info) => {
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
  await expect(page.getByTestId("review-note")).toHaveCount(0);
  const privacy = page.locator("main");
  await expect(privacy).not.toContainText("[확인 필요]");
  await expect(privacy).not.toContainText("초안");
  await expect(privacy).not.toContainText("Turnstile");
  await expect(privacy).toContainText("270-81-03788");
  await expect(privacy).toContainText("최대 1시간");
  await expect(privacy).toContainText("2026년 10월 31일");
  await expect(page.locator("h1")).toHaveText("주식회사 스노우볼 개인정보 처리방침");
  await expect(page.locator("#officer")).toContainText("개인정보 보호책임자: 대표이사");
  for (const id of ["#officer", "#rights"]) {
    await expect(page.locator(id)).toContainText("이메일: snowb4631@gmail.com");
  }
  await expect(page.locator('#officer a[href="mailto:snowb4631@gmail.com"]')).toHaveText("snowb4631@gmail.com");
  // Every in-page contents entry leads to a section that exists.
  const anchors = await page.locator('nav[aria-label="목차"] a').evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  expect(anchors.length).toBeGreaterThan(10);
  for (const anchor of anchors) await expect(page.locator(anchor)).toHaveCount(1);
  // Overseas transfer details the policy must carry.
  const overseas = page.locator("#overseas");
  for (const text of ["제28조의8제1항제3호", "Cloudflare, Inc.", "dpo@cloudflare.com", "Google LLC", "googlekrsupport@google.com"]) {
    await expect(overseas).toContainText(text);
  }
  await expect(page.locator("#retention")).toContainText("일수로 정한 보유 기간이 없습니다");
  await page.screenshot({ path: shot(`privacy-${info.project.name}`), fullPage: true });

  const list = "artifacts/banned-phrases.json";
  if (fs.existsSync(list)) {
    const body = (await page.content()).toLowerCase();
    for (const phrase of JSON.parse(fs.readFileSync(list, "utf8")).phrases as string[]) expect(body).not.toContain(phrase.toLowerCase());
  }
});
