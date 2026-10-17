import { useId, useState } from "react";
import type { CnbRate } from "~/lib/cnb/parse/parse.server";
import { convertCzk } from "~/lib/convert/convert";

const resultFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
});

const fieldClass =
  "w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-ink focus:border-accent focus:outline-none";

/** Keeps digits and a single decimal separator. Both "." and "," are accepted. */
function keepAmountCharacters(text: string): string {
  const cleaned = text.replace(/[^\d.,]/g, "");
  const separatorAt = cleaned.search(/[.,]/);
  if (separatorAt === -1) return cleaned;
  return (
    cleaned.slice(0, separatorAt + 1) +
    cleaned.slice(separatorAt + 1).replace(/[.,]/g, "")
  );
}

type CurrencyConverterFormProps = {
  headingId: string;
  rates: CnbRate[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
};

export function CurrencyConverterForm({
  headingId,
  rates,
  selectedCode,
  onSelectCode,
}: CurrencyConverterFormProps) {
  const amountId = useId();
  const currencyId = useId();
  const resultLabelId = useId();
  const [amountText, setAmountText] = useState("");

  const selectedRate = rates.find((rate) => rate.code === selectedCode);
  const amountCzk = Number(amountText.replace(",", "."));
  const hasAmount = amountText !== "" && Number.isFinite(amountCzk);

  return (
    <form
      aria-labelledby={headingId}
      onSubmit={(event) => event.preventDefault()}
      className="mt-4 space-y-5"
    >
      <div>
        <label htmlFor={amountId} className="mb-1.5 block text-sm text-muted">
          Amount in CZK
        </label>
        <input
          id={amountId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          maxLength={15}
          placeholder="0"
          value={amountText}
          onChange={(event) =>
            setAmountText(keepAmountCharacters(event.target.value))
          }
          className={`${fieldClass} tabular-nums`}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <label htmlFor={currencyId} className="text-sm text-muted">
            Convert to
          </label>
          <span className="text-xs text-muted">
            or click a code in the table
          </span>
        </div>
        <select
          id={currencyId}
          value={selectedCode}
          onChange={(event) => onSelectCode(event.target.value)}
          className={fieldClass}
        >
          {rates.map((rate) => (
            <option key={rate.code} value={rate.code}>
              {rate.code} · {rate.country} {rate.currency}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-line pt-5">
        <p id={resultLabelId} className="text-sm text-muted">
          Converted amount
        </p>
        <output
          htmlFor={`${amountId} ${currencyId}`}
          aria-labelledby={resultLabelId}
          className="mt-1 block break-all text-4xl font-semibold tabular-nums text-accent sm:text-5xl"
        >
          {hasAmount && selectedRate
            ? `${resultFormat.format(convertCzk(amountCzk, selectedRate))} ${selectedRate.code}`
            : "–"}
        </output>
      </div>
    </form>
  );
}
