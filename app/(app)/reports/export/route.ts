import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { resolvePeriod } from "@/lib/format";
import { fetchReport, summarize } from "@/lib/reports";

function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const workspace = await ensureWorkspace(supabase, user);
  if (!workspace) return new Response("No workspace", { status: 400 });

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "ledger";
  const period = url.searchParams.get("period") ?? "this_fy";
  const property = url.searchParams.get("property") ?? "all";
  const range = resolvePeriod(period);
  const data = await fetchReport(supabase, workspace.id, range, property);

  let rows: (string | number)[][];
  let name: string;

  if (report === "tax") {
    const s = summarize(data);
    rows = [
      ["Roost — Tax summary", range.label],
      [],
      ["Income total", s.incomeTotal.toFixed(2)],
      ["Expense total", s.expenseTotal.toFixed(2)],
      ["Net", s.net.toFixed(2)],
      ["GST paid", s.gstTotal.toFixed(2)],
      ["Tax-deductible total", s.deductibleTotal.toFixed(2)],
      [],
      ["Category", "Total", "GST", "Deductible"],
      ...s.categories.map((c) => [c.category, c.total.toFixed(2), c.gst.toFixed(2), c.deductible.toFixed(2)]),
    ];
    name = "roost-tax-summary";
  } else {
    const all = [
      ...data.income.map((r) => ({
        date: r.date,
        type: "Income",
        property: r.property,
        detail: r.type === "rent" ? "Rent" : (r.description ?? "Income"),
        vendor: "",
        amount: r.amount,
        gst: 0,
        deductible: "",
      })),
      ...data.expenses.map((e) => ({
        date: e.date,
        type: "Expense",
        property: e.property,
        detail: `${e.category} — ${e.description}`,
        vendor: e.vendor ?? "",
        amount: -e.amount,
        gst: e.gst_amount,
        deductible: e.is_tax_deductible ? "Yes" : "No",
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    rows = [
      ["Date", "Type", "Property", "Detail", "Vendor", "Amount", "GST", "Deductible"],
      ...all.map((r) => [r.date, r.type, r.property, r.detail, r.vendor, r.amount.toFixed(2), r.gst.toFixed(2), r.deductible]),
    ];
    name = "roost-ledger";
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${period}.csv"`,
    },
  });
}
