import { expect, test } from "@playwright/test";
import { openEditor } from "./helpers";

// Optional, needs network and a server started with Cloudflare's public test keys:
//   TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=<test secret> npx next dev -p 3100
// Run with SNOTE_TURNSTILE_LIVE=pass|fail, matching the test secret in use.
const live = process.env.SNOTE_TURNSTILE_LIVE;

test("real widget and real siteverify with public test keys", async ({ page }) => {
  test.skip(!live, "set SNOTE_TURNSTILE_LIVE");
  await openEditor(page);
  await page.getByRole("textbox", { name: "종목" }).fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "이메일로 받기" }).click();
  await page.waitForURL("**/send");
  await page.getByLabel("받을 이메일 주소").fill("me@example.com");
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value, null, { timeout: 30_000 });
  await page.getByTestId("send-button").click();
  if (live === "pass") {
    await expect(page.getByTestId("send-done")).toContainText("개발 모드");
    await expect(page.getByTestId("send-done")).not.toContainText("turnstile");
  } else {
    await expect(page.locator('main [role="alert"]')).toContainText("봇 확인");
  }
});
