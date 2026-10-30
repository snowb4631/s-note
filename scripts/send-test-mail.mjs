// Sends one sample card through the real render and mail code. Usage:
//   npm run mail:test -- me@example.com
// Prints only the delivery status or the error. Reads the environment, then .env.local.
import { createServer } from "vite";

try {
  process.loadEnvFile(".env.local");
} catch {
  // the environment alone is fine
}

const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_EMAIL_API_TOKEN: token, MAIL_FROM: from } = process.env;
const to = process.argv[2];
if (!accountId || !token || !from || !to) {
  console.error("error: needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, MAIL_FROM and a recipient argument");
  process.exit(2);
}

// Vite loads the TypeScript and @/ imports the same way the unit tests do.
const vite = await createServer({ configFile: "vitest.config.ts", server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "silent" });
let code = 0;
try {
  const { cardSchema, emptyCard, emailSchema } = await vite.ssrLoadModule("/src/lib/card/schema.ts");
  const { todayIso } = await vite.ssrLoadModule("/src/lib/card/calc.ts");
  const { renderCardPdf } = await vite.ssrLoadModule("/src/pdf/render.ts");
  const { createMailer } = await vite.ssrLoadModule("/src/server/mail.ts");
  const address = emailSchema.parse(to);
  const card = cardSchema.parse({
    ...emptyCard(todayIso()),
    ticker: "발송 시험 카드",
    side: "buy",
    quantity: 10,
    price: 72300,
    stopLossMode: "pct",
    stopLossPct: 5,
    reason: { mode: "text", text: "메일 연동을 확인하기 위한 시험 카드입니다.", strokes: [] },
  });
  const pdf = await renderCardPdf(card);
  const { status } = await createMailer({ accountId, token, from })(address, pdf);
  console.log(status);
} catch (error) {
  code = 1;
  const detail = error?.name === "MailError" ? `${error.code} http=${error.status} api=${error.apiCode}` : (error?.name ?? "unknown");
  console.error(`error: ${detail}`);
  if (error?.code === "unconfigured") console.error("hint: before a domain is onboarded, only verified destination addresses can receive mail");
} finally {
  await vite.close();
}
process.exit(code);
