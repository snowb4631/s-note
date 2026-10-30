import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, emptyCard } from "@/lib/card/schema";
import { clientIp, ipRateKey } from "@/server/http";
import { MAIL_FILENAME, MAIL_SUBJECT, MAIL_TEXT, MailError, type MailErrorCode } from "@/server/mail";
import { DEFAULT_SEND_DAILY_CAP, hashKey, normalizeRecipient, parseDailyCap } from "@/server/rate-limit";
import { handlePdf, handleSend, resolvePdfLimiters, resolveServices, type Services } from "@/server/handlers";
import { verifyTurnstile } from "@/server/turnstile";

const EMAIL = "secret.person@example.com";
const SECRET_TEXT = "비밀스러운 매매 이유";

function card() {
  const c = emptyCard("2026-10-30");
  return { ...c, ticker: "비밀종목", reason: { ...c.reason, text: SECRET_TEXT } };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://test/api/send", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = () => ({ card: card(), email: EMAIL, turnstileToken: "tok" });

function harness(over: Partial<{ bot: boolean | Error; ip: boolean | Error; cap: boolean | Error; to: boolean | Error; mail: Error; render: Error }> = {}) {
  const calls: string[] = [];
  const step = (name: string, value: boolean | Error | undefined) => async () => {
    calls.push(name);
    if (value instanceof Error) throw value;
    return value ?? true;
  };
  const sendMail = vi.fn(async () => {
    calls.push("mail");
    if (over.mail) throw over.mail;
    return { status: "delivered" as const };
  });
  const render = vi.fn(async () => {
    calls.push("render");
    if (over.render) throw over.render;
    return Buffer.from("%PDF");
  });
  const services: Services = {
    verifyBot: step("bot", over.bot),
    limiters: { sendIp: step("ip", over.ip), sendGlobal: step("cap", over.cap), sendRecipient: step("to", over.to), pdfIp: step("pdfIp", true) },
    sendMail,
  };
  return { calls, services, sendMail, render };
}

let errorLog: ReturnType<typeof vi.spyOn>;
let plainLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  plainLog = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  const logged = JSON.stringify([...errorLog.mock.calls, ...plainLog.mock.calls]);
  // Applies to every test in this file, failure paths included.
  expect(logged).not.toContain(EMAIL);
  expect(logged).not.toContain(SECRET_TEXT);
  vi.restoreAllMocks();
});

