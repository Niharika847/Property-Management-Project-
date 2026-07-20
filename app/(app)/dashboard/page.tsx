import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const KPIS = [
  { label: "Portfolio value", hint: "Add valuations to your properties" },
  { label: "Net cash flow / mo", hint: "Tracks income minus expenses" },
  { label: "Rental income / mo", hint: "From your rent schedules" },
  { label: "Outstanding rent", hint: "Late and missed payments" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });
  const hasProperties = (count ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your portfolio at a glance — value, cash flow, and what needs attention."
      />
      {hasProperties ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-(--radius-card) border border-line bg-card p-5"
            >
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                {kpi.label}
              </div>
              <div className="tabular mt-2 text-2xl font-bold text-ink">—</div>
              <div className="mt-1 text-xs text-muted">{kpi.hint}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="Add your first property"
          body="Your dashboard lights up once there's a property to track — value, rent, expenses, and AI insights all start there."
          action={
            <Link
              href="/properties"
              className="rounded-(--radius-field) bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to Properties
            </Link>
          }
        />
      )}
    </>
  );
}
