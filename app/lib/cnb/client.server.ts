import { parseDailyRates, type CnbDailyRates } from "./parse/parse.server";

const DAILY_URL =
  "https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt";
const TIMEOUT_MS = 10_000;

/** Downloads and parses the latest CNB fixing. Throws on any failure. */
export async function fetchDailyRates(): Promise<CnbDailyRates> {
  const response = await fetch(DAILY_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CNB responded with ${response.status}`);
  return parseDailyRates(await response.text());
}