describe("/api/send order and rejections", () => {
  it("runs validate, bot, rate limit, render, mail in that order", async () => {
    const h = harness();
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, delivered: true });
    expect(h.calls).toEqual(["bot", "ip", "to", "cap", "render", "mail"]);
    expect(h.sendMail).toHaveBeenCalledWith(EMAIL, expect.any(Buffer));
  });

  it("invalid input stops before the bot check", async () => {
    const h = harness();
    const res = await handleSend(post({ ...valid(), email: "a@b.com\r\nBcc: x@y.com" }), h.services, h.render);
    expect(res.status).toBe(422);
    expect(h.calls).toEqual([]);
  });

  it("a client-supplied PDF is refused", async () => {
    const h = harness();
    const res = await handleSend(post({ ...valid(), pdf: "JVBERi0=" }), h.services, h.render);
    expect(res.status).toBe(422);
    expect(h.calls).toEqual([]);
  });

  it("a remote image URL is refused before anything else runs", async () => {
    const h = harness();
    const res = await handleSend(post({ ...valid(), card: { ...card(), image: "http://169.254.169.254/" } }), h.services, h.render);
    expect(res.status).toBe(422);
    expect(h.calls).toEqual([]);
  });

  it("bot failure: no rate-limit use, no render, no mail", async () => {
    const h = harness({ bot: false });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(403);
    expect(h.calls).toEqual(["bot"]);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("bot service outage fails closed", async () => {
    const h = harness({ bot: new Error("down") });
    expect((await handleSend(post(valid()), h.services, h.render)).status).toBe(503);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("IP limit: no recipient use, no render, no mail", async () => {
    const h = harness({ ip: false });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(429);
    expect(h.calls).toEqual(["bot", "ip"]);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("daily cap: checked last, so the recipient's quota is already used", async () => {
    const h = harness({ cap: false });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("모두 소진");
    expect(h.calls).toEqual(["bot", "ip", "to", "cap"]);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("daily cap store failure fails closed", async () => {
    const h = harness({ cap: new Error("redis down") });
    expect((await handleSend(post(valid()), h.services, h.render)).status).toBe(503);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("a blank card is refused before anything else runs", async () => {
    const h = harness();
    const res = await handleSend(post({ ...valid(), card: emptyCard("2026-10-30") }), h.services, h.render);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("blank_card");
    expect(h.calls).toEqual([]);
  });

  it("recipient limit: no global slot used, no render, no mail", async () => {
    const h = harness({ to: false });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("이 주소로");
    expect(h.calls).toEqual(["bot", "ip", "to"]);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("Redis failure fails closed", async () => {
    const h = harness({ ip: new Error("redis down") });
    expect((await handleSend(post(valid()), h.services, h.render)).status).toBe(503);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("render failure sends nothing and logs no content", async () => {
    const h = harness({ render: new Error(`boom ${SECRET_TEXT} ${EMAIL}`) });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(500);
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("mail failure reports 502 and logs no address", async () => {
    const h = harness({ mail: new Error(`bad ${EMAIL}`) });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(EMAIL);
    expect(errorLog).toHaveBeenCalled();
  });

  it.each<[MailErrorCode, number, string]>([
    ["rate_limited", 429, "잠시 후 다시 시도"],
    ["too_big", 413, "용량"],
    ["invalid_address", 422, "주소를 확인"],
    ["bounced", 422, "주소를 확인"],
    ["unconfigured", 502, "발신 설정"],
    ["failed", 502, "보내지 못했습니다"],
  ])("provider failure %s reaches the user as clean Korean", async (code, status, text) => {
    const h = harness({ mail: new MailError(code, 400, 10001) });
    const res = await handleSend(post(valid()), h.services, h.render);
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.message).toContain(text);
    expect(body.message.replaceAll("PDF", "")).not.toMatch(/[A-Za-z]/);
  });

  it("refuses oversized bodies, by header and by actual stream size", async () => {
    const h = harness();
    const big = post(valid(), { "content-length": String(MAX_BODY_BYTES + 1) });
    expect((await handleSend(big, h.services, h.render)).status).toBe(413);
    const stream = post("x".repeat(MAX_BODY_BYTES + 1));
    expect((await handleSend(stream, h.services, h.render)).status).toBe(413);
    expect(h.calls).toEqual([]);
  });

  it("refuses non-JSON content types and broken JSON", async () => {
    const h = harness();
    expect((await handleSend(post(valid(), { "content-type": "text/plain" }), h.services, h.render)).status).toBe(415);
    expect((await handleSend(post("{nope"), h.services, h.render)).status).toBe(422);
  });
});

describe("mail content", () => {
  it("is fixed: no user input, has the disclaimer", () => {
    const all = MAIL_SUBJECT + MAIL_TEXT + MAIL_FILENAME;
    for (const s of [EMAIL, SECRET_TEXT, "비밀종목"]) expect(all).not.toContain(s);
    expect(MAIL_TEXT).toContain("투자 권유가 아닙니다");
  });
  it("is the same module constant given to the provider, with only the address and PDF as input", async () => {
    const source = (await import("node:fs")).readFileSync("src/server/mail.ts", "utf8");
    expect(source).toMatch(/subject: MAIL_SUBJECT/);
    expect(source).toMatch(/text: MAIL_TEXT/);
    expect(source).toMatch(/\(to, pdf\)/);
  });
});

describe("configuration", () => {
  const full = {
    NODE_ENV: "production",
    TURNSTILE_SECRET_KEY: "a",
    TURNSTILE_SITE_KEY: "b",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "c",
    RATE_LIMIT_HMAC_SECRET: "d".repeat(32),
    CLOUDFLARE_ACCOUNT_ID: "acc",
    CLOUDFLARE_EMAIL_API_TOKEN: "tok",
    MAIL_FROM: "no-reply@example.com",
  };
  it.each(Object.keys(full).filter((k) => k !== "NODE_ENV"))("production without %s fails closed", async (key) => {
    const env = { ...full, [key]: undefined };
    expect(resolveServices(env)).toBeNull();
    const h = harness();
    expect((await handleSend(post(valid()), resolveServices(env), h.render)).status).toBe(503);
    expect(h.calls).toEqual([]);
  });
  it("production with everything set resolves all services", () => {
    const s = resolveServices(full)!;
    expect(s.verifyBot && s.limiters && s.sendMail).toBeTruthy();
  });
  it.each(["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"])("production refuses the test secret %s", (key) => {
    expect(resolveServices({ ...full, TURNSTILE_SECRET_KEY: key })).toBeNull();
    expect(resolveServices({ ...full, NODE_ENV: "development", TURNSTILE_SECRET_KEY: key })).not.toBeNull();
  });
  it("production refuses the test site key", () => {
    expect(resolveServices({ ...full, TURNSTILE_SITE_KEY: "1x00000000000000000000AA" })).toBeNull();
  });
  it("production refuses a short HMAC secret, on both routes", () => {
    const env = { ...full, RATE_LIMIT_HMAC_SECRET: "d".repeat(31) };
    expect(resolveServices(env)).toBeNull();
    expect(resolvePdfLimiters(env)).toBeNull();
    expect(resolvePdfLimiters(full)).not.toBeNull();
  });
  it("SEND_DAILY_CAP overrides the default of 80, and junk cannot remove the cap", () => {
    expect(DEFAULT_SEND_DAILY_CAP).toBe(80);
    expect(parseDailyCap({})).toBe(80);
    expect(parseDailyCap({ SEND_DAILY_CAP: "200" })).toBe(200);
    for (const bad of ["", "0", "-1", "1e9", "abc"]) expect(parseDailyCap({ SEND_DAILY_CAP: bad })).toBe(80);
  });
  it("/api/pdf fails closed in production without Redis", async () => {
    const h = harness();
    const none = resolvePdfLimiters({ NODE_ENV: "production" });
    expect(none).toBeNull();
    expect((await handlePdf(post(card()), none, h.render)).status).toBe(503);
  });
  it("development skips mail and says so", async () => {
    const h = harness();
    const services = resolveServices({ NODE_ENV: "development" })!;
    const res = await handleSend(post(valid()), services, h.render);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      delivered: false,
      devMode: true,
      skipped: ["mail", "turnstile", "rate_limit"],
    });
    expect(h.calls).toEqual(["render"]);
  });
});

describe("/api/pdf", () => {
  it("validates before limiting, limits before rendering", async () => {
    const h = harness();
    expect((await handlePdf(post({ nope: 1 }), { limiters: h.services.limiters }, h.render)).status).toBe(422);
    expect(h.calls).toEqual([]);
    const res = await handlePdf(post(card()), { limiters: h.services.limiters }, h.render);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(h.calls).toEqual(["pdfIp", "render"]);
  });
  it("limit exceeded means no render", async () => {
    const h = harness();
    const limiters = { ...h.services.limiters!, pdfIp: async () => false };
    expect((await handlePdf(post(card()), { limiters }, h.render)).status).toBe(429);
    expect(h.render).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("the recipient key is an HMAC, not the address", () => {
    const key = hashKey("s3cret", "send:to", EMAIL);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("secret.person");
    expect(key).toBe(hashKey("s3cret", "send:to", EMAIL.toUpperCase()));
    expect(key).not.toBe(hashKey("other", "send:to", EMAIL));
  });
  it("reads the client IP from x-real-ip, then first x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "9.9.9.9" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "x-forwarded-for": " 198.51.100.2 , 10.0.0.1" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers({ "x-real-ip": "<junk>" }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("rate-limit IP key: IPv6 counts per /64, IPv4 and mapped addresses as themselves", () => {
    expect(ipRateKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:0DB8:0001:0002:0:0:0:9")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipRateKey("::1")).toBe("0:0:0:0::/64");
    expect(ipRateKey("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(ipRateKey("198.51.100.7")).toBe("198.51.100.7");
    expect(ipRateKey("unknown")).toBe("unknown");
  });
  it("two addresses in one /64 use the same IP counter", async () => {
    const h = harness();
    const seen: string[] = [];
    const limiters = { ...h.services.limiters!, sendIp: async (ip: string) => (seen.push(ip), true) };
    await handleSend(post(valid(), { "x-real-ip": "2001:db8:1:2::a" }), { ...h.services, limiters }, h.render);
    await handleSend(post(valid(), { "x-real-ip": "2001:db8:1:2::b" }), { ...h.services, limiters }, h.render);
    expect(new Set(seen).size).toBe(1);
  });
  it("recipient key: same mailbox, same key; different mailbox, different key", () => {
    expect(normalizeRecipient("Some.One+news@GMail.com")).toBe("someone@gmail.com");
    expect(normalizeRecipient("some.one@googlemail.com")).toBe("someone@gmail.com");
    expect(normalizeRecipient("Some.One+x@naver.com")).toBe("some.one@naver.com");
    expect(normalizeRecipient("+only@example.com")).toBe("+only@example.com");
    expect(normalizeRecipient("a.b@naver.com")).not.toBe(normalizeRecipient("ab@naver.com"));
  });
  it("turnstile: a token from another hostname does not count", async () => {
    const reply = (hostname?: string) => (async () => new Response(JSON.stringify({ success: true, hostname }))) as typeof fetch;
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply("snote.stock-snow.com"), "snote.stock-snow.com")).toBe(true);
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply("evil.example"), "snote.stock-snow.com")).toBe(false);
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply(), "snote.stock-snow.com")).toBe(false);
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply("example.com"), null)).toBe(true);
  });
  it("turnstile: only literal success passes; outage throws", async () => {
    const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply({ success: true }))).toBe(true);
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply({ success: false }))).toBe(false);
    expect(await verifyTurnstile("s", "t", "1.1.1.1", reply({ success: "true" }))).toBe(false);
    expect(await verifyTurnstile("s", "", "1.1.1.1", reply({ success: true }))).toBe(false);
    await expect(verifyTurnstile("s", "t", "1.1.1.1", reply({}, 500))).rejects.toThrow();
  });
});
