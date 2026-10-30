import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLimiters, sharedLimiters } from "@/server/rate-limit";

const EMAIL = "Person@Example.com";
let server: http.Server;
let url: string;
let mode: "ok" | "error" = "ok";
const counts = new Map<string, number>();
const bodies: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (mode === "error") {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "down" }));
        return;
      }
      bodies.push(body);
      // The client auto-pipelines: /pipeline takes a list of commands and answers a list.
      const commands: string[][] = JSON.parse(body);
      res.end(
        JSON.stringify(
          commands.map((command) => {
            const key = command[3];
            counts.set(key, (counts.get(key) ?? 0) + 1);
            return { result: [counts.get(key), Number(command[4])] };
          }),
        ),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
beforeEach(() => {
  counts.clear();
  bodies.length = 0;
  mode = "ok";
});

const limiters = () => createLimiters({ url, token: "t", secret: "s3cret" });

// The real @upstash/ratelimit and @upstash/redis clients against a local REST stand-in.
describe("limiters through the real client libraries", () => {
  it("IP: 5 per hour", async () => {
    const { sendIp } = limiters();
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await sendIp("203.0.113.9"));
    expect(results).toEqual([true, true, true, true, true, false]);
  });
  it("recipient: 10 per day, case-insensitive, hashed on the wire", async () => {
    const { sendRecipient } = limiters();
    const results = [];
    for (let i = 0; i < 11; i += 1) results.push(await sendRecipient(i % 2 ? EMAIL : EMAIL.toLowerCase()));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results[10]).toBe(false);
    const wire = bodies.join("").toLowerCase();
    expect(wire).toContain("snote:send:to:");
    expect(wire).not.toContain("person");
    expect(wire).not.toContain("example.com");
    // The script's PEXPIRE argument: one window, 24h.
    expect(bodies[0]).toContain(String(24 * 60 * 60 * 1000));
  });
  it("PDF: 10 per hour by default", async () => {
    const { pdfIp } = limiters();
    let passed = 0;
    for (let i = 0; i < 61; i += 1) if (await pdfIp("203.0.113.9")) passed += 1;
    expect(passed).toBe(10);
  });
  it("recipient: tag and Gmail dot variants share one quota", async () => {
    const { sendRecipient } = limiters();
    const results = [];
    for (let i = 0; i < 11; i += 1) results.push(await sendRecipient(`so.me${i % 2 ? `+t${i}` : ""}@gmail.com`.replace(".", i % 3 ? "." : "")));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results[10]).toBe(false);
  });
  it("daily cap: default 80, override honoured, one shared counter", async () => {
    const run = async (l: ReturnType<typeof limiters>, n: number) => {
      let passed = 0;
      for (let i = 0; i < n; i += 1) if (await l.sendGlobal()) passed += 1;
      return passed;
    };
    expect(await run(limiters(), 81)).toBe(80);
    counts.clear();
    expect(await run(createLimiters({ url, token: "t", secret: "s3cret", dailyCap: 3 }), 5)).toBe(3);
  });
  it("a blocked client costs no further Redis calls, and others are unaffected", async () => {
    const { sendIp } = limiters();
    for (let i = 0; i < 6; i += 1) await sendIp("203.0.113.9");
    const calls = bodies.length;
    expect(await sendIp("203.0.113.9")).toBe(false);
    expect(bodies.length).toBe(calls);
    expect(await sendIp("203.0.113.10")).toBe(true);
    expect(bodies.length).toBe(calls + 1);
  });
  it("routes share one set of limiters, and so one block cache, per instance", () => {
    const config = { url, token: "t", secret: "s3cret" };
    expect(sharedLimiters(config)).toBe(sharedLimiters({ ...config }));
    expect(sharedLimiters(config)).not.toBe(sharedLimiters({ ...config, dailyCap: 5 }));
  });
  it("Redis failure rejects rather than allowing", async () => {
    mode = "error";
    await expect(limiters().sendIp("203.0.113.9")).rejects.toThrow();
  }, 30_000);
});
