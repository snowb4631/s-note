import { expect, test } from "@playwright/test";
import { emptyCard } from "../../src/lib/card/schema";

const OFF = "http://localhost:3106";

test("email off: button is marked 미구현, /send explains, the API refuses", async ({ page, request }) => {
  await page.goto(OFF);
  await page.getByPlaceholder("종목 이름").fill("예시전자");
  await page.getByRole("button", { name: "미리보기" }).click();
  const button = page.getByRole("button", { name: "이메일로 받기 (미구현)" });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(page.getByRole("button", { name: "PDF 다운로드" })).toBeEnabled();

  await page.goto(`${OFF}/send`);
  await expect(page.getByTestId("email-off")).toContainText("미구현");
  await expect(page.locator("input[type=email]")).toHaveCount(0);

  const res = await request.post(`${OFF}/api/send`, {
    data: { card: emptyCard("2026-10-30"), email: "me@example.com", turnstileToken: "x" },
  });
  expect(res.status()).toBe(503);
  expect((await res.json()).code).toBe("not_implemented");
});
