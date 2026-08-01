"use client";

import { Select } from "@/components/ui/select";
import { REPORT_PERIODS } from "@/lib/format";
import type { Property } from "@/lib/types";
import { FileBarChart, Receipt, Download, Printer } from "lucide-react";
import { useState } from "react";

const REPORTS = [
  {
    value: "tax",
    label: "Tax summary",
    icon: Receipt,
    desc: "Income, expenses by category, GST and deductible totals — the tax-time numbers.",
  },
  {
    value: "ledger",
    label: "Transaction ledger",
    icon: FileBarChart,
    desc: "Every income and expense line for the period, ready for your accountant.",
  },
];

export function ReportsView({ properties }: { properties: Pick<Property, "id" | "address">[] }) {
  const [report, setReport] = useState("tax");
  const [period, setPeriod] = useState("this_fy");
  const [property, setProperty] = useState("all");

  const qs = `report=${report}&period=${period}&property=${property}`;

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          Generate a tax summary or transaction ledger — download as CSV or save as PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => {
          const active = report === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setReport(r.value)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-2 rounded-(--radius-card) border p-5 text-left transition-colors ${
                active ? "border-brand bg-brand-soft/40" : "border-line bg-card hover:border-brand/50"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-lg ${
                  active ? "bg-brand text-white" : "bg-brand-soft text-brand"
                }`}
              >
                <r.icon className="size-4" aria-hidden />
              </span>
              <span className="font-semibold text-ink">{r.label}</span>
              <span className="text-sm text-muted">{r.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-(--radius-card) border border-line bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {REPORT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select label="Property" value={property} onChange={(e) => setProperty(e.target.value)}>
            <option value="all">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`/reports/print?${qs}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-(--radius-field) bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Printer className="size-4" aria-hidden /> Open print view (PDF)
          </a>
          <a
            href={`/reports/export?${qs}`}
            className="flex items-center gap-2 rounded-(--radius-field) border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-soft/50"
          >
            <Download className="size-4" aria-hidden /> Download CSV
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">
          CSV opens in Excel or Google Sheets. For a PDF, open the print view and choose “Save as
          PDF” in the print dialog.
        </p>
      </div>
    </div>
  );
}
