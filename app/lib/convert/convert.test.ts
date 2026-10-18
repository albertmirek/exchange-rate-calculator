import { describe, expect, it } from "vitest";
import type { CnbRate } from "~/lib/cnb/parse/parse.server";
import { convertCzk } from "./convert";

function createRate(code: string, amount: number, rate: number): CnbRate {
  return { country: "Testland", currency: "unit", amount, code, rate };
}

describe("convertCzk", () => {
  it("divides by the rate for a currency quoted per 1 unit", () => {
    expect(convertCzk(100, createRate("EUR", 1, 25))).toBe(4);
  });

  it("scales the result for a currency quoted per 100 units", () => {
    // 100 HUF cost 6.697 CZK, so 6.697 CZK buy 100 HUF.
    expect(convertCzk(6.697, createRate("HUF", 100, 6.697))).toBeCloseTo(100);
    expect(convertCzk(1000, createRate("HUF", 100, 6.697))).toBeCloseTo(
      14932.06,
      2,
    );
  });

  it("scales the result for a currency quoted per 1000 units", () => {
    // 1000 IDR cost 1.3 CZK, so 13 CZK buy 10000 IDR.
    expect(convertCzk(13, createRate("IDR", 1000, 1.3))).toBeCloseTo(10000);
  });

  it("returns 0 for 0 CZK", () => {
    expect(convertCzk(0, createRate("EUR", 1, 25))).toBe(0);
  });

  it("keeps the fraction of a small amount", () => {
    expect(convertCzk(0.5, createRate("EUR", 1, 25))).toBeCloseTo(0.02);
  });
});
