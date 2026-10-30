import { describe, expect, it } from "vitest";
import { MAX_AMOUNT, MAX_PRICE, computeTotal, formatDate, formatNumber, parseDigits, parsePercent, reconcileTotal, resetTotalToAuto, resolveStopLoss, setManualTotal, setStopLossMode, todayIso } from "@/lib/card/calc";

const base = { quantity: 10, price: 72_300, total: null as number | null, totalManual: false };

describe("total", () => {
  it("multiplies", () => expect(computeTotal(10, 72_300)).toBe(723_000));
  it("is null when a side is empty", () => {
    expect(computeTotal(null, 5)).toBeNull();
    expect(computeTotal(5, null)).toBeNull();
  });
  it("is null above the card range and for unsafe products", () => {
    expect(computeTotal(MAX_AMOUNT, 2)).toBeNull();
    expect(computeTotal(999_999_999_999, 999_999_999_999)).toBeNull();
  });
  it("keeps zero", () => expect(computeTotal(0, 5)).toBe(0));
  it("recalculates while automatic", () => {
    expect(reconcileTotal(base).total).toBe(723_000);
  });
  it("does not overwrite a manual total, even when inputs change", () => {
    const manual = setManualTotal(reconcileTotal(base), 700_000);
    const changed = reconcileTotal({ ...manual, quantity: 99 });
    expect(changed.total).toBe(700_000);
    expect(changed.totalManual).toBe(true);
  });
  it("reverts to automatic only on request", () => {
    expect(resetTotalToAuto(setManualTotal(base, 1))).toMatchObject({ total: 723_000, totalManual: false });
  });
  it("clearing stays empty and manual, so the next key starts fresh", () => {
    const auto = reconcileTotal(base);
    const cleared = setManualTotal(auto, null);
    expect(cleared).toMatchObject({ total: null, totalManual: true });
    expect(reconcileTotal(cleared).total).toBeNull();
    expect(setManualTotal(cleared, 5)).toMatchObject({ total: 5, totalManual: true });
    expect(resetTotalToAuto(cleared)).toMatchObject({ total: 723_000, totalManual: false });
  });
  it("a no-op edit does not switch to manual", () => {
    const auto = reconcileTotal(base);
    expect(setManualTotal(auto, 723_000)).toBe(auto);
    const empty = { ...base, quantity: null };
    expect(setManualTotal(empty, null)).toBe(empty);
  });
});

