"use client";

import { Button } from "@/components/ui/button";
import { PropertyFormSheet } from "./property-form-sheet";
import { deleteProperty } from "@/app/(app)/properties/actions";
import type { Property } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PropertyActions({ property }: { property: Property }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    const result = await deleteProperty(property.id);
    if (result.ok) {
      router.push("/properties");
      router.refresh();
    } else {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      {confirming ? (
        <>
          <Button variant="danger" loading={deleting} onClick={onDelete}>
            Delete property and all its records
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)} aria-label="Delete property">
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}
      <PropertyFormSheet open={editing} onClose={() => setEditing(false)} property={property} />
    </div>
  );
}
