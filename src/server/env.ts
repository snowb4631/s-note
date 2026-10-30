export type Env = Record<string, string | undefined>;

export const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Email stays hidden until real sending is verified. */
export const emailEnabled = (env: Env) => env.EMAIL_SENDING_ENABLED === "true";

/** Cloudflare's published Turnstile test keys: 1x/2x/3x, zeros, then two letters. */
export const isTurnstileTestKey = (key: string) => /^[123]x0+[A-Z]{2}$/.test(key);

export const MIN_HMAC_SECRET_CHARS = 32;

/** A valid client alone is enough for Auto ads; a manual unit also needs a valid slot. */
export function adConfig(env: Env): { client: string; slot: string | null } | null {
  const client = env.ADSENSE_CLIENT;
  const slot = env.ADSENSE_SLOT;
  // These end up in a script URL and page attributes.
  if (!client || !/^ca-pub-\d{6,20}$/.test(client)) return null;
  return { client, slot: slot && /^\d{4,20}$/.test(slot) ? slot : null };
}