describe("formatting", () => {
  it("adds commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(null)).toBe("");
  });
  it("parses digits", () => {
    expect(parseDigits("1,234원", 9999)).toBe(1234);
    expect(parseDigits("abc", 9999)).toBeNull();
    expect(parseDigits("10000", 9999)).toBe("over");
  });
  it.each(["72,300.5", "-100", "1.5", "−100", "1–2", "１．５"])("refuses %s rather than producing another number", (input) => {
    expect(parseDigits(input, 999_999_999)).toBe("invalid");
  });
  it("formats dates", () => expect(formatDate("2026-03-05")).toBe("2026년 3월 5일"));
  it("uses the local date", () => expect(todayIso(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02"));
});

describe("stop-loss", () => {
  const won = (stopLoss: number | null, price: number | null) => resolveStopLoss({ price, stopLoss, stopLossMode: "won", stopLossPct: null });
  const pct = (stopLossPct: number | null, price: number | null) => resolveStopLoss({ price, stopLoss: null, stopLossMode: "pct", stopLossPct });

  it("prints the per-share stop price first and the percent drop in brackets", () => {
    expect(pct(5, 72_300).text).toBe("68,685원 (5%)");
    expect(won(68_685, 72_300).text).toBe("68,685원 (5%)");
  });
  it("is based on the price: quantity 10, price 72,300, 5% is 68,685원, not 5% of the total", () => {
    const card = reconcileTotal({ ...base, stopLoss: null, stopLossMode: "pct" as const, stopLossPct: 5 });
    expect(card.total).toBe(723_000);
    expect(resolveStopLoss(card).text).toBe("68,685원 (5%)");
  });
  it.each(["pct", "won"] as const)("quantity and a manual total leave it unchanged (%s mode)", (stopLossMode) => {
    const card = reconcileTotal({ ...base, stopLoss: 68_685, stopLossMode, stopLossPct: 5 });
    const moreShares = reconcileTotal({ ...card, quantity: 999 });
    expect(moreShares.total).toBe(72_227_700);
    expect(resolveStopLoss(moreShares).text).toBe("68,685원 (5%)");
    expect(resolveStopLoss(setManualTotal(card, 1)).text).toBe("68,685원 (5%)");
    expect(resolveStopLoss(reconcileTotal({ ...card, quantity: null })).text).toBe("68,685원 (5%)");
  });
  it("a price change recomputes in % mode and keeps the amount in won mode", () => {
    expect(pct(5, 80_000).text).toBe("76,000원 (5%)");
    expect(won(68_685, 80_000).text).toBe("68,685원 (14.14%)");
  });
  it("rounds the amount to whole won", () => {
    expect(pct(33.33, 1_000).amount).toBe(667); // 666.7
    expect(pct(5, 30).amount).toBe(29); // 28.5 rounds up
    expect(pct(0.5, 101).amount).toBe(100); // 100.495
  });
  it("derives up to 2 decimals and strips trailing zeros", () => {
    expect(won(8_750, 10_000).text).toBe("8,750원 (12.5%)");
    expect(won(8_766, 10_000).text).toBe("8,766원 (12.34%)");
    expect(won(2, 3).text).toBe("2원 (33.33%)");
    expect(won(0, 10_000).text).toBe("0원 (100%)");
  });
  it("an amount equal to the price is 0%", () => {
    expect(won(10_000, 10_000)).toMatchObject({ pct: 0, overPrice: false, text: "10,000원 (0%)" });
    expect(pct(0, 10_000).text).toBe("10,000원 (0%)");
    expect(pct(100, 10_000).text).toBe("0원 (100%)");
  });
  it("stays exact at the card's maximum, past 2^53", () => {
    expect(pct(0.01, MAX_PRICE).amount).toBe(999_899_999_999);
    expect(pct(99.99, MAX_PRICE).amount).toBe(100_000_000);
    expect(pct(0, MAX_PRICE).amount).toBe(MAX_PRICE);
    expect(pct(100, MAX_PRICE).amount).toBe(0);
    expect(won(MAX_PRICE, MAX_PRICE).pct).toBe(0);
    expect(won(0, MAX_PRICE).pct).toBe(100);
  });
  it("no price: won shows the amount only, % shows no amount and asks for a price", () => {
    expect(won(5_000, null)).toMatchObject({ amount: 5_000, pct: null, text: "5,000원", needsPrice: false });
    expect(pct(5, null)).toMatchObject({ amount: null, pct: 5, text: "5%", needsPrice: true });
    expect(pct(5, 0)).toMatchObject({ amount: null, needsPrice: true });
    expect(won(5_000, 0).text).toBe("5,000원");
  });
  it("an amount above the price keeps the amount and prints no negative percent", () => {
    expect(won(72_301, 72_300)).toMatchObject({ amount: 72_301, pct: null, overPrice: true, text: "72,301원 (1주당 가격 초과)" });
    expect(won(MAX_AMOUNT, 1).text).toBe("999,999,999,999,999원 (1주당 가격 초과)");
  });
  it("is empty when nothing is entered", () => {
    expect(won(null, 100).text).toBe("");
    expect(pct(null, 100).text).toBe("");
  });
  it("carries the value across a unit switch", () => {
    const state = { price: 72_300, stopLoss: 68_685, stopLossMode: "won" as const, stopLossPct: null };
    const asPct = setStopLossMode(state, "pct");
    expect(asPct).toMatchObject({ stopLossMode: "pct", stopLossPct: 5 });
    expect(setStopLossMode({ ...asPct, stopLossPct: 10 }, "won")).toMatchObject({ stopLossMode: "won", stopLoss: 65_070 });
  });
  it("parses percent input", () => {
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("5.")).toBe(5);
    expect(parsePercent("12.34")).toBe(12.34);
    expect(parsePercent("5%")).toBe(5);
    expect(parsePercent("100")).toBe(100);
    expect(parsePercent("100.01")).toBe("over");
    expect(parsePercent("1.234")).toBe("invalid");
    expect(parsePercent("-1")).toBe("invalid");
    expect(parsePercent("abc")).toBe("invalid");
  });
});
