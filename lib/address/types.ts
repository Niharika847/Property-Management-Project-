/** One row in the address dropdown. */
export interface AddressSuggestion {
  /** Opaque id the detail lookup understands, provider-specific. */
  id: string;
  /** Full address as the provider formats it, shown in the list. */
  label: string;
}

/** Address broken into the fields the property form actually stores. */
export interface AddressDetail {
  /** Unit/street number and street name, e.g. "12 Kent Street". */
  street: string;
  suburb: string;
  /** Australian state abbreviation, e.g. "VIC". */
  state: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
}

/** Attributes for a specific property. Every field is optional because no data
 *  source has complete coverage — a missing bedroom count must stay empty for
 *  the user to fill in, never be guessed. */
export interface PropertyAttributes {
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  /** Square metres. */
  landSize?: number;
  propertyType?: string;
  /** Automated valuation estimate in AUD. */
  estimatedValue?: number;
  estimatedValueLow?: number;
  estimatedValueHigh?: number;
  /** Where this came from, shown to the user — an estimate presented without
   *  a source is indistinguishable from a number the app made up. */
  source: string;
  asAt?: string;
}
