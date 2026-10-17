import { describe, expect, it } from "vitest";
import { CnbParseError, parseDailyRates } from "./parse.server";

const TITLE_LINE = "15 Oct 2026 #199";
const HEADER_LINE = "Country|Currency|Amount|Code|Rate";
const EUR_ROW = "EMU|euro|1|EUR|24.325";

function createDailyText(rowLines: string[], titleLine = TITLE_LINE): string {
  return [titleLine, HEADER_LINE, ...rowLines].join("\n") + "\n";
}

describe("parseDailyRates", () => {
  describe("valid input", () => {
    it("parses the fixing date, sequence and rows", () => {
      const text = createDailyText([
        "Australia|dollar|1|AUD|15.014",
        "Hungary|forint|100|HUF|6.697",
      ]);

      expect(parseDailyRates(text)).toEqual({
        date: "2026-10-15",
        sequence: 199,
        rates: [
          {
            country: "Australia",
            currency: "dollar",
            amount: 1,
            code: "AUD",
            rate: 15.014,
          },
          {
            country: "Hungary",
            currency: "forint",
            amount: 100,
            code: "HUF",
            rate: 6.697,
          },
        ],
      });
    });

    it("keeps the quoted amount for currencies quoted per 100 or 1000 units", () => {
      const text = createDailyText([
        "Japan|yen|100|JPY|13.757",
        "Indonesia|rupiah|1000|IDR|1.212",
      ]);

      const amounts = parseDailyRates(text).rates.map((rate) => rate.amount);

      expect(amounts).toEqual([100, 1000]);
    });

    it("zero-pads a single-digit day in the ISO date", () => {
      const text = createDailyText([EUR_ROW], "5 Jan 2026 #3");

      expect(parseDailyRates(text)).toMatchObject({
        date: "2026-01-05",
        sequence: 3,
      });
    });

    it("parses a rate without decimals", () => {
      const text = createDailyText(["Iceland|krona|100|ISK|17"]);

      expect(parseDailyRates(text).rates[0].rate).toBe(17);
    });

    it("accepts Windows line endings", () => {
      const text = createDailyText([EUR_ROW]).replaceAll("\n", "\r\n");

      expect(parseDailyRates(text).rates).toHaveLength(1);
    });

    it("accepts a missing final newline", () => {
      const text = createDailyText([EUR_ROW]).trimEnd();

      expect(parseDailyRates(text).rates).toHaveLength(1);
    });
  });

  describe("invalid structure", () => {
    it("rejects an empty text", () => {
      expect(() => parseDailyRates("")).toThrow(CnbParseError);
    });

    it("rejects a text with only a title line", () => {
      expect(() => parseDailyRates(TITLE_LINE)).toThrow(
        "Missing title or header line",
      );
    });

    it("rejects an unexpected header", () => {
      const text = [TITLE_LINE, "Country|Currency|Code|Rate", EUR_ROW].join("\n");

      expect(() => parseDailyRates(text)).toThrow("Unexpected header");
    });

    it("rejects a text without rate rows", () => {
      expect(() => parseDailyRates(createDailyText([]))).toThrow("No rate rows");
    });

    it("rejects a blank line between rows", () => {
      const text = createDailyText([EUR_ROW, "", "Brazil|real|1|BRL|4.296"]);

      expect(() => parseDailyRates(text)).toThrow("Line 4: expected 5 fields");
    });
  });

  describe("invalid title line", () => {
    it.each([
      ["unknown month", "15 Foo 2026 #199"],
      ["missing sequence", "15 Oct 2026"],
      ["missing hash", "15 Oct 2026 199"],
      ["two-digit year", "15 Oct 26 #199"],
      ["lowercase month", "15 oct 2026 #199"],
      ["leading text", "Date: 15 Oct 2026 #199"],
    ])("rejects %s", (_name, titleLine) => {
      const text = createDailyText([EUR_ROW], titleLine);

      expect(() => parseDailyRates(text)).toThrow(CnbParseError);
      expect(() => parseDailyRates(text)).toThrow("Invalid title line");
    });
  });

  describe("invalid rows", () => {
    it.each([
      ["too few fields", "EMU|euro|1|EUR", "expected 5 fields, got 4"],
      ["too many fields", "EMU|euro|1|EUR|24.325|x", "expected 5 fields, got 6"],
      ["empty country", "|euro|1|EUR|24.325", "empty country or currency"],
      ["empty currency", "EMU||1|EUR|24.325", "empty country or currency"],
    ])("rejects %s", (_name, row, message) => {
      expect(() => parseDailyRates(createDailyText([row]))).toThrow(message);
    });

    it.each([
      ["zero", "0"],
      ["negative", "-1"],
      ["decimal", "1.5"],
      ["text", "abc"],
      ["empty", ""],
      ["leading zero", "01"],
    ])("rejects an amount that is %s", (_name, amount) => {
      const row = `EMU|euro|${amount}|EUR|24.325`;

      expect(() => parseDailyRates(createDailyText([row]))).toThrow(
        "invalid amount",
      );
    });

    it.each([
      ["lowercase", "eur"],
      ["too long", "EURO"],
      ["too short", "EU"],
      ["with a digit", "EU1"],
      ["empty", ""],
    ])("rejects a code that is %s", (_name, code) => {
      const row = `EMU|euro|1|${code}|24.325`;

      expect(() => parseDailyRates(createDailyText([row]))).toThrow(
        "invalid code",
      );
    });

    it.each([
      ["zero", "0"],
      ["zero with decimals", "0.000"],
      ["negative", "-24.325"],
      ["a decimal comma", "24,325"],
      ["text", "abc"],
      ["empty", ""],
      ["a trailing dot", "24."],
    ])("rejects a rate that is %s", (_name, rate) => {
      const row = `EMU|euro|1|EUR|${rate}`;

      expect(() => parseDailyRates(createDailyText([row]))).toThrow(
        "invalid rate",
      );
    });

    it("reports the line number of the offending row", () => {
      const text = createDailyText([
        EUR_ROW,
        "Brazil|real|1|BRL|4.296",
        "Canada|dollar|1|cad|15.291",
      ]);

      expect(() => parseDailyRates(text)).toThrow('Line 5: invalid code "cad"');
    });

    it("does not return a partial list when one row is invalid", () => {
      const text = createDailyText([EUR_ROW, "Brazil|real|1|BRL|oops"]);

      expect(() => parseDailyRates(text)).toThrow(CnbParseError);
    });
  });
});
