import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowDownToLine } from "lucide-react";

export default function IncomePage() {
  return (
    <>
      <PageHeader
        title="Income"
        subtitle="Rent schedules, payments received, and anything outstanding."
      />
      <EmptyState
        icon={ArrowDownToLine}
        title="No income tracked yet"
        body="Once a property has a lease, its rent schedule and payment history appear here."
      />
    </>
  );
}
