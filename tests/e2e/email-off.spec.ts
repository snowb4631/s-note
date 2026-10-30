import { expect, test } from "@playwright/test";
import { emptyCard } from "../../src/lib/card/schema";

const OFF = "http://localhost:3106";

test("email off: no button, /send redirects home, the API refuses neutrally", async ({ page, request }) => {
  await page.goto(OFF);
  await page.getByPlaceholder("종목 이름").fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByRole("button", { name: "PDF 다운로드" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /이메일/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("미구현");
  await expect(page.locator("footer")).not.toContainText("발송 대행사");
  await page.screenshot({ path: `artifacts/e2e/preview-buttons-email-off-${test.info().project.name}.png`, fullPage: true });

  await page.goto(`${OFF}/send`);
  await expect(page).toHaveURL(`${OFF}/`);
  await expect(page.locator("input[type=email]")).toHaveCount(0);

  const res = await request.post(`${OFF}/api/send`, {
    data: { card: emptyCard("2026-10-30"), email: "me@example.com", turnstileToken: "x" },
  });
  expect(res.status()).toBe(503);
  const body = await res.json();
  expect(body.code).toBe("not_implemented");
  expect(JSON.stringify(body)).toContain("지금은 제공하지 않는 기능입니다.");
});

test("email on: the footer still names the mail provider's retention", async ({ page }) => {
  await page.goto("http://localhost:3101/privacy");
  await expect(page.locator("footer")).toContainText("발송 대행사");
});
