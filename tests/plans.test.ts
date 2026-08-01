import { describe, expect, it } from "vitest";
import { PLANS, planFor, propertyLimitMessage } from "@/lib/plans";

describe("planFor", () => {
  it("resolves a known plan key", () => {
    expect(planFor("pro").key).toBe("pro");
  });

  it("falls back to free for null, undefined or an unknown key", () => {
    expect(planFor(null).key).toBe("free");
    expect(planFor(undefined).key).toBe("free");
    expect(planFor("enterprise-ultra").key).toBe("free");
  });

  it("never returns undefined for any input", () => {
    for (const key of ["", "FREE", "pro ", "0", "__proto__"]) {
      expect(planFor(key)).toBeTruthy();
      expect(typeof planFor(key).label).toBe("string");
    }
  });
});

describe("propertyLimitMessage — the gate on adding properties", () => {
  it("allows a free account under the limit", () => {
    expect(propertyLimitMessage(PLANS.free, 0)).toBeNull();
  });

  it("blocks a free account that is at the limit", () => {
    const msg = propertyLimitMessage(PLANS.free, 1);
    expect(msg).toContain("Free");
    expect(msg).toContain("Upgrade");
  });

  it("uses singular wording for a one-property plan", () => {
    expect(propertyLimitMessage(PLANS.free, 1)).toContain("1 property");
  });

  it("uses plural wording for a multi-property plan", () => {
    expect(propertyLimitMessage(PLANS.pro, 5)).toContain("5 properties");
  });

  it("never blocks an unlimited plan, however many properties exist", () => {
    expect(propertyLimitMessage(PLANS.portfolio, 500)).toBeNull();
    expect(propertyLimitMessage(PLANS.agency, 10_000)).toBeNull();
  });

  it("blocks rather than crashes when an account is already over its limit", () => {
    // Someone downgraded, or a plan's limit was lowered. They keep their data;
    // they just cannot add more.
    expect(propertyLimitMessage(PLANS.free, 9)).toBeTruthy();
  });
});

describe("plan definitions", () => {
  it("keeps every plan's key matching its map entry", () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      expect(plan.key).toBe(key);
    }
  });

  it("orders paid tiers no more restrictively than free", () => {
    const free = PLANS.free.properties!;
    expect(PLANS.pro.properties!).toBeGreaterThan(free);
    expect(PLANS.portfolio.properties).toBeNull();
  });
});
