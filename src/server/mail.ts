import { site } from "@/lib/site";
import { type Env, isProduction } from "./env";

// Fixed on purpose. Nothing from the request may appear here: user input goes only into
// the attachment, which is what keeps this from being usable as a spam relay.
export const MAIL_SUBJECT = `[${site.name}] 요청하신 매매일지 카드입니다`;
export const MAIL_TEXT = [
  "안녕하세요.",
  "",
  `${site.name}에서 요청하신 매매일지 카드를 PDF로 첨부해 보내드립니다.`,
  `이 메일은 요청에 따라 한 번만 발송되었으며, 작성 내용은 ${site.name} 서버에 저장되지 않습니다.`,
  "본인이 요청하지 않았다면 이 메일을 삭제해 주세요.",
  "",
  site.disclaimer,
  site.url,
].join("\n");
export const MAIL_FILENAME = "snote-card.pdf";

const API_BASE = "https://api.cloudflare.com";
const SEND_TIMEOUT_MS = 15_000;
/**
 * The provider's limit is 5 MiB for the whole message. Base64 with line breaks adds about 37%,
 * so 3.5 MiB of PDF plus the fixed text stays under it with room for headers.
 */
export const MAX_PDF_BYTES = 3.5 * 1024 * 1024;

export type MailErrorCode = "rate_limited" | "too_big" | "invalid_address" | "bounced" | "unconfigured" | "failed";

/** Carries codes only: provider messages can repeat the address, so they are never kept. */
export class MailError extends Error {
  constructor(
    readonly code: MailErrorCode,
    readonly status: number | null = null,
    readonly apiCode: number | string | null = null,
  ) {
    super("mail-rejected");
    this.name = "MailError";
  }
}

export type MailResult = { status: "delivered" | "queued" };
export type SendMail = (to: string, pdf: Buffer) => Promise<MailResult>;
export type MailConfig = { accountId: string; token: string; from: string };

type ApiReply = {
  success?: unknown;
  errors?: { code?: number | string }[];
  result?: { delivered?: string[]; permanent_bounces?: string[]; queued?: string[] } | null;
};

function classify(status: number, apiCode: number | string | null): MailErrorCode {
  if (status === 429 || apiCode === 10004 || apiCode === "E_RATE_LIMIT_EXCEEDED") return "rate_limited";
  if (apiCode === 10200) return "too_big";
  if (apiCode === 10202) return "invalid_address";
  // Bad token, no entitlement, sending disabled, or a domain that is not onboarded yet.
  if (status === 401 || status === 403) return "unconfigured";
  return "failed";
}

export function createMailer(config: MailConfig, env: Env = process.env): SendMail {
  // Only local tests may point the token somewhere else.
  const base = (!isProduction(env) && env.CLOUDFLARE_API_BASE_URL) || API_BASE;
  const url = `${base}/client/v4/accounts/${encodeURIComponent(config.accountId)}/email/sending/send`;
  return async (to, pdf) => {
    if (pdf.length > MAX_PDF_BYTES) throw new MailError("too_big");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: config.from,
          subject: MAIL_SUBJECT,
          text: MAIL_TEXT,
          attachments: [{ content: pdf.toString("base64"), filename: MAIL_FILENAME, type: "application/pdf", disposition: "attachment" }],
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch {
      throw new MailError("failed");
    }
    const reply = (await res.json().catch(() => null)) as ApiReply | null;
    const apiCode = reply?.errors?.[0]?.code ?? null;
    if (!res.ok || reply?.success !== true) throw new MailError(classify(res.status, apiCode), res.status, apiCode);
    const same = (list?: string[]) => list?.some((a) => a.toLowerCase() === to.toLowerCase()) ?? false;
    if (same(reply.result?.permanent_bounces)) throw new MailError("bounced", res.status);
    return { status: same(reply.result?.delivered) ? "delivered" : "queued" };
  };
}
