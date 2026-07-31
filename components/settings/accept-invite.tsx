"use client";

import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/app/(app)/settings/team-actions";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvite({
  inviteId,
  workspaceName,
  roleLabel,
}: {
  inviteId: string;
  workspaceName: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await acceptInvite(inviteId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Users className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">Join {workspaceName}</h1>
      <p className="mt-2 text-sm text-muted">
        You&apos;ve been invited as <strong className="text-ink">{roleLabel}</strong>. Accepting
        gives you access to this portfolio.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <Button className="mt-5 w-full" loading={busy} onClick={accept}>
        Accept invitation
      </Button>
    </div>
  );
}
