import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Receipts, invoices, leases, and statements — filed automatically."
      />
      <EmptyState
        icon={FileText}
        title="No documents yet"
        body="Uploads land here, get read by AI, and link themselves to the right property and transaction."
      />
    </>
  );
}
