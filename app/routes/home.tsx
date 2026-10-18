import { useState } from "react";
import type { Route } from "./+types/home";
import { CurrencyConverterForm } from "~/components/CurrencyConverterForm/CurrencyConverterForm";
import { RatesTable } from "~/components/RatesTable";
import { getRates } from "~/lib/cnb/cache/cache.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Currency calculator" },
    { name: "description", content: "CZK exchange rates converter" },
  ];
}

export async function loader() {
  try {
    return await getRates();
  } catch (error) {
    console.error("Failed to load CNB exchange rates", error);
    throw new Response("Exchange rates are temporarily unavailable", {
      status: 503,
    });
  }
}

const dailyRatesDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default function Home({ loaderData }: Route.ComponentProps) {
  const { date, sequence, rates } = loaderData;
  const [selectedCode, setSelectedCode] = useState(
    () => (rates.find((rate) => rate.code === "EUR") ?? rates[0]).code,
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Currency calculator
        </h1>
        <p className="mt-2 text-muted">
          Convert Czech crown using the Czech National Bank daily fixing.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2.5fr] lg:items-start">
        <section
          aria-labelledby="converter-heading"
          className="rounded-2xl border border-line bg-surface p-6"
        >
          <h2 id="converter-heading" className="text-lg font-semibold">
            Converter
          </h2>
          <CurrencyConverterForm
            headingId="converter-heading"
            rates={rates}
            selectedCode={selectedCode}
            onSelectCode={setSelectedCode}
          />
        </section>

        <section
            aria-labelledby="rates-heading"
            className="overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <header className="flex items-baseline justify-between gap-4 p-6 pb-4">
            <h2 id="rates-heading" className="text-lg font-semibold">
              Exchange rates
            </h2>
            <p className="text-sm text-muted">
              <time dateTime={date}>
                {dailyRatesDateFormat.format(new Date(`${date}T00:00:00Z`))}
              </time>{" "}
              · #{sequence}
            </p>
          </header>
          <div className="max-h-[32rem] overflow-y-auto">
            <RatesTable
              rates={rates}
              selectedCode={selectedCode}
              onSelectCode={setSelectedCode}
            />
          </div>
        </section>

      </div>
    </main>
  );
}
