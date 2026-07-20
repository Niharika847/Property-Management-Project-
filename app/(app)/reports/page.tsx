import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileBarChart } from "lucide-react";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Monthly, annual, tax, and portfolio reports — PDF, Excel, or CSV."
      />
      <EmptyState
        icon={FileBarChart}
        title="No reports yet"
        body="Reports generate from your ledger, so they unlock once income and expenses are being tracked."
      />
    </>
  );
}
