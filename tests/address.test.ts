import { describe, expect, it } from "vitest";
import {
  joinStreet,
  normalisePostcode,
  normaliseState,
  parseFormattedAddress,
} from "@/lib/address/parse";

describe("normaliseState", () => {
  it("accepts abbreviations in any case", () => {
    expect(normaliseState("vic")).toBe("VIC");
    expect(normaliseState("NSW")).toBe("NSW");
    expect(normaliseState(" qld ")).toBe("QLD");
  });

  it("maps full state names", () => {
    expect(normaliseState("New South Wales")).toBe("NSW");
    expect(normaliseState("western australia")).toBe("WA");
    expect(normaliseState("Australian Capital Territory")).toBe("ACT");
  });

  it("returns empty for anything it cannot identify, rather than guessing", () => {
    // Saving the wrong state silently corrupts a property record, so an
    // unrecognised value must leave the form's own default alone.
    for (const junk of ["", "  ", "California", "Auckland", undefined, null]) {
      expect(normaliseState(junk)).toBe("");
    }
  });
});

describe("normalisePostcode", () => {
  it("keeps a valid four-digit postcode", () => {
    expect(normalisePostcode("3121")).toBe("3121");
  });

  it("strips surrounding noise", () => {
    expect(normalisePostcode(" 3121 ")).toBe("3121");
  });

  it("rejects anything that is not four digits", () => {
    for (const junk of ["", "312", "31215", "abcd", "3A21", undefined, null]) {
      expect(normalisePostcode(junk)).toBe("");
    }
  });
});

describe("joinStreet", () => {
  it("joins number and street", () => {
    expect(joinStreet("12", "Kent Street")).toBe("12 Kent Street");
  });

  it("copes with either part missing", () => {
    expect(joinStreet(undefined, "Kent Street")).toBe("Kent Street");
    expect(joinStreet("12", undefined)).toBe("12");
    expect(joinStreet(null, null)).toBe("");
  });
});

describe("parseFormattedAddress", () => {
  it("splits a standard Australian address", () => {
    expect(parseFormattedAddress("12 Kent Street, Richmond VIC 3121, Australia")).toEqual({
      street: "12 Kent Street",
      suburb: "Richmond",
      state: "VIC",
      postcode: "3121",
    });
  });

  it("handles a suburb on its own comma-separated part", () => {
    const parsed = parseFormattedAddress("5 Smith Road, Bondi, NSW 2026, Australia");
    expect(parsed.suburb).toBe("Bondi");
    expect(parsed.state).toBe("NSW");
    expect(parsed.postcode).toBe("2026");
    expect(parsed.street).toBe("5 Smith Road");
  });

  it("keeps a unit number with the street", () => {
    const parsed = parseFormattedAddress("Unit 3/22 Ann Street, Brisbane QLD 4000, Australia");
    expect(parsed.street).toContain("22 Ann Street");
    expect(parsed.state).toBe("QLD");
  });

  it("copes with a missing postcode", () => {
    const parsed = parseFormattedAddress("1 Test Lane, Hobart TAS, Australia");
    expect(parsed.state).toBe("TAS");
    expect(parsed.postcode).toBe("");
  });

  it("returns blanks for empty input instead of throwing", () => {
    expect(parseFormattedAddress("")).toEqual({
      street: "",
      suburb: "",
      state: "",
      postcode: "",
    });
    expect(parseFormattedAddress("   ").street).toBe("");
  });

  it("degrades gracefully on an address with no recognisable state", () => {
    const parsed = parseFormattedAddress("221B Baker Street, London");
    expect(parsed.state).toBe("");
    expect(parsed.postcode).toBe("");
    // Better to leave the suburb populated and the state blank than to invent.
    expect(parsed.suburb).toBe("London");
  });

  it("never returns undefined for any field", () => {
    for (const input of ["", "x", "a, b", "a, b, c", "12 Kent St, Richmond VIC 3121"]) {
      const parsed = parseFormattedAddress(input);
      for (const value of Object.values(parsed)) {
        expect(typeof value).toBe("string");
      }
    }
  });
});
