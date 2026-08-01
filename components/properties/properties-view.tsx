"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { PropertyFormSheet } from "./property-form-sheet";
import { aud, FREQUENCY_LABEL, annualRent } from "@/lib/format";
import type { Lease, Property } from "@/lib/types";
import { Building2, Plus, BedDouble, Bath, Car } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function PropertiesView({
  properties,
  leasesByProperty,
}: {
  properties: Property[];
  leasesByProperty: Record<string, Lease>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="mb-4 flex shrink-0 items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Properties</h1>
          <p className="mt-1 text-sm text-muted">
            {properties.length === 0
              ? "Every property you own, with its status, rent, and performance."
              : `${properties.length} propert${properties.length === 1 ? "y" : "ies"} in your portfolio.`}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add property
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          body="Add your first property to start tracking income, expenses, and value."
          action={<Button onClick={() => setAdding(true)}>Add your first property</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:content-start lg:overflow-y-auto">
          {properties.map((p) => {
            const lease = leasesByProperty[p.id];
            const yieldPct =
              lease && p.current_value
                ? (annualRent(lease.rent_amount, lease.frequency) / p.current_value) * 100
                : null;
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="group rounded-(--radius-card) border border-line bg-card p-5 transition-colors hover:border-brand"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink group-hover:text-brand">
                      {p.address}
                    </div>
                    <div className="truncate text-sm text-muted">
                      {[p.suburb, p.state, p.postcode].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  <StatusPill value={p.status} />
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  {p.bedrooms != null && (
                    <span className="flex items-center gap-1">
                      <BedDouble className="size-3.5" aria-hidden /> {p.bedrooms}
                    </span>
                  )}
                  {p.bathrooms != null && (
                    <span className="flex items-center gap-1">
                      <Bath className="size-3.5" aria-hidden /> {p.bathrooms}
                    </span>
                  )}
                  {p.parking != null && (
                    <span className="flex items-center gap-1">
                      <Car className="size-3.5" aria-hidden /> {p.parking}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                  <div>
                    <div className="text-xs text-muted">Rent</div>
                    <div className="tabular text-sm font-semibold text-ink">
                      {lease
                        ? `${aud(lease.rent_amount)}/${FREQUENCY_LABEL[lease.frequency]}`
                        : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Value</div>
                    <div className="tabular text-sm font-semibold text-ink">
                      {p.current_value ? aud(p.current_value) : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Yield</div>
                    <div className="tabular text-sm font-semibold text-brand">
                      {yieldPct ? `${yieldPct.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <PropertyFormSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
