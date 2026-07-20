import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask anything about your properties and money — answers come from your real ledger."
      />
      <EmptyState
        icon={Sparkles}
        title="Your financial assistant"
        body='Soon you&apos;ll ask things like "How much did I spend on maintenance this year?" and get answers backed by your own data.'
      />
    </>
  );
}
