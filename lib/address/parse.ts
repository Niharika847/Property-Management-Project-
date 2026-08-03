import { AU_STATES } from "@/lib/format";
import type { AddressDetail } from "./types";

const STATE_NAMES: Record<string, string> = {
  "new south wales": "NSW",
  victoria: "VIC",
  queensland: "QLD",
  "western australia": "WA",
  "south australia": "SA",
  tasmania: "TAS",
  "australian capital territory": "ACT",
  "northern territory": "NT",
};

/** Normalises whatever a provider calls a state into the abbreviation the
 *  property form stores. Returns "" when it cannot tell, so the form keeps its
 *  own default rather than saving a wrong state. */
export function normaliseState(raw: string | undefined | null): string {
  if (!raw) return "";
  const value = raw.trim();
  const upper = value.toUpperCase();
  if ((AU_STATES as readonly string[]).includes(upper)) return upper;
  return STATE_NAMES[value.toLowerCase()] ?? "";
}

/** Australian postcodes are exactly four digits. */
export function normalisePostcode(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return /^\d{4}$/.test(digits) ? digits : "";
}

/** Joins a house number and street name, tolerating either being missing. */
export function joinStreet(
  houseNumber: string | undefined | null,
  road: string | undefined | null
): string {
  return [houseNumber?.trim(), road?.trim()].filter(Boolean).join(" ").trim();
}

/** Last-resort parser for providers that only return a formatted string.
 *
 *  Australian addresses format predictably as
 *  "12 Kent Street, Richmond VIC 3121, Australia", so the tail can be peeled
 *  off from the right. Anything it cannot identify is left blank rather than
 *  guessed into the wrong field. */
export function parseFormattedAddress(formatted: string): AddressDetail {
  const empty: AddressDetail = { street: "", suburb: "", state: "", postcode: "" };
  if (!formatted?.trim()) return empty;

  const parts = formatted
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "australia");
  if (parts.length === 0) return empty;

  // The final part usually carries "Suburb STATE 3121" or "STATE 3121".
  const tail = parts[parts.length - 1];
  const tailMatch = tail.match(/^(.*?)\s*\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b\s*(\d{4})?$/i);

  if (tailMatch) {
    const [, suburbInTail, state, postcode] = tailMatch;
    const suburb = suburbInTail.trim() || (parts.length > 1 ? parts[parts.length - 2] : "");
    const streetParts =
      suburbInTail.trim() || parts.length < 2 ? parts.slice(0, -1) : parts.slice(0, -2);
    return {
      street: streetParts.join(", "),
      suburb,
      state: normaliseState(state),
      postcode: normalisePostcode(postcode),
    };
  }

  // No state found: treat the last chunk as the suburb and the rest as street.
  return {
    street: parts.slice(0, -1).join(", "),
    suburb: parts.length > 1 ? parts[parts.length - 1] : "",
    state: "",
    postcode: "",
  };
}
