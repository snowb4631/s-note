import { describe, expect, it } from "vitest";
import { emptyCard } from "@/lib/card/schema";
import { chooseDraft } from "@/lib/draft";

const today = "2026-10-31";
const card = (ticker: string) => ({ ...emptyCard("2026-10-30"), ticker });
const stored = (ticker: string, savedAt: number, dropped?: boolean) => ({ savedAt, card: card(ticker), dropped });

describe("chooseDraft", () => {
  it("a newer localStorage copy beats a stale IndexedDB one", () => {
    expect(chooseDraft(stored("옛날", 1), stored("최신", 2), today)).toMatchObject({ source: "local", card: { ticker: "최신" } });
  });
  it("a newer IndexedDB copy beats localStorage, and wins a tie", () => {
    expect(chooseDraft(stored("최신", 2), stored("옛날", 1), today)?.card.ticker).toBe("최신");
    expect(chooseDraft(stored("둘다", 1), stored("다른", 1), today)?.source).toBe("idb");
  });
  it("a bare card from before timestamps loses to anything stamped and still loads alone", () => {
    expect(chooseDraft(card("옛 형식"), stored("새 형식", 1), today)?.card.ticker).toBe("새 형식");
    expect(chooseDraft(card("옛 형식"), null, today)?.card.ticker).toBe("옛 형식");
  });
  it("corrupt newest copy falls back to the other store", () => {
    expect(chooseDraft({ savedAt: 1, card: "garbage" }, stored("정상", 0), today)?.card.ticker).toBe("정상");
    expect(chooseDraft(stored("정상", 0), { savedAt: 9, card: 42 }, today)?.card.ticker).toBe("정상");
  });
  it("a partly damaged draft is salvaged and flagged", () => {
    const result = chooseDraft({ savedAt: 1, card: { ...card("남음"), date: "bad" } }, null, today);
    expect(result).toMatchObject({ repaired: true, card: { ticker: "남음", date: today } });
  });
  it("reports attachments dropped from the copy it used", () => {
    expect(chooseDraft(null, stored("가벼움", 1, true), today)?.dropped).toBe(true);
    expect(chooseDraft(stored("전체", 2), stored("가벼움", 1, true), today)?.dropped).toBe(false);
  });
  it("nothing usable is null", () => {
    expect(chooseDraft(null, null, today)).toBeNull();
    expect(chooseDraft("x", 3, today)).toBeNull();
  });
});
