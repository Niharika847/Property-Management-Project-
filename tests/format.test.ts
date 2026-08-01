import { describe, expect, it } from "vitest";
import {
  annualRent,
  aud,
  audCents,
  fyRange,
  gstFromInclusive,
  monthRange,
  resolvePeriod,
} from "@/lib/format";

// Dates are constructed with local-time components on purpose: fyRange and
// monthRange read getMonth()/getFullYear(), so a UTC-parsed "2026-07-01" would
// test a different day than the one users see.
const localDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("fyRange — Australian financial year", () => {
  it("starts a new year on 1 July", () => {
    expect(fyRange(localDate(2026, 7, 1))).toEqual({
      start: "2026-07-01",
      end: "2027-06-30",
      label: "FY2026–27",
    });
  });

  it("still reports the previous year on 30 June", () => {
    expect(fyRange(localDate(2026, 6, 30))).toEqual({
      start: "2025-07-01",
      end: "2026-06-30",
      label: "FY2025–26",
    });
  });

  it("puts January in the year that began the previous July", () => {
    expect(fyRange(localDate(2026, 1, 15)).start).toBe("2025-07-01");
  });

  it("covers the whole year with no gap between consecutive years", () => {
    const thisYear = fyRange(localDate(2026, 8, 1));
    const nextYear = fyRange(localDate(2027, 8, 1));
    // Compare in local time — toISOString() would shift the date by the
    // machine's UTC offset and make this pass or fail by timezone.
    const [ey, em, ed] = thisYear.end.split("-").map(Number);
    const dayAfterEnd = new Date(ey, em - 1, ed + 1);
    const asISO = `${dayAfterEnd.getFullYear()}-${String(dayAfterEnd.getMonth() + 1).padStart(2, "0")}-${String(
      dayAfterEnd.getDate()
    ).padStart(2, "0")}`;
    expect(asISO).toBe(nextYear.start);
  });
});

describe("monthRange", () => {
  it("ends on the 30th for a 30-day month", () => {
    expect(monthRange(localDate(2026, 4, 15))).toEqual({
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });

  it("ends on the 31st for a 31-day month", () => {
    expect(monthRange(localDate(2026, 1, 1)).end).toBe("2026-01-31");
  });

  it("handles February in a non-leap year", () => {
    expect(monthRange(localDate(2026, 2, 10)).end).toBe("2026-02-28");
  });

  it("handles February in a leap year", () => {
    expect(monthRange(localDate(2028, 2, 10)).end).toBe("2028-02-29");
  });

  it("zero-pads single-digit months", () => {
    expect(monthRange(localDate(2026, 9, 9)).start).toBe("2026-09-01");
  });
});

describe("gstFromInclusive — GST is 1/11th of a GST-inclusive total", () => {
  it("takes one eleventh of the total", () => {
    expect(gstFromInclusive(110)).toBe(10);
  });

  it("rounds to whole cents", () => {
    // 124 / 11 = 11.2727…
    expect(gstFromInclusive(124)).toBe(11.27);
  });

  it("returns 0 rather than NaN for junk input", () => {
    expect(gstFromInclusive(0)).toBe(0);
    expect(gstFromInclusive(-50)).toBe(0);
    expect(gstFromInclusive(Number.NaN)).toBe(0);
  });

  it("never exceeds the total it is drawn from", () => {
    for (const total of [1, 9.99, 100, 12345.67]) {
      expect(gstFromInclusive(total)).toBeLessThan(total);
    }
  });
});

describe("annualRent", () => {
  it("annualises each supported frequency", () => {
    expect(annualRent(500, "weekly")).toBe(26_000);
    expect(annualRent(1000, "fortnightly")).toBe(26_000);
    expect(annualRent(2000, "monthly")).toBe(24_000);
  });

  it("falls back to monthly for an unknown frequency", () => {
    expect(annualRent(100, "quarterly")).toBe(1200);
  });
});

describe("currency formatting", () => {
  it("formats whole dollars without cents", () => {
    expect(aud(1234)).toBe("$1,234");
  });

  it("formats with cents when asked", () => {
    expect(audCents(1234.5)).toBe("$1,234.50");
  });

  it("keeps negatives signed", () => {
    expect(audCents(-90)).toContain("90.00");
    expect(audCents(-90).startsWith("-")).toBe(true);
  });
});

describe("resolvePeriod", () => {
  it("defaults to this financial year for an unknown key", () => {
    expect(resolvePeriod("nonsense")).toEqual(resolvePeriod("this_fy"));
  });

  it("puts last_fy exactly one year before this_fy", () => {
    const now = resolvePeriod("this_fy");
    const prev = resolvePeriod("last_fy");
    expect(Number(prev.start.slice(0, 4))).toBe(Number(now.start.slice(0, 4)) - 1);
  });

  it("spans everything for 'all'", () => {
    const all = resolvePeriod("all");
    expect(all.start < "2000-01-01").toBe(true);
    expect(all.end > "2100-01-01").toBe(true);
  });
});
