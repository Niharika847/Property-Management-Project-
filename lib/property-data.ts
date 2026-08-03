import { log } from "@/lib/logger";
import type { AddressDetail, PropertyAttributes } from "@/lib/address/types";

/** Bedrooms, land size and a value estimate for a specific address.
 *
 *  There is no free source for this. Address geocoders (Google, OSM) know where
 *  a building is, not how many bedrooms it has — that data comes from
 *  commercial property providers who license it: Domain, CoreLogic, PropTrack.
 *  So this is env-gated like billing: with DOMAIN_API_KEY set the lookup runs,
 *  without it the form simply asks the user to fill the fields in.
 *
 *  What it must never do is invent numbers. A guessed land size or valuation is
 *  worse than a blank field in an app people use for tax and lending decisions,
 *  and it is specifically why the AI assistant is not used for this. */

const DOMAIN_KEY = process.env.DOMAIN_API_KEY;

export const propertyDataConfigured = () => Boolean(DOMAIN_KEY);

export async function lookupPropertyAttributes(
  address: AddressDetail
): Promise<PropertyAttributes | null> {
  if (!DOMAIN_KEY) return null;
  if (!address.street || !address.suburb) return null;

  try {
    const terms = [address.street, address.suburb, address.state, address.postcode]
      .filter(Boolean)
      .join(" ");

    // Step 1: resolve the address to Domain's own property id.
    const suggestRes = await fetch(
      `https://api.domain.com.au/v1/properties/_suggest?terms=${encodeURIComponent(terms)}&pageSize=1`,
      { headers: { "X-Api-Key": DOMAIN_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (!suggestRes.ok) throw new Error(`Domain suggest failed (${suggestRes.status})`);

    const suggestions = (await suggestRes.json()) as { id?: string }[];
    const id = suggestions?.[0]?.id;
    if (!id) return null;

    // Step 2: read the attributes Domain holds for it.
    const detailRes = await fetch(`https://api.domain.com.au/v1/properties/${id}`, {
      headers: { "X-Api-Key": DOMAIN_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!detailRes.ok) throw new Error(`Domain property failed (${detailRes.status})`);

    const d = (await detailRes.json()) as {
      bedrooms?: number;
      bathrooms?: number;
      carSpaces?: number;
      landAreaSqm?: number;
      propertyCategory?: string;
    };

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

    return {
      bedrooms: num(d.bedrooms),
      bathrooms: num(d.bathrooms),
      parking: num(d.carSpaces),
      landSize: num(d.landAreaSqm),
      propertyType: typeof d.propertyCategory === "string" ? d.propertyCategory.toLowerCase() : undefined,
      source: "Domain",
      asAt: new Date().toISOString().slice(0, 10),
    };
  } catch (e) {
    // A lookup failure must never block adding a property by hand.
    log.error("property_data.lookup_failed", e, { suburb: address.suburb });
    return null;
  }
}
