import { joinStreet, normalisePostcode, normaliseState, parseFormattedAddress } from "./parse";
import type { AddressDetail, AddressSuggestion } from "./types";

export * from "./types";
export * from "./parse";

/** Address lookup, provider-agnostic.
 *
 *  Google Places is used when GOOGLE_PLACES_API_KEY is set. Without a key it
 *  falls back to OpenStreetMap's Nominatim, which needs no account but is rate
 *  limited to roughly one request a second and has thinner unit-level coverage
 *  in Australia — fine for getting started, not for real traffic. */

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

export const addressProvider = () => (GOOGLE_KEY ? "google" : "nominatim");

/** OSM asks every client to identify itself; requests without this are blocked. */
const USER_AGENT = "Roost Property Manager (https://property-management-project.vercel.app)";

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  // Below four characters every query matches half the country, which wastes a
  // provider call per keystroke and returns nothing useful.
  if (q.length < 4) return [];
  return GOOGLE_KEY ? googleSearch(q) : nominatimSearch(q);
}

export async function addressDetail(id: string): Promise<AddressDetail | null> {
  return GOOGLE_KEY ? googleDetail(id) : nominatimDetail(id);
}

/* ------------------------------- Google ------------------------------- */

async function googleSearch(q: string): Promise<AddressSuggestion[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY!,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["au"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Places autocomplete failed (${res.status})`);

  const data = (await res.json()) as {
    suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
  };
  return (data.suggestions ?? [])
    .map((s) => ({
      id: s.placePrediction?.placeId ?? "",
      label: s.placePrediction?.text?.text ?? "",
    }))
    .filter((s) => s.id && s.label);
}

async function googleDetail(placeId: string): Promise<AddressDetail | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_KEY!,
        "X-Goog-FieldMask": "addressComponents,location,formattedAddress",
      },
      signal: AbortSignal.timeout(6000),
    }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  };

  const pick = (type: string, short = false) => {
    const c = data.addressComponents?.find((c) => c.types?.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };

  const street = joinStreet(pick("street_number"), pick("route"));
  const detail: AddressDetail = {
    street: street || parseFormattedAddress(data.formattedAddress ?? "").street,
    suburb: pick("locality") || pick("sublocality"),
    state: normaliseState(pick("administrative_area_level_1", true)),
    postcode: normalisePostcode(pick("postal_code")),
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
  };
  // A subpremise (unit number) belongs in front of the street number.
  const unit = pick("subpremise");
  if (unit && detail.street) detail.street = `${unit}/${detail.street}`;
  return detail;
}

/* ------------------------------ Nominatim ------------------------------ */

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

async function nominatimFetch(q: string): Promise<NominatimPlace[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "au");
  url.searchParams.set("limit", "6");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Nominatim search failed (${res.status})`);
  return (await res.json()) as NominatimPlace[];
}

/** Nominatim has no separate detail endpoint, so the search result is cached
 *  briefly and the "detail" step reads from it. */
const nominatimCache = new Map<string, NominatimPlace>();

async function nominatimSearch(q: string): Promise<AddressSuggestion[]> {
  const places = await nominatimFetch(q);
  for (const p of places) {
    nominatimCache.set(String(p.place_id), p);
  }
  // Bound the cache so a long-lived server process cannot grow without limit.
  if (nominatimCache.size > 500) {
    for (const key of [...nominatimCache.keys()].slice(0, 250)) nominatimCache.delete(key);
  }
  return places.map((p) => ({ id: String(p.place_id), label: p.display_name }));
}

async function nominatimDetail(id: string): Promise<AddressDetail | null> {
  const place = nominatimCache.get(id);
  if (!place) return null;
  return placeToDetail(place);
}

export function placeToDetail(place: NominatimPlace): AddressDetail {
  const a = place.address ?? {};
  const street = joinStreet(a.house_number, a.road);
  const fallback = parseFormattedAddress(place.display_name);
  return {
    street: street || fallback.street,
    suburb: a.suburb || a.city || a.town || a.village || a.municipality || fallback.suburb,
    state: normaliseState(a.state) || fallback.state,
    postcode: normalisePostcode(a.postcode) || fallback.postcode,
    latitude: Number(place.lat) || undefined,
    longitude: Number(place.lon) || undefined,
  };
}
