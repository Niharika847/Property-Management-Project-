import { describe, expect, it } from "vitest";
import { monthBounds, shiftMonth } from "@/lib/calendar";

describe("monthBounds", () => {
  it("bounds a 31-day month", () => {
    expect(monthBounds("2026-01")).toMatchObject({
      start: "2026-01-01",
      end: "2026-01-31",
      year: 2026,
      m: 1,
    });
  });

  it("bounds a 30-day month", () => {
    expect(monthBounds("2026-04").end).toBe("2026-04-30");
  });

  it("bounds February in a leap year", () => {
    expect(monthBounds("2028-02").end).toBe("2028-02-29");
  });

  it("zero-pads the month", () => {
    expect(monthBounds("2026-09").start).toBe("2026-09-01");
  });

  it("falls back to the current month for junk rather than producing NaN dates", () => {
    for (const junk of ["", "nonsense", "2026-13", "2026-00", "----"]) {
      const b = monthBounds(junk);
      expect(b.start).toMatch(/^\d{4}-\d{2}-01$/);
      expect(b.m).toBeGreaterThanOrEqual(1);
      expect(b.m).toBeLessThanOrEqual(12);
    }
  });
});

describe("shiftMonth", () => {
  it("steps forward within a year", () => {
    expect(shiftMonth("2026-03", 1)).toBe("2026-04");
  });

  it("steps backward within a year", () => {
    expect(shiftMonth("2026-03", -1)).toBe("2026-02");
  });

  it("rolls forward over the year boundary", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("rolls backward over the year boundary", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("is reversible", () => {
    for (const month of ["2026-01", "2026-06", "2026-12"]) {
      expect(shiftMonth(shiftMonth(month, 1), -1)).toBe(month);
    }
  });

  it("walks twelve months forward and lands exactly one year later", () => {
    let month = "2026-05";
    for (let i = 0; i < 12; i++) month = shiftMonth(month, 1);
    expect(month).toBe("2027-05");
  });
});
