import { AssistantChat } from "@/components/assistant/assistant-chat";
import { aiConfigured } from "@/lib/anthropic";
import { Suspense } from "react";

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantChat aiOn={aiConfigured()} />
    </Suspense>
  );
}
