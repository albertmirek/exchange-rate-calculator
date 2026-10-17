import { RatesTableRow } from "./RatesTableRow";
import type {CnbRate} from "~/lib/cnb/parse/parse.server";

const headerCell =
  "sticky top-0 bg-surface-raised px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted";

export function RatesTable({ rates }: { rates: CnbRate[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Exchange rates of foreign currencies against the Czech crown
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${headerCell} text-left`}>
            Code
          </th>
          <th scope="col" className={`${headerCell} text-left`}>
            Currency
          </th>
          <th scope="col" className={`${headerCell} text-right`}>
            Amount
          </th>
          <th scope="col" className={`${headerCell} text-right`}>
            Rate (CZK)
          </th>
        </tr>
      </thead>
      <tbody>
        {rates.map((rate) => (
          <RatesTableRow key={rate.code} rate={rate} />
        ))}
      </tbody>
    </table>
  );
}
