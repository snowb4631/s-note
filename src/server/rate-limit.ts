import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Env } from "./env";

export type Limiter = (value: string) => Promise<boolean>;
export type Limiters = { sendIp: Limiter; sendGlobal: () => Promise<boolean>; sendRecipient: Limiter; pdfIp: Limiter };
type Config = { url: string; token: string; secret: string; dailyCap?: number; pdfHourlyLimit?: number };

export const DEFAULT_SEND_DAILY_CAP = 80;
export const DEFAULT_PDF_HOURLY_LIMIT = 10;

/** Anything but a positive whole number falls back to the default rather than removing the cap. */
export function parseDailyCap(env: Env): number {
  const raw = env.SEND_DAILY_CAP;
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : DEFAULT_SEND_DAILY_CAP;
}

/** Same rule as the daily cap: junk falls back to the default, so it can never remove the limit. */
export function parsePdfHourlyLimit(env: Env): number {
  const raw = env.PDF_HOURLY_LIMIT;
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : DEFAULT_PDF_HOURLY_LIMIT;
}

/** Redis only ever sees keyed hashes, never a raw email address or IP. */
export function hashKey(secret: string, kind: string, value: string): string {
  return createHmac("sha256", secret).update(`${kind}:${value.toLowerCase()}`).digest("hex");
}

/** Addresses that reach the same mailbox share a daily count. Used for the count only, never for sending. */
export function normalizeRecipient(email: string): string {
  const lower = email.toLowerCase();
  const at = lower.lastIndexOf("@");
  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

const REDIS_DEADLINE_MS = 5000;
const MAX_BLOCK_ENTRIES = 10_000;

export function createLimiters(config: Config): Limiters {
  const redis = new Redis({ url: config.url, token: config.token });
  // Holds identifiers that hit a limit, until their window ends: a repeat is refused without
  // a Redis command. Keys are the same hashes, and each hash already includes its limiter kind.
  const blocked = new Map<string, number>();
  const make = (kind: string, ratelimit: ReturnType<typeof Ratelimit.fixedWindow>): Limiter => {
    const limiter = new Ratelimit({
      redis,
      // fixedWindow sets the key TTL to one window, so the 1d key lives at most 24h.
      // slidingWindow keeps keys for two windows, which would break the privacy policy.
      limiter: ratelimit,
      prefix: `snote:${kind}`,
      analytics: false,
      ephemeralCache: blocked,
      // The library's own timeout ALLOWS the request when it fires. 0 disables it, and the
      // race below rejects instead, so a slow Redis fails closed.
      timeout: 0,
    });
    return async (value) => {
      // Forgetting a block only costs one more Redis call.
      if (blocked.size > MAX_BLOCK_ENTRIES) blocked.clear();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("redis-timeout")), REDIS_DEADLINE_MS);
      });
      try {
        const result = await Promise.race([limiter.limit(hashKey(config.secret, kind, value)), deadline]);
        return result.success;
      } finally {
        clearTimeout(timer);
      }
    };
  };
  const sendGlobal = make("send:all", Ratelimit.fixedWindow(config.dailyCap ?? DEFAULT_SEND_DAILY_CAP, "1 d"));
  const sendRecipient = make("send:to", Ratelimit.fixedWindow(10, "1 d"));
  return {
    sendIp: make("send:ip", Ratelimit.fixedWindow(5, "1 h")),
    sendGlobal: () => sendGlobal("all"),
    sendRecipient: (email) => sendRecipient(normalizeRecipient(email)),
    pdfIp: make("pdf:ip", Ratelimit.fixedWindow(config.pdfHourlyLimit ?? DEFAULT_PDF_HOURLY_LIMIT, "1 h")),
  };
}

const MAX_MEMORY_ENTRIES = 50_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** For a single long-running server: counts live in this process and reset on restart. */
export function createMemoryLimiters(config: { secret: string; dailyCap?: number; pdfHourlyLimit?: number; now?: () => number }): Limiters {
  const now = config.now ?? Date.now;
  const counts = new Map<string, { count: number; resetAt: number }>();
  const make = (kind: string, limit: number, windowMs: number): Limiter => async (value) => {
    const key = hashKey(config.secret, kind, value);
    const at = now();
    const entry = counts.get(key);
    if (entry && entry.resetAt > at) {
      entry.count += 1;
      return entry.count <= limit;
    }
    if (!entry && counts.size >= MAX_MEMORY_ENTRIES) {
      for (const [k, e] of counts) if (e.resetAt <= at) counts.delete(k);
      if (counts.size >= MAX_MEMORY_ENTRIES) throw new Error("rate-limit-memory-full");
    }
    const resetAt = at + windowMs;
    counts.set(key, { count: 1, resetAt });
    // The privacy policy promises the hash is gone when its window ends, even with no further traffic.
    setTimeout(() => {
      if (counts.get(key)?.resetAt === resetAt) counts.delete(key);
    }, windowMs).unref();
    return limit >= 1;
  };
  const sendGlobal = make("send:all", config.dailyCap ?? DEFAULT_SEND_DAILY_CAP, DAY_MS);
  const sendRecipient = make("send:to", 10, DAY_MS);
  return {
    sendIp: make("send:ip", 5, HOUR_MS),
    sendGlobal: () => sendGlobal("all"),
    sendRecipient: (email) => sendRecipient(normalizeRecipient(email)),
    pdfIp: make("pdf:ip", config.pdfHourlyLimit ?? DEFAULT_PDF_HOURLY_LIMIT, HOUR_MS),
  };
}

let sharedMemory: { key: string; limiters: Limiters } | null = null;

export function sharedMemoryLimiters(config: { secret: string; dailyCap?: number; pdfHourlyLimit?: number }): Limiters {
  const key = JSON.stringify([config.secret, config.dailyCap, config.pdfHourlyLimit]);
  if (sharedMemory?.key !== key) sharedMemory = { key, limiters: createMemoryLimiters(config) };
  return sharedMemory.limiters;
}

let shared: { key: string; limiters: Limiters } | null = null;

/** Routes resolve their services per request; this keeps one set, and its block cache, per instance. */
export function sharedLimiters(config: Config): Limiters {
  const key = JSON.stringify([config.url, config.token, config.secret, config.dailyCap, config.pdfHourlyLimit]);
  if (shared?.key !== key) shared = { key, limiters: createLimiters(config) };
  return shared.limiters;
}
