import { describe, expect, it } from "vitest";
import { summarize, type ReportData } from "@/lib/reports";

const expense = (over: Partial<ReportData["expenses"][number]> = {}) => ({
  date: "2026-08-01",
  amount: 100,
  gst_amount: 9.09,
  is_tax_deductible: true,
  description: "Thing",
  vendor: null,
  category: "Repairs",
  property: "12 Kent St",
  ...over,
});

const income = (over: Partial<ReportData["income"][number]> = {}) => ({
  date: "2026-08-01",
  amount: 500,
  type: "rent",
  description: null,
  property: "12 Kent St",
  ...over,
});

describe("summarize — the numbers that go on a tax summary", () => {
  it("returns zeroes for an empty report rather than NaN", () => {
    const s = summarize({ expenses: [], income: [] });
    expect(s).toMatchObject({
      incomeTotal: 0,
      expenseTotal: 0,
      gstTotal: 0,
      deductibleTotal: 0,
      net: 0,
    });
    expect(s.categories).toEqual([]);
  });

  it("totals income and expenses", () => {
    const s = summarize({
      expenses: [expense({ amount: 100 }), expense({ amount: 250 })],
      income: [income({ amount: 500 }), income({ amount: 1500 })],
    });
    expect(s.incomeTotal).toBe(2000);
    expect(s.expenseTotal).toBe(350);
  });

  it("computes net as income minus expenses", () => {
    const s = summarize({ expenses: [expense({ amount: 350 })], income: [income({ amount: 2000 })] });
    expect(s.net).toBe(1650);
  });

  it("reports a negative net when a property runs at a loss", () => {
    const s = summarize({ expenses: [expense({ amount: 3000 })], income: [income({ amount: 500 })] });
    expect(s.net).toBe(-2500);
  });

  it("counts only deductible expenses toward the deductible total", () => {
    const s = summarize({
      expenses: [
        expense({ amount: 100, is_tax_deductible: true }),
        expense({ amount: 900, is_tax_deductible: false }),
      ],
      income: [],
    });
    expect(s.expenseTotal).toBe(1000);
    expect(s.deductibleTotal).toBe(100);
  });

  it("sums GST across every expense", () => {
    const s = summarize({
      expenses: [expense({ gst_amount: 10 }), expense({ gst_amount: 5.5 })],
      income: [],
    });
    expect(s.gstTotal).toBeCloseTo(15.5, 10);
  });

  it("groups by category and sorts largest first", () => {
    const s = summarize({
      expenses: [
        expense({ category: "Repairs", amount: 100 }),
        expense({ category: "Insurance", amount: 900 }),
        expense({ category: "Repairs", amount: 50 }),
      ],
      income: [],
    });
    expect(s.categories.map((c) => c.category)).toEqual(["Insurance", "Repairs"]);
    expect(s.categories[0].total).toBe(900);
    expect(s.categories[1].total).toBe(150);
  });

  it("keeps per-category deductible separate from per-category total", () => {
    const s = summarize({
      expenses: [
        expense({ category: "Reno", amount: 5000, is_tax_deductible: false }),
        expense({ category: "Reno", amount: 200, is_tax_deductible: true }),
      ],
      income: [],
    });
    expect(s.categories[0]).toMatchObject({ total: 5200, deductible: 200 });
  });

  it("keeps category totals adding up to the expense total", () => {
    const s = summarize({
      expenses: [
        expense({ category: "A", amount: 10 }),
        expense({ category: "B", amount: 20 }),
        expense({ category: "C", amount: 30 }),
      ],
      income: [],
    });
    const summed = s.categories.reduce((acc, c) => acc + c.total, 0);
    expect(summed).toBe(s.expenseTotal);
  });
});
