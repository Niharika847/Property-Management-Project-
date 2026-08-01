const audFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const audCentsFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const aud = (n: number) => audFmt.format(n);
export const audCents = (n: number) => audCentsFmt.format(n);
export const fmtDate = (d: string | Date) =>
  dateFmt.format(typeof d === "string" ? new Date(`${d}T00:00:00`) : d);

/** Australian financial year containing `today`: 1 July – 30 June. */
export function fyRange(today = new Date()): { start: string; end: string; label: string } {
  const y = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    start: `${y}-07-01`,
    end: `${y + 1}-06-30`,
    label: `FY${y}–${String(y + 1).slice(2)}`,
  };
}

export function monthRange(today = new Date()): { start: string; end: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Rent frequency → payments per year. */
export const ANNUAL_FACTOR: Record<string, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

export const annualRent = (amount: number, frequency: string) =>
  amount * (ANNUAL_FACTOR[frequency] ?? 12);

/** Australian GST on a GST-inclusive price is 1/11th of the total, rounded to
 *  cents. Returns 0 for anything that is not a positive amount. */
export function gstFromInclusive(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round((total / 11) * 100) / 100;
}

export const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "wk",
  fortnightly: "fn",
  monthly: "mo",
};

export const STATUS_LABEL: Record<string, string> = {
  rental: "Rental",
  owner_occupied: "Owner occupied",
  vacant: "Vacant",
  under_construction: "Under construction",
  sold: "Sold",
};

export const PROPERTY_TYPES = [
  "house",
  "apartment",
  "townhouse",
  "unit",
  "land",
  "commercial",
] as const;

export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

export const REPORT_PERIODS = [
  { value: "this_fy", label: "This financial year" },
  { value: "last_fy", label: "Last financial year" },
  { value: "this_month", label: "This month" },
  { value: "all", label: "All time" },
] as const;

/** Resolve a report period key into a concrete date range + human label. */
export function resolvePeriod(period?: string): { start: string; end: string; label: string } {
  const now = new Date();
  switch (period) {
    case "this_month":
      return {
        ...monthRange(now),
        label: now.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
      };
    case "last_fy": {
      const d = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const r = fyRange(d);
      return { start: r.start, end: r.end, label: r.label };
    }
    case "all":
      return { start: "1900-01-01", end: "2999-12-31", label: "All time" };
    case "this_fy":
    default: {
      const r = fyRange(now);
      return { start: r.start, end: r.end, label: r.label };
    }
  }
}
