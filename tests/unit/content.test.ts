import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { guides } from "@/content/guides";

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx|css|svg|json|md)$/.test(e.name) ? [p] : [];
  });
}

const product = files("src").filter((f) => !f.endsWith("metrics.generated.ts"));
const all = product.map((f) => [f, fs.readFileSync(f, "utf8")] as const);
// The list stays out of the repository. Keep a copy at this git-ignored path to run the check.
const BANNED_FILE = "artifacts/banned-phrases.json";
const banned: string[] = fs.existsSync(BANNED_FILE) ? JSON.parse(fs.readFileSync(BANNED_FILE, "utf8")).phrases : [];
const tracked = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && f !== "package-lock.json" && fs.existsSync(f) && !/\.(png|ttf|woff2)$/.test(f));

describe("forbidden phrases", () => {
  it.skipIf(banned.length === 0)("appear nowhere in the product or the repository", () => {
    const texts = [...all, ...tracked.map((f) => [f, fs.readFileSync(f, "utf8")] as const)];
    const hits = banned.flatMap((phrase) => texts.filter(([, text]) => text.toLowerCase().includes(phrase.toLowerCase())).map(([f]) => `${phrase}: ${f}`));
    expect(hits).toEqual([]);
  });
});

describe("repository", () => {
  it("names the local planning documents only in .gitignore, which has to", () => {
    const names = [["PLAN", "md"].join("."), ["IMPLEMENTATION", "md"].join(".")];
    const hits = tracked.filter((f) => f !== ".gitignore" && names.some((n) => fs.readFileSync(f, "utf8").includes(n)));
    expect(hits).toEqual([]);
  });
  it("no longer mentions the previous mail provider", () => {
    const name = ["re", "send"].join("");
    const hits = tracked.filter((f) => fs.readFileSync(f, "utf8").toLowerCase().includes(name));
    expect(hits).toEqual([]);
  });
});

describe("guides", () => {
  const text = (g: (typeof guides)[number]) =>
    [g.title, g.summary, ...g.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.list ?? [])])].join("\n");

  it("has six articles of real length", () => {
    expect(guides).toHaveLength(6);
    expect(new Set(guides.map((g) => g.slug)).size).toBe(6);
    for (const g of guides) expect(text(g).length).toBeGreaterThan(900);
  });

  it("carries no recommendations, statistics or quotes", () => {
    const patterns = [/추천\s*종목/, /매수\s*추천/, /목표\s*주가/, /삼성|하이닉스|네이버|카카오|현대차|테슬라|엔비디아|애플/, /\d+(\.\d+)?\s*%/, /연구에 따르면|통계에 따르면|조사에 따르면/, /라고 말했|명언/];
    for (const g of guides) for (const p of patterns) expect(text(g)).not.toMatch(p);
  });
});
