/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountrySelect } from "./CountrySelect";
import type { CountrySummary } from "@/lib/countries/types";

const COUNTRIES: CountrySummary[] = [
  { code: "AUS", alpha2: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "BRA", alpha2: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CAN", alpha2: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CHN", alpha2: "CN", name: "China", flag: "🇨🇳" },
  { code: "FRA", alpha2: "FR", name: "France", flag: "🇫🇷" },
];

function setup(props: Partial<React.ComponentProps<typeof CountrySelect>> = {}) {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(
    <CountrySelect countries={COUNTRIES} selected={null} onSelect={onSelect} {...props} />,
  );
  return { onSelect, user };
}

function trigger() {
  return screen.getByRole("button");
}

afterEach(cleanup);

describe("CountrySelect", () => {
  it("starts closed, showing the placeholder", () => {
    setup();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Choose a country")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on click and focuses the search field", async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("Search countries")).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(COUNTRIES.length);
  });

  it("filters options as the user types", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.type(screen.getByPlaceholderText("Search countries"), "ch");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("China");
  });

  it("matches on ISO code prefix too", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.type(screen.getByPlaceholderText("Search countries"), "bra");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("Brazil");
  });

  it("explains when nothing matches", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.type(screen.getByPlaceholderText("Search countries"), "zzz");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText(/No countries match/)).toBeInTheDocument();
  });

  it("reports the chosen country and closes", async () => {
    const { onSelect, user } = setup();
    await user.click(trigger());

    await user.click(screen.getByRole("option", { name: /Canada/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(COUNTRIES[2]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects with the keyboard", async () => {
    const { onSelect, user } = setup();
    await user.click(trigger());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(COUNTRIES[2]);
  });

  it("does not run past either end of the list", async () => {
    const { onSelect, user } = setup();
    await user.click(trigger());

    await user.keyboard("{ArrowUp}{ArrowUp}{Enter}");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(COUNTRIES[0]);
  });

  it("closes on Escape without selecting", async () => {
    const { onSelect, user } = setup();
    await user.click(trigger());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes when the user clicks away", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clears the previous search when reopened", async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText("Search countries"), "china");
    await user.keyboard("{Escape}");

    await user.click(trigger());

    expect(screen.getByPlaceholderText("Search countries")).toHaveValue("");
    expect(screen.getAllByRole("option")).toHaveLength(COUNTRIES.length);
  });

  it("shows the current selection and marks it in the list", async () => {
    const { user } = setup({ selected: COUNTRIES[2] });

    expect(within(trigger()).getByText("Canada")).toBeInTheDocument();

    await user.click(trigger());
    expect(screen.getByRole("option", { name: /Canada/ })).toHaveAttribute("aria-selected", "true");
  });

  it("cannot be opened while disabled", async () => {
    const { user } = setup({ countries: [], disabled: true });

    await user.click(trigger());

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("is labelled by the field label for screen readers", async () => {
    render(
      <>
        <p id="label">Select a country</p>
        <CountrySelect
          countries={COUNTRIES}
          selected={null}
          onSelect={vi.fn()}
          labelledBy="label"
        />
      </>,
    );

    expect(screen.getByRole("button", { name: /Select a country/ })).toBeInTheDocument();
  });
});
