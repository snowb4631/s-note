import { describe, expect, it, vi } from "vitest";
import { resolvePdfLimiters, resolveServices } from "@/server/handlers";
import { createMemoryLimiters, parsePdfHourlyLimit } from "@/server/rate-limit";

const secret = "s".repeat(32);

async function run(limiter: () => Promise<boolean>, times: number) {
  let passed = 0;
  for (let i = 0; i < times; i++) if (await limiter()) passed += 1;
  return passed;
}

describe("memory rate limits", () => {
  it("forgets an IP's hash when the hour ends, even with no further requests", async () => {
    vi.useFakeTimers();
    const deleted = vi.spyOn(Map.prototype, "delete");
    const hashDeleted = () => deleted.mock.calls.some(([key]) => /^[0-9a-f]{64}$/.test(String(key)));
    try {
      const l = createMemoryLimiters({ secret });
      await l.pdfIp("1.1.1.1");
      vi.advanceTimersByTime(3_599_999);
      expect(hashDeleted()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(hashDeleted()).toBe(true);
    } finally {
      deleted.mockRestore();
      vi.useRealTimers();
    }
  });

  it("enforces each limit", async () => {
    const l = createMemoryLimiters({ secret, dailyCap: 3 });
    expect(await run(() => l.sendIp("1.1.1.1"), 6)).toBe(5);
    expect(await run(() => l.pdfIp("1.1.1.1"), 11)).toBe(10);
    expect(await run(() => l.sendRecipient("a.b+x@gmail.com"), 6)).toBe(6);
    expect(await run(() => l.sendRecipient("ab@gmail.com"), 5)).toBe(4);
    expect(await run(() => l.sendGlobal(), 4)).toBe(3);
  });

  it("PDF limit is configurable", async () => {
    const l = createMemoryLimiters({ secret, pdfHourlyLimit: 3 });
    expect(await run(() => l.pdfIp("ip"), 5)).toBe(3);
    expect(parsePdfHourlyLimit({})).toBe(10);
    expect(parsePdfHourlyLimit({ PDF_HOURLY_LIMIT: "25" })).toBe(25);
    for (const bad of ["", "0", "-1", "1e9", "abc"]) expect(parsePdfHourlyLimit({ PDF_HOURLY_LIMIT: bad })).toBe(10);
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
