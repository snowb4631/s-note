import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Env } from "./env";

export type Limiter = (value: string) => Promise<boolean>;
export type Limiters = { sendIp: Limiter; sendGlobal: () => Promise<boolean>; sendRecipient: Limiter; pdfIp: Limiter };
type Config = { url: string; token: string; secret: string; dailyCap?: number };

export const DEFAULT_SEND_DAILY_CAP = 80;

/** Anything but a positive whole number falls back to the default rather than removing the cap. */
export function parseDailyCap(env: Env): number {
  const raw = env.SEND_DAILY_CAP;
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : DEFAULT_SEND_DAILY_CAP;
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
    pdfIp: make("pdf:ip", Ratelimit.fixedWindow(60, "1 h")),
  };
}

let shared: { key: string; limiters: Limiters } | null = null;

/** Routes resolve their services per request; this keeps one set, and its block cache, per instance. */
export function sharedLimiters(config: Config): Limiters {
  const key = JSON.stringify([config.url, config.token, config.secret, config.dailyCap]);
  if (shared?.key !== key) shared = { key, limiters: createLimiters(config) };
  return shared.limiters;
}
