export type Env = Record<string, string | undefined>;

export const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Cloudflare's published Turnstile test keys: 1x/2x/3x, zeros, then two letters. */
export const isTurnstileTestKey = (key: string) => /^[123]x0+[A-Z]{2}$/.test(key);

export const MIN_HMAC_SECRET_CHARS = 32;

export function adConfig(env: Env): { client: string; slot: string } | null {
  const client = env.ADSENSE_CLIENT;
  const slot = env.ADSENSE_SLOT;
  if (!client || !slot) return null;
  // These end up in a script URL and page attributes.
  if (!/^ca-pub-\d{6,20}$/.test(client) || !/^\d{4,20}$/.test(slot)) return null;
  return { client, slot };
}
