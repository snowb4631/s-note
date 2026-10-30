const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Resolves to the verdict. Network or server trouble throws, and the caller fails closed.
 * With expectedHost, a token solved on another site does not count.
 */
export async function verifyTurnstile(secret: string, token: string, ip: string, fetchImpl: typeof fetch = fetch, expectedHost: string | null = null): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  const res = await fetchImpl(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("turnstile-unavailable");
  const data = (await res.json()) as { success?: unknown; hostname?: unknown };
  if (data.success !== true) return false;
  return expectedHost === null || (typeof data.hostname === "string" && data.hostname.toLowerCase() === expectedHost);
}
