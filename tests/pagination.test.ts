import { describe, expect, it } from "vitest";
import { pageInfo, pageRangeLabel, parsePage } from "@/lib/pagination";

describe("parsePage", () => {
  it("reads a valid page number", () => {
    expect(parsePage("3")).toBe(3);
  });

  it("falls back to 1 for missing, junk, zero or negative values", () => {
    for (const raw of [undefined, null, "", "abc", "0", "-4", "1e9999"]) {
      expect(parsePage(raw as string | undefined)).toBeGreaterThanOrEqual(1);
    }
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
  });
});

describe("pageInfo", () => {
  it("computes the range for the first page", () => {
    expect(pageInfo(1, 50, 237)).toEqual({ page: 1, pageCount: 5, from: 0, to: 49 });
  });

  it("computes the range for a middle page", () => {
    expect(pageInfo(3, 50, 237)).toEqual({ page: 3, pageCount: 5, from: 100, to: 149 });
  });

  it("clamps a page past the end back to the last real page", () => {
    // This is the bug that made the old 200-row cap invisible: asking for a
    // page that does not exist must not render an empty ledger.
    expect(pageInfo(99, 50, 237).page).toBe(5);
    expect(pageInfo(99, 50, 237).from).toBe(200);
  });

  it("clamps a page below 1", () => {
    expect(pageInfo(-3, 50, 237).page).toBe(1);
  });

  it("always reports at least one page, even with no rows", () => {
    expect(pageInfo(1, 50, 0)).toEqual({ page: 1, pageCount: 1, from: 0, to: 49 });
  });

  it("does not add an empty trailing page when the total divides exactly", () => {
    expect(pageInfo(1, 50, 100).pageCount).toBe(2);
    expect(pageInfo(1, 50, 150).pageCount).toBe(3);
  });

  it("covers every row across all pages with no gaps or overlap", () => {
    const total = 237;
    const size = 50;
    const seen = new Set<number>();
    const { pageCount } = pageInfo(1, size, total);
    for (let p = 1; p <= pageCount; p++) {
      const { from, to } = pageInfo(p, size, total);
      for (let i = from; i <= Math.min(to, total - 1); i++) {
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    }
    expect(seen.size).toBe(total);
  });
});

describe("pageRangeLabel", () => {
  it("labels a full page", () => {
    expect(pageRangeLabel(2, 50, 50)).toEqual({ first: 51, last: 100 });
  });

  it("labels a short final page using the rows actually returned", () => {
    expect(pageRangeLabel(5, 50, 37)).toEqual({ first: 201, last: 237 });
  });

  it("collapses to 0–0 when there is nothing to show", () => {
    expect(pageRangeLabel(1, 50, 0)).toEqual({ first: 0, last: 0 });
  });
});
