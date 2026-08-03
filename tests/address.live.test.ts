import { describe, expect, it } from "vitest";
import { addressDetail, addressProvider, searchAddresses } from "@/lib/address";

/** Hits the real address provider. Excluded from the default `npm test` run so
 *  the suite stays offline and fast; run with `npm run test:live`. */
describe("live address lookup", () => {
  it("finds a real Melbourne address and splits it into form fields", async () => {
    console.log("provider:", addressProvider());
    const suggestions = await searchAddresses("1 Collins Street Melbourne");
    console.log("suggestions:", suggestions.map((s) => s.label).slice(0, 3));
    expect(suggestions.length).toBeGreaterThan(0);

    const detail = await addressDetail(suggestions[0].id);
    console.log("detail:", detail);
    expect(detail).not.toBeNull();
    expect(detail!.state).toBe("VIC");
    expect(detail!.postcode).toMatch(/^\d{4}$/);
    expect(detail!.suburb.length).toBeGreaterThan(0);
  }, 20000);

  it("returns nothing for a query too short to be meaningful", async () => {
    expect(await searchAddresses("12 ")).toEqual([]);
  });
});
