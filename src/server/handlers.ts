import type { Card } from "@/lib/card/schema";
import { cardSchema, isBlankCard, sendSchema } from "@/lib/card/schema";
import { site } from "@/lib/site";
import { type Env, MIN_HMAC_SECRET_CHARS, isProduction, isTurnstileTestKey } from "./env";
import { clientIp, invalid, ipRateKey, jsonError, logFailure, rateLimited, readJson, unavailable } from "./http";
import type { MailErrorCode, SendMail } from "./mail";
import { MailError, createMailer } from "./mail";
import { type Limiters, parseDailyCap, parsePdfHourlyLimit, sharedLimiters, sharedMemoryLimiters } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

export type RenderPdf = (card: Card) => Promise<Buffer>;

export type Services = {
  /** null means skipped, which only development allows. */
  verifyBot: ((token: string, ip: string) => Promise<boolean>) | null;
  limiters: Limiters | null;
  sendMail: SendMail | null;
};

/** Memory counts only hold on one long-running instance, so it must be chosen explicitly. */
function configuredLimiters(env: Env): Limiters | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token, RATE_LIMIT_HMAC_SECRET: secret } = env;
  if (!secret) return null;
  const limits = { dailyCap: parseDailyCap(env), pdfHourlyLimit: parsePdfHourlyLimit(env) };
  if (env.RATE_LIMIT_BACKEND === "memory") return sharedMemoryLimiters({ secret, ...limits });
  return url && token ? sharedLimiters({ url, token, secret, ...limits }) : null;
}

/** null when production is missing configuration or runs on test values: the caller must fail closed. */
export function resolveServices(env: Env): Services | null {
  const { TURNSTILE_SECRET_KEY: bot, TURNSTILE_SITE_KEY: botSite, RATE_LIMIT_HMAC_SECRET: secret, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_EMAIL_API_TOKEN: mailToken, MAIL_FROM: from } = env;
  const production = isProduction(env);
  const limiters = configuredLimiters(env);
  if (production) {
    if (!(bot && botSite && limiters && secret && accountId && mailToken && from)) return null;
    if (isTurnstileTestKey(bot) || isTurnstileTestKey(botSite) || secret.length < MIN_HMAC_SECRET_CHARS) return null;
  }
  // Test keys answer with their own hostname, and production has just refused them.
  const expectedHost = production ? new URL(site.url).hostname : null;
  return {
    verifyBot: bot ? (t, ip) => verifyTurnstile(bot, t, ip, fetch, expectedHost) : null,
    limiters,
    sendMail: accountId && mailToken && from ? createMailer({ accountId, token: mailToken, from }, env) : null,
  };
}

/** /api/pdf only needs rate limits, so a missing mail key does not take down downloads. */
export function resolvePdfLimiters(env: Env): { limiters: Limiters | null } | null {
  if (isProduction(env) && (env.RATE_LIMIT_HMAC_SECRET?.length ?? 0) < MIN_HMAC_SECRET_CHARS) return null;
  const limiters = configuredLimiters(env);
  if (limiters) return { limiters };
  return isProduction(env) ? null : { limiters: null };
}

const MAIL_MESSAGES: Record<MailErrorCode, { status: number; message: string }> = {
  rate_limited: { status: 429, message: "메일 발송 요청이 많아 지금은 보낼 수 없습니다. 잠시 후 다시 시도해 주세요." },
  too_big: { status: 413, message: "PDF 용량이 커서 메일로 보낼 수 없습니다. 이미지나 필기를 줄이거나 PDF를 내려받아 주세요." },
  invalid_address: { status: 422, message: "이메일 주소가 올바르지 않습니다. 주소를 확인해 주세요." },
  bounced: { status: 422, message: "이 주소로는 메일을 보낼 수 없습니다. 주소를 확인해 주세요." },
  unconfigured: { status: 502, message: "메일 발신 설정이 끝나지 않아 지금은 보낼 수 없습니다. PDF를 내려받아 주세요." },
  failed: { status: 502, message: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
};

export async function handlePdf(request: Request, services: { limiters: Limiters | null } | null, render: RenderPdf): Promise<Response> {
  if (!services) return unavailable();
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = cardSchema.safeParse(body.value);
  if (!parsed.success) return invalid();
  try {
    if (services.limiters && !(await services.limiters.pdfIp(ipRateKey(clientIp(request.headers))))) {
      return rateLimited("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }
  } catch (error) {
    logFailure("pdf_rate_limit_failed", error);
    return unavailable();
  }
  try {
    const pdf = await render(parsed.data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="snote-card.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logFailure("pdf_render_failed", error);
    return jsonError(500, "render_failed", "PDF를 만들지 못했습니다.");
  }
}

/** Order is the contract: validate, bot check, rate limit, render, send. */
export async function handleSend(request: Request, services: Services | null, render: RenderPdf): Promise<Response> {
  if (!services) return unavailable();

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = sendSchema.safeParse(body.value);
  if (!parsed.success) return invalid();
  const { card, email, turnstileToken } = parsed.data;
  if (isBlankCard(card)) return jsonError(422, "blank_card", "보낼 내용이 없습니다. 카드를 작성한 뒤 다시 시도해 주세요.");
  const ip = clientIp(request.headers);

  try {
    if (services.verifyBot && !(await services.verifyBot(turnstileToken, ip))) {
      return jsonError(403, "bot_check_failed", "봇 확인을 통과하지 못했습니다. 다시 시도해 주세요.");
    }
  } catch (error) {
    logFailure("turnstile_failed", error);
    return unavailable();
  }

  try {
    if (services.limiters) {
      if (!(await services.limiters.sendIp(ipRateKey(ip)))) {
        return rateLimited("이 네트워크에서 보낸 요청이 너무 많습니다. 한 시간 뒤 다시 시도해 주세요.");
      }
      // Recipient first: a request it refuses must not use up a global slot.
      if (!(await services.limiters.sendRecipient(email))) {
        return rateLimited("이 주소로 오늘 보낼 수 있는 횟수를 넘었습니다. 내일 다시 시도해 주세요.");
      }
      if (!(await services.limiters.sendGlobal())) {
        return rateLimited("오늘 보낼 수 있는 메일이 모두 소진되었습니다. 내일 다시 시도하거나 PDF를 내려받아 주세요.");
      }
    }
  } catch (error) {
    logFailure("send_rate_limit_failed", error);
    return unavailable();
  }

  let pdf: Buffer;
  try {
    pdf = await render(card);
  } catch (error) {
    logFailure("pdf_render_failed", error);
    return jsonError(500, "render_failed", "PDF를 만들지 못했습니다.");
  }

  if (!services.sendMail) {
    return Response.json(
      {
        ok: true,
        delivered: false,
        devMode: true,
        pdfBytes: pdf.length,
        message: "개발 모드입니다. 메일을 실제로 보내지 않았습니다.",
        skipped: [
          "mail",
          ...(services.verifyBot ? [] : ["turnstile"]),
          ...(services.limiters ? [] : ["rate_limit"]),
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await services.sendMail(email, pdf);
  } catch (error) {
    const code = error instanceof MailError ? error.code : "failed";
    logFailure(`mail_failed:${code}:${error instanceof MailError ? `${error.status}:${error.apiCode}` : ""}`, error);
    const { status, message } = MAIL_MESSAGES[code];
    return jsonError(status, "mail_failed", message);
  }
  return Response.json({ ok: true, delivered: true }, { headers: { "Cache-Control": "no-store" } });
}
