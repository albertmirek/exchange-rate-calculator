import type { CnbRate } from "~/lib/cnb/parse.server";

const rateFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const amountFormat = new Intl.NumberFormat("en");

export function RatesTableRow({ rate }: { rate: CnbRate }) {
  return (
    <tr className="border-t border-line transition-colors hover:bg-surface-raised">
      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-accent">
        {rate.code}
      </th>
      <td className="px-4 py-2.5 text-muted">
        {rate.country} {rate.currency}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {amountFormat.format(rate.amount)}
      </td>
      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
        {rateFormat.format(rate.rate)}
      </td>
    </tr>
  );
}
