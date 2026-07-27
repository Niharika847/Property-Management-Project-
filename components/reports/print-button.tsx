"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print flex items-center gap-2 rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
    >
      <Printer className="size-4" aria-hidden /> Print / Save as PDF
    </button>
  );
}
