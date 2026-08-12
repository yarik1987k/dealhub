import { describe, expect, it } from "vitest";
import {
  flagImageUrl,
  formatCapital,
  formatCurrencies,
  formatPopulation,
  formatRegion,
  formatTimezones,
} from "./format";

describe("formatPopulation", () => {
  it("groups thousands", () => {
    expect(formatPopulation(38_005_238)).toBe("38,005,238");
  });

  it("shows a dash when the figure is unknown", () => {
    expect(formatPopulation(null)).toBe("—");
  });

  it("keeps a zero population as a number", () => {
    expect(formatPopulation(0)).toBe("0");
  });
});

describe("formatRegion", () => {
  it("joins region and subregion", () => {
    expect(formatRegion({ region: "Americas", subregion: "North America" })).toBe(
      "Americas · North America",
    );
  });

  it("omits a missing subregion", () => {
    expect(formatRegion({ region: "Antarctic", subregion: null })).toBe("Antarctic");
  });
});

describe("formatCurrencies", () => {
  it("appends the symbol when there is one", () => {
    expect(formatCurrencies([{ code: "CAD", name: "Canadian dollar", symbol: "$" }])).toBe(
      "Canadian dollar ($)",
    );
  });

  it("omits the brackets when there is no symbol", () => {
    expect(formatCurrencies([{ code: "XYZ", name: "Mystery coin", symbol: null }])).toBe(
      "Mystery coin",
    );
  });

  it("lists every currency", () => {
    expect(
      formatCurrencies([
        { code: "BTN", name: "Ngultrum", symbol: "Nu." },
        { code: "INR", name: "Indian rupee", symbol: "₹" },
      ]),
    ).toBe("Ngultrum (Nu.), Indian rupee (₹)");
  });

  it("shows a dash for a country with no currency", () => {
    expect(formatCurrencies([])).toBe("—");
  });
});

describe("formatCapital / formatTimezones", () => {
  it("joins multiple values", () => {
    expect(formatCapital(["Pretoria", "Cape Town"])).toBe("Pretoria, Cape Town");
    expect(formatTimezones(["UTC-05:00", "UTC-04:00"])).toBe("UTC-05:00, UTC-04:00");
  });

  it("shows a dash when empty", () => {
    expect(formatCapital([])).toBe("—");
    expect(formatTimezones([])).toBe("—");
  });
});

describe("flagImageUrl", () => {
  it("builds a flagcdn url from the alpha-2 code", () => {
    expect(flagImageUrl("CA")).toBe("https://flagcdn.com/w80/ca.png");
    expect(flagImageUrl("ca", 40)).toBe("https://flagcdn.com/w40/ca.png");
  });
});
