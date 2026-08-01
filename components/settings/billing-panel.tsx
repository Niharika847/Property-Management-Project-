"use client";

import { openBillingPortal, startCheckout } from "@/app/(app)/settings/billing-actions";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/plans";
import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";

/** The purchase side of the plan section. Rendered only when the deployment
 *  actually has Stripe keys — otherwise Settings keeps saying billing isn't
 *  live yet, rather than showing buttons that cannot work. */
export function BillingPanel({
  currentPlan,
  planStatus,
  plans,
  isOwner,
  hasCustomer,
}: {
  currentPlan: string;
  planStatus: string | null;
  plans: Plan[];
  isOwner: boolean;
  hasCustomer: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>, key: string) {
    setBusy(key);
    setError(null);
    const res = await action();
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    // Stripe hosts checkout and the portal, so hand the browser over.
    window.location.href = res.url;
  }

  if (!isOwner) {
    return (
      <p className="mt-4 text-xs text-muted">
        Only the workspace owner can change the plan or manage billing.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {planStatus && planStatus !== "active" && planStatus !== "trialing" && (
        <p className="mb-3 rounded-(--radius-field) border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
          Your subscription is <span className="font-semibold">{planStatus}</span>, so the workspace
          is on the free plan until payment succeeds.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {plans.map((p) => {
          const active = p.key === currentPlan;
          return (
            <div
              key={p.key}
              className={`flex items-center justify-between gap-3 rounded-(--radius-field) border p-3 ${
                active ? "border-brand bg-brand-soft/40" : "border-line"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  {p.label}
                  {active && <Check className="size-3.5 text-brand" aria-hidden />}
                </div>
                <div className="text-xs text-muted">
                  {p.price} ·{" "}
                  {p.properties == null ? "unlimited properties" : `${p.properties} properties`}
                </div>
              </div>
              {active ? (
                <span className="shrink-0 text-xs font-semibold text-brand">Current</span>
              ) : (
                <Button
                  onClick={() => go(() => startCheckout(p.key), p.key)}
                  loading={busy === p.key}
                  className="h-8 shrink-0 px-3 text-xs"
                >
                  Choose
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {hasCustomer && (
        <button
          type="button"
          onClick={() => go(openBillingPortal, "portal")}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          {busy === "portal" ? "Opening…" : "Manage billing, invoices and card"}
          <ExternalLink className="size-3.5" aria-hidden />
        </button>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <p className="mt-3 text-xs text-muted">
        Payments are handled by Stripe. Roost never sees your card details.
      </p>
    </div>
  );
}
