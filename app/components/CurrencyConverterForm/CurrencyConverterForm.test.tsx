// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { CnbRate } from "~/lib/cnb/parse/parse.server";
import { CurrencyConverterForm } from "./CurrencyConverterForm";

const rates: CnbRate[] = [
  { country: "EMU", currency: "euro", amount: 1, code: "EUR", rate: 25 },
  { country: "Hungary", currency: "forint", amount: 100, code: "HUF", rate: 5 },
];

// The page owns the selected currency, so the form is tested inside the same
// kind of parent.
function FormWithSelection() {
  const [selectedCode, setSelectedCode] = useState("EUR");
  return (
    <CurrencyConverterForm
      headingId="heading"
      rates={rates}
      selectedCode={selectedCode}
      onSelectCode={setSelectedCode}
    />
  );
}

function renderForm() {
  render(<FormWithSelection />);
  return {
    user: userEvent.setup(),
    amountInput: screen.getByLabelText<HTMLInputElement>("Amount in CZK"),
    currencySelect: screen.getByLabelText<HTMLSelectElement>("Convert to"),
    getConverted: () => screen.getByRole("status").textContent,
  };
}

afterEach(cleanup);

describe("CurrencyConverterForm", () => {
  it("shows a dash until an amount is entered", () => {
    const { getConverted } = renderForm();

    expect(getConverted()).toBe("–");
  });

  it("converts the amount into the selected currency", async () => {
    const { user, amountInput, getConverted } = renderForm();

    await user.type(amountInput, "100");

    expect(getConverted()).toBe("4 EUR");
  });

  it("accepts a comma as the decimal separator", async () => {
    const { user, amountInput, getConverted } = renderForm();

    await user.type(amountInput, "12,5");

    expect(getConverted()).toBe("0.5 EUR");
  });

  it("drops characters that are not part of a number", async () => {
    const { user, amountInput } = renderForm();

    await user.type(amountInput, "1a0,5,3");

    expect(amountInput.value).toBe("10,53");
  });

  it("converts again when another currency is selected", async () => {
    const { user, amountInput, currencySelect, getConverted } = renderForm();

    await user.type(amountInput, "100");
    await user.selectOptions(currencySelect, "HUF");

    expect(getConverted()).toBe("2,000 HUF");
  });

  it("shows a dash again when the amount is cleared", async () => {
    const { user, amountInput, getConverted } = renderForm();

    await user.type(amountInput, "100");
    await user.clear(amountInput);

    expect(getConverted()).toBe("–");
  });
});
