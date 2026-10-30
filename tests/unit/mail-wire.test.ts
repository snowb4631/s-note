import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCard } from "@/lib/card/schema";
import { handleSend } from "@/server/handlers";
import { MAIL_SUBJECT, MAIL_TEXT, MAX_PDF_BYTES, createMailer } from "@/server/mail";

let server: http.Server;
let base: string;
let reply: { status: number; body: unknown };
const received: { url?: string; auth?: string; body: Record<string, unknown> }[] = [];
const ok = (result = {}) => ({ success: true, errors: [], messages: [], result: { delivered: ["me@example.com"], permanent_bounces: [], queued: [], ...result } });
const failed = (code: number) => ({ success: false, errors: [{ code, message: "x" }], messages: [], result: null });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.statusCode = reply.status;
      res.setHeader("content-type", "application/json");
      res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
beforeEach(() => {
  received.length = 0;
  reply = { status: 200, body: ok() };
});

const mailer = () => createMailer({ accountId: "acc1", token: "tok1", from: "no-reply@example.com" }, { CLOUDFLARE_API_BASE_URL: base });
const send = () => mailer()("me@example.com", Buffer.from("%PDF"));

// Real fetch against a local stand-in: what actually goes out on the wire.
describe("mailer", () => {
  it("sends only fixed text, one recipient and the PDF, in the documented shape", async () => {
    const pdf = Buffer.from("%PDF-1.3 test");
    await expect(mailer()("me@example.com", pdf)).resolves.toEqual({ status: "delivered" });
    const { url, auth, body } = received[0];
    expect(url).toBe("/client/v4/accounts/acc1/email/sending/send");
    expect(auth).toBe("Bearer tok1");
    expect(body).toEqual({
      to: "me@example.com",
      from: "no-reply@example.com",
      subject: MAIL_SUBJECT,
      text: MAIL_TEXT,
      attachments: [{ content: pdf.toString("base64"), filename: "snote-card.pdf", type: "application/pdf", disposition: "attachment" }],
    });
  });
  it("reports a queued message", async () => {
    reply.body = ok({ delivered: [], queued: ["me@example.com"] });
    await expect(send()).resolves.toEqual({ status: "queued" });
  });
  it.each([
    ["success false on 200", 200, { success: false, errors: [], result: null }, "failed"],
    ["non-2xx", 500, failed(10002), "failed"],
    ["non-JSON", 200, "<html>", "failed"],
    ["429", 429, failed(10004), "rate_limited"],
    ["the rate limit code on another status", 400, { success: false, errors: [{ code: "E_RATE_LIMIT_EXCEEDED" }] }, "rate_limited"],
    ["too big", 400, failed(10200), "too_big"],
    ["email.invalid", 400, failed(10202), "invalid_address"],
    ["bad token", 401, failed(10101), "unconfigured"],
    ["not onboarded or not entitled", 403, failed(10105), "unconfigured"],
    ["permanent bounce", 200, ok({ delivered: [], permanent_bounces: ["ME@example.com"] }), "bounced"],
  ])("%s is a failure", async (_name, status, body, code) => {
    reply = { status, body };
    await expect(send()).rejects.toMatchObject({ name: "MailError", code });
  });
  it("email.invalid reaches the user as 422 asking to check the address, not a retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reply = { status: 400, body: failed(10202) };
    const request = new Request("http://test/api/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card: { ...emptyCard("2026-10-30"), ticker: "가" }, email: "me@example.com", turnstileToken: "t" }),
    });
    const res = await handleSend(request, { verifyBot: null, limiters: null, sendMail: mailer() }, async () => Buffer.from("%PDF"));
    expect(res.status).toBe(422);
    const { message } = await res.json();
    expect(message).toContain("주소를 확인");
    expect(message).not.toContain("다시 시도");
    vi.restoreAllMocks();
  });
  it("another address bouncing is not this recipient's failure", async () => {
    reply.body = ok({ permanent_bounces: ["other@example.com"] });
    await expect(send()).resolves.toEqual({ status: "delivered" });
  });
  it("a network failure is a failure", async () => {
    const down = createMailer({ accountId: "a", token: "t", from: "f@example.com" }, { CLOUDFLARE_API_BASE_URL: "http://127.0.0.1:9" });
    await expect(down("me@example.com", Buffer.from("x"))).rejects.toMatchObject({ code: "failed" });
  });
  it("a PDF that would pass the 5 MiB message limit is refused before any request", async () => {
    await expect(mailer()("me@example.com", Buffer.alloc(MAX_PDF_BYTES + 1))).rejects.toMatchObject({ code: "too_big" });
    expect(received).toHaveLength(0);
    // Base64 with line breaks plus the fixed text and headers still fits at the limit.
    expect((MAX_PDF_BYTES * 4) / 3 * (78 / 76) + 16_384).toBeLessThan(5 * 1024 * 1024);
  });
  it("production ignores the base URL override, so the token only goes to Cloudflare", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(ok())));
    await createMailer({ accountId: "a", token: "t", from: "f@example.com" }, { NODE_ENV: "production", CLOUDFLARE_API_BASE_URL: base })("me@example.com", Buffer.from("x"));
    expect(String(spy.mock.calls[0][0])).toBe("https://api.cloudflare.com/client/v4/accounts/a/email/sending/send");
    spy.mockRestore();
  });
});
