import type { CnbRate } from "~/lib/cnb/parse/parse.server";

/** The CNB quotes some currencies per 100 or 1000 units, so the rate only
 * applies to `rate.amount` units of the foreign currency. */
export function convertCzk(amountCzk: number, rate: CnbRate): number {
  return (amountCzk / rate.rate) * rate.amount;
}
