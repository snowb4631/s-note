import { describe, expect, it } from "vitest";
import { resolvePdfLimiters, resolveServices } from "@/server/handlers";
import { createMemoryLimiters } from "@/server/rate-limit";

const secret = "s".repeat(32);

async function run(limiter: () => Promise<boolean>, times: number) {
  let passed = 0;
  for (let i = 0; i < times; i++) if (await limiter()) passed += 1;
  return passed;
}

describe("memory rate limits", () => {
  it("enforces each limit", async () => {
    const l = createMemoryLimiters({ secret, dailyCap: 3 });
    expect(await run(() => l.sendIp("1.1.1.1"), 6)).toBe(5);
    expect(await run(() => l.pdfIp("1.1.1.1"), 61)).toBe(60);
    expect(await run(() => l.sendRecipient("a.b+x@gmail.com"), 6)).toBe(6);
    expect(await run(() => l.sendRecipient("ab@gmail.com"), 5)).toBe(4);
    expect(await run(() => l.sendGlobal(), 4)).toBe(3);
  });

  it("opens again when the window ends", async () => {
    let t = 0;
    const l = createMemoryLimiters({ secret, now: () => t });
    expect(await run(() => l.sendIp("ip"), 6)).toBe(5);
    t = 3_599_999;
    expect(await l.sendIp("ip")).toBe(false);
    t = 3_600_000;
    expect(await l.sendIp("ip")).toBe(true);
  });

  it("fails closed when the table is full of live entries", async () => {
    const l = createMemoryLimiters({ secret, now: () => 0 });
    for (let i = 0; i < 50_000; i++) await l.pdfIp(`ip${i}`);
    await expect(l.pdfIp("one-more")).rejects.toThrow();
  });

  it("is used only when chosen, and production still needs a long secret", () => {
    const prod = { NODE_ENV: "production" };
    expect(resolvePdfLimiters({ ...prod, RATE_LIMIT_HMAC_SECRET: secret })).toBeNull();
    expect(resolvePdfLimiters({ ...prod, RATE_LIMIT_BACKEND: "memory" })).toBeNull();
    expect(resolvePdfLimiters({ ...prod, RATE_LIMIT_BACKEND: "memory", RATE_LIMIT_HMAC_SECRET: "short" })).toBeNull();
    expect(resolvePdfLimiters({ ...prod, RATE_LIMIT_BACKEND: "memory", RATE_LIMIT_HMAC_SECRET: secret })?.limiters).toBeTruthy();
    // Memory limits alone don't make mail sendable in production.
    expect(resolveServices({ ...prod, RATE_LIMIT_BACKEND: "memory", RATE_LIMIT_HMAC_SECRET: secret })).toBeNull();
  });
});
