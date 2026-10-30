import { isIP } from "node:net";
import { MAX_BODY_BYTES } from "@/lib/card/schema";

export function jsonError(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ ok: false, code, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const unavailable = () => jsonError(503, "unavailable", "지금은 이 기능을 쓸 수 없습니다. 잠시 후 다시 시도해 주세요.");
export const rateLimited = (message: string) => jsonError(429, "rate_limited", message);
export const invalid = () => jsonError(422, "invalid_card", "입력한 내용을 확인해 주세요.");

/** Reads JSON with a hard byte cap, so an oversized body is never buffered in full. */
export async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const type = request.headers.get("content-type") ?? "";
  // Also keeps out cross-site HTML form posts, which cannot send this type.
  if (!type.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "unsupported_type", "요청 형식이 올바르지 않습니다.") };
  }
  const tooLarge = () => ({ ok: false as const, response: jsonError(413, "too_large", "내용이 너무 큽니다.") });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return tooLarge();
  if (!request.body) return { ok: false, response: invalid() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: invalid() };
  }
}

/** x-real-ip, then the first x-forwarded-for hop. Both are set by Vercel's edge. */
export function clientIp(headers: Headers): string {
  const candidates = [headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isIP(ip)) return ip;
  }
  return "unknown";
}

/** IPv6 clients usually control a whole /64, so that is the unit counted. IPv4-mapped addresses count as IPv4. */
export function ipRateKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail = ""] = ip.toLowerCase().split("%")[0].split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...front, ...Array(8 - front.length - back.length).fill("0"), ...back] : front;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** Only the error class name: messages can carry user input. */
export function logFailure(event: string, error: unknown): void {
  console.error(event, error instanceof Error ? error.name : "unknown");
}
