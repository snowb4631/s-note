import { execFile } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { adConfig } from "@/server/env";
import nextConfig from "../../next.config";

const run = promisify(execFile);

describe("next.config", () => {
  it("sends the CSP on every path", async () => {
    const [rule] = await nextConfig.headers!();
    expect(rule.source).toBe("/:path*");
    const csp = rule.headers.find((h) => h.key === "Content-Security-Policy")?.value;
    expect(csp).toBe("base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
  });
});

describe("adConfig", () => {
  const client = "ca-pub-1234567890123456";
  it("needs only a valid client; a bad or missing slot just means no manual unit", () => {
    expect(adConfig({})).toBeNull();
    expect(adConfig({ ADSENSE_SLOT: "1234567890" })).toBeNull();
    expect(adConfig({ ADSENSE_CLIENT: 'ca-pub-1"><script>' })).toBeNull();
    expect(adConfig({ ADSENSE_CLIENT: client })).toEqual({ client, slot: null });
    expect(adConfig({ ADSENSE_CLIENT: client, ADSENSE_SLOT: "x" })).toEqual({ client, slot: null });
    expect(adConfig({ ADSENSE_CLIENT: client, ADSENSE_SLOT: "1234567890" })).toEqual({ client, slot: "1234567890" });
  });
});

// Against a local stand-in only.
describe("smoke script", () => {
  const smoke = async (reply: { status: number; body: unknown }, args = ["me@example.com"]) => {
    const seen: { url?: string; body?: string }[] = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ url: req.url, body });
        res.statusCode = reply.status;
        res.end(JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const env = {
      PATH: process.env.PATH,
      CLOUDFLARE_API_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_EMAIL_API_TOKEN: "secret-token-value",
      MAIL_FROM: "no-reply@example.com",
    };
    try {
      const out = await run("node", ["scripts/send-test-mail.mjs", ...args], { env: env as unknown as NodeJS.ProcessEnv }).then(
        (r) => ({ code: 0, stdout: r.stdout, stderr: r.stderr }),
        (e) => ({ code: e.code as number, stdout: e.stdout as string, stderr: e.stderr as string }),
      );
      return { ...out, seen };
    } finally {
      server.closeAllConnections();
      server.close();
    }
  };

  it("renders a real PDF, sends once, prints only the status", async () => {
    const r = await smoke({ status: 200, body: { success: true, errors: [], result: { delivered: ["me@example.com"], permanent_bounces: [], queued: [] } } });
    expect(r).toMatchObject({ code: 0, stdout: "delivered\n" });
    expect(r.seen).toHaveLength(1);
    const body = JSON.parse(r.seen[0].body!);
    expect(Buffer.from(body.attachments[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("prints only the error, never the token", async () => {
    const r = await smoke({ status: 403, body: { success: false, errors: [{ code: 10105, message: "x" }], result: null } });
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("unconfigured http=403 api=10105");
    expect(r.stderr).not.toContain("secret-token-value");
  });
  it("refuses to run without a recipient", async () => {
    const r = await smoke({ status: 200, body: {} }, []);
    expect(r.code).toBe(2);
    expect(r.seen).toHaveLength(0);
  });
});
