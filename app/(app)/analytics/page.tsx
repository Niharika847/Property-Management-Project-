import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LineChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Trends, comparisons, and forecasts across your portfolio."
      />
      <EmptyState
        icon={LineChart}
        title="Nothing to analyze yet"
        body="Charts appear here as your ledger grows — cash flow timelines, expense trends, and property comparisons."
      />
    </>
  );
}
