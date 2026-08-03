"use client";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete, type AddressPick } from "./address-autocomplete";
import { createProperty, updateProperty } from "@/app/(app)/properties/actions";
import { AU_STATES, PROPERTY_TYPES, STATUS_LABEL } from "@/lib/format";
import type { Property } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PropertyFormSheet({
  open,
  onClose,
  property,
}: {
  open: boolean;
  onClose: () => void;
  property?: Property;
}) {
  const router = useRouter();
  const editing = !!property;
  const [status, setStatus] = useState(property?.status ?? "rental");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fields the address pick can fill in. They stay editable — a lookup is a
  // starting point, not the last word on someone's own property.
  const [suburb, setSuburb] = useState(property?.suburb ?? "");
  const [state, setState] = useState(property?.state ?? "VIC");
  const [postcode, setPostcode] = useState(property?.postcode ?? "");
  const [beds, setBeds] = useState(property?.bedrooms?.toString() ?? "");
  const [baths, setBaths] = useState(property?.bathrooms?.toString() ?? "");
  const [parking, setParking] = useState(property?.parking?.toString() ?? "");
  const [landSize, setLandSize] = useState(property?.land_size?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState(property?.current_value?.toString() ?? "");
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  function onAddressPick({ detail, attributes, attributesAvailable }: AddressPick) {
    if (detail.suburb) setSuburb(detail.suburb);
    if (detail.state) setState(detail.state);
    if (detail.postcode) setPostcode(detail.postcode);

    if (attributes) {
      // Only overwrite a field the provider actually knows — an undefined
      // bedroom count must not wipe a number the user already typed.
      if (attributes.bedrooms != null) setBeds(String(attributes.bedrooms));
      if (attributes.bathrooms != null) setBaths(String(attributes.bathrooms));
      if (attributes.parking != null) setParking(String(attributes.parking));
      if (attributes.landSize != null) setLandSize(String(attributes.landSize));
      if (attributes.estimatedValue != null) setCurrentValue(String(attributes.estimatedValue));
      setLookupNote(`Details from ${attributes.source} — check them and edit anything that's wrong.`);
    } else if (attributesAvailable) {
      setLookupNote("We found the address but no property details for it. Fill them in below.");
    } else {
      setLookupNote("Address filled in. Bedrooms, land size and value need a property data provider — see SETUP.md.");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = editing
      ? await updateProperty(property.id, form)
      : await createProperty(form);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit property" : "Add property"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <AddressAutocomplete
          name="address"
          label="Street address"
          defaultValue={property?.address}
          onPick={onAddressPick}
        />
        {lookupNote && <p className="-mt-2 text-xs text-muted">{lookupNote}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Suburb"
            name="suburb"
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="State"
              name="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input
              label="Postcode"
              name="postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Property["status"])}
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Type" name="property_type" defaultValue={property?.property_type}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Input label="Beds" name="bedrooms" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} />
          <Input label="Baths" name="bathrooms" type="number" min={0} value={baths} onChange={(e) => setBaths(e.target.value)} />
          <Input label="Parking" name="parking" type="number" min={0} value={parking} onChange={(e) => setParking(e.target.value)} />
          <Input label="Land m²" name="land_size" type="number" min={0} value={landSize} onChange={(e) => setLandSize(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Purchase price ($)"
            name="purchase_price"
            inputMode="decimal"
            defaultValue={property?.purchase_price ?? ""}
          />
          <Input
            label="Purchase date"
            name="purchase_date"
            type="date"
            defaultValue={property?.purchase_date ?? ""}
          />
        </div>
        <Input
          label="Current value ($)"
          name="current_value"
          inputMode="decimal"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
        />

        {!editing && status === "rental" && (
          <fieldset className="rounded-(--radius-card) border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Rent (optional)</legend>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Rent amount ($)" name="rent_amount" inputMode="decimal" />
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
              <p className="text-xs text-muted">
                A rent schedule is generated automatically from these details.
              </p>
            </div>
          </fieldset>
        )}

        <Textarea label="Notes" name="notes" defaultValue={property?.notes ?? ""} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={saving} className="flex-1">
            {editing ? "Save changes" : "Add property"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
