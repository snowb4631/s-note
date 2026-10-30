import { defineConfig } from "@playwright/test";

// Blank values override anything inherited from the shell or a local .env file.
const noKeys = {
  TURNSTILE_SITE_KEY: "",
  TURNSTILE_SECRET_KEY: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  RATE_LIMIT_HMAC_SECRET: "",
  CLOUDFLARE_ACCOUNT_ID: "",
  CLOUDFLARE_EMAIL_API_TOKEN: "",
  MAIL_FROM: "",
  ADSENSE_CLIENT: "",
  ADSENSE_SLOT: "",
  EMAIL_SENDING_ENABLED: "true",
};

export const DEV = "http://localhost:3100";
export const PROD = "http://localhost:3101";
export const PROD_ADS = "http://localhost:3102";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: DEV, locale: "ko-KR", timezoneId: "Asia/Seoul", acceptDownloads: true },
  webServer: [
    // Development: keys absent, mail skipped and reported.
    { command: "npx next dev -p 3100", url: DEV, reuseExistingServer: false, env: { ...noKeys }, timeout: 120_000 },
    // Production without keys: must fail closed. Needs `next build` first (npm run test:e2e does it).
    { command: "npx next start -p 3101", url: PROD, reuseExistingServer: false, env: { ...noKeys }, timeout: 60_000 },
    // Production with ad variables, read at request time.
    {
      command: "npx next start -p 3102",
      url: PROD_ADS,
      reuseExistingServer: false,
      env: { ...noKeys, ADSENSE_CLIENT: "ca-pub-1234567890123456", ADSENSE_SLOT: "1234567890" },
      timeout: 60_000,
    },
    // Production with only the ad client: Auto ads, no manual unit.
    {
      command: "npx next start -p 3107",
      url: "http://localhost:3107",
      reuseExistingServer: false,
      env: { ...noKeys, ADSENSE_CLIENT: "ca-pub-1234567890123456" },
      timeout: 60_000,
    },
    // Production with a stand-in Upstash REST API: the real bundle and the real rate-limit library.
    { command: "node tests/e2e/mock-upstash.mjs 3104", url: "http://localhost:3104/health", reuseExistingServer: false, timeout: 15_000 },
    {
      command: "npx next start -p 3103",
      url: "http://localhost:3103",
      reuseExistingServer: false,
      env: { ...noKeys, UPSTASH_REDIS_REST_URL: "http://localhost:3104", UPSTASH_REDIS_REST_TOKEN: "test", RATE_LIMIT_HMAC_SECRET: "e2e-only-secret-of-at-least-32-characters" },
      timeout: 60_000,
    },
    // Production with only a widget key: the page renders Turnstile; tests block its script.
    {
      command: "npx next start -p 3105",
      url: "http://localhost:3105",
      reuseExistingServer: false,
      env: { ...noKeys, TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
      timeout: 60_000,
    },
    // Production with email not switched on: the default.
    {
      command: "npx next start -p 3106",
      url: "http://localhost:3106",
      reuseExistingServer: false,
      env: { ...noKeys, EMAIL_SENDING_ENABLED: "" },
      timeout: 60_000,
    },
  ],
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
    },
  ],
});
