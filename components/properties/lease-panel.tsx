"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { addLease, endLease } from "@/app/(app)/properties/actions";
import { aud, FREQUENCY_LABEL, fmtDate } from "@/lib/format";
import type { Lease } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LeasePanel({
  propertyId,
  lease,
}: {
  propertyId: string;
  lease: Lease | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAddLease(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await addLease(propertyId, new FormData(e.currentTarget));
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    setBusy(false);
    setAdding(false);
    router.refresh();
  }

  async function onEndLease() {
    if (!lease) return;
    setBusy(true);
    await endLease(lease.id, propertyId);
    setBusy(false);
    setConfirmingEnd(false);
    router.refresh();
  }

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Tenancy</h2>
        {lease && <StatusPill value={lease.status} />}
      </div>
      {lease ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Rent</dt>
            <dd className="tabular text-right font-semibold text-ink">
              {aud(lease.rent_amount)}/{FREQUENCY_LABEL[lease.frequency]}
            </dd>
            <dt className="text-muted">Tenant</dt>
            <dd className="text-right text-ink">{lease.tenants?.full_name ?? "Not recorded"}</dd>
            <dt className="text-muted">Started</dt>
            <dd className="text-right text-ink">{fmtDate(lease.start_date)}</dd>
            {lease.bond_amount != null && (
              <>
                <dt className="text-muted">Bond</dt>
                <dd className="tabular text-right text-ink">{aud(lease.bond_amount)}</dd>
              </>
            )}
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            {confirmingEnd ? (
              <div className="flex items-center gap-2">
                <Button variant="danger" loading={busy} onClick={onEndLease} className="flex-1">
                  End lease — property becomes vacant
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingEnd(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingEnd(true)}>
                End lease…
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            No active lease. Add one to start the rent schedule.
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
            Add lease
          </Button>
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add lease">
        <form onSubmit={onAddLease} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rent amount ($)" name="rent_amount" inputMode="decimal" required />
            <Select label="Frequency" name="frequency" defaultValue="weekly">
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tenant name" name="tenant_name" placeholder="Optional" />
            <Input label="Bond ($)" name="bond_amount" inputMode="decimal" />
          </div>
          <Input label="Lease start" name="lease_start" type="date" />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={busy} className="flex-1">
              Add lease
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
