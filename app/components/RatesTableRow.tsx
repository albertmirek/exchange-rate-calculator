import type {CnbRate} from "~/lib/cnb/parse/parse.server";

const rateFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const amountFormat = new Intl.NumberFormat("en");

type RatesTableRowProps = {
  rate: CnbRate;
  isSelected: boolean;
  onSelect: () => void;
};

export function RatesTableRow({ rate, isSelected, onSelect }: RatesTableRowProps) {
  return (
    <tr
      className={`border-t border-line transition-colors hover:bg-surface-raised ${isSelected ? "bg-surface-raised" : ""}`}
    >
      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-accent">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          title={`Convert to ${rate.code}`}
          className="cursor-pointer underline-offset-4 hover:underline focus-visible:underline"
        >
          {rate.code}
        </button>
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
