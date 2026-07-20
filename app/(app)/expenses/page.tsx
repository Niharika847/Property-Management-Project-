import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowUpFromLine } from "lucide-react";

export default function ExpensesPage() {
  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Every cost across your portfolio — categorized, GST-split, and tax-ready."
      />
      <EmptyState
        icon={ArrowUpFromLine}
        title="No expenses yet"
        body="Add expenses manually or snap a receipt and let AI file it — coming in the next build phase."
      />
    </>
  );
}
