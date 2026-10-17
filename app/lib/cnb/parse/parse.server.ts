export type CnbRate = {
  country: string;
  currency: string;
  amount: number;
  code: string;
  rate: number;
};

export type CnbDailyRates = {
  /** Fixing date, ISO `YYYY-MM-DD`. */
  date: string;
  sequence: number;
  rates: CnbRate[];
};

export class CnbParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CnbParseError";
  }
}

const EXPECTED_HEADER = "Country|Currency|Amount|Code|Rate";

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const TITLE_LINE = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) #(\d+)$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

function parseTitleLine(line: string): Pick<CnbDailyRates, "date" | "sequence"> {
  const match = TITLE_LINE.exec(line);
  const month = match ? MONTHS[match[2]] : undefined;
  if (!match || !month) {
    throw new CnbParseError(`Invalid title line: "${line}"`);
  }
  const [, day, , year, sequence] = match;
  return {
    date: `${year}-${month}-${day.padStart(2, "0")}`,
    sequence: Number(sequence),
  };
}

function parseRow(line: string, lineNumber: number): CnbRate {
  const fields = line.split("|");
  if (fields.length !== 5) {
    throw new CnbParseError(
      `Line ${lineNumber}: expected 5 fields, got ${fields.length}`,
    );
  }
  const [country, currency, amount, code, rate] = fields;

  if (!country || !currency) {
    throw new CnbParseError(`Line ${lineNumber}: empty country or currency`);
  }
  if (!POSITIVE_INTEGER.test(amount)) {
    throw new CnbParseError(`Line ${lineNumber}: invalid amount "${amount}"`);
  }
  if (!CURRENCY_CODE.test(code)) {
    throw new CnbParseError(`Line ${lineNumber}: invalid code "${code}"`);
  }
  if (!POSITIVE_DECIMAL.test(rate) || Number(rate) <= 0) {
    throw new CnbParseError(`Line ${lineNumber}: invalid rate "${rate}"`);
  }

  return {
    country,
    currency,
    amount: Number(amount),
    code,
    rate: Number(rate),
  };
}

/**
 * Parses CNB's `daily.txt`. Strict: any deviation from the documented format
 * throws a `CnbParseError`, so a partially parsed list is never returned.
 */
export function parseDailyRates(text: string): CnbDailyRates {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();

  const [titleLine, headerLine, ...rowLines] = lines;
  if (titleLine === undefined || headerLine === undefined) {
    throw new CnbParseError("Missing title or header line");
  }
  if (headerLine !== EXPECTED_HEADER) {
    throw new CnbParseError(`Unexpected header: "${headerLine}"`);
  }
  if (rowLines.length === 0) {
    throw new CnbParseError("No rate rows");
  }

  return {
    ...parseTitleLine(titleLine),
    rates: rowLines.map((line, index) => parseRow(line, index + 3)),
  };
}
