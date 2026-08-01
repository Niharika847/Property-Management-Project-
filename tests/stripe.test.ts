import { afterEach, describe, expect, it, vi } from "vitest";
import { planForSubscriptionStatus } from "@/lib/stripe";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("planForSubscriptionStatus — who is entitled to a paid plan", () => {
  it("grants the plan while the subscription is active", () => {
    expect(planForSubscriptionStatus("pro", "active")).toBe("pro");
  });

  it("grants the plan during a trial", () => {
    expect(planForSubscriptionStatus("portfolio", "trialing")).toBe("portfolio");
  });

  it("drops to free for every non-paying status", () => {
    // The whole point of the plan column is gating limits, so anything that is
    // not currently being paid for must not keep the paid entitlement.
    for (const status of ["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"]) {
      expect(planForSubscriptionStatus("agency", status)).toBe("free");
    }
  });

  it("drops to free for a missing or unknown status", () => {
    expect(planForSubscriptionStatus("pro", null)).toBe("free");
    expect(planForSubscriptionStatus("pro", undefined)).toBe("free");
    expect(planForSubscriptionStatus("pro", "something_new")).toBe("free");
  });

  it("returns free when there is no plan to grant, however healthy the status", () => {
    expect(planForSubscriptionStatus(null, "active")).toBe("free");
  });
});

describe("planKeyForPrice — mapping Stripe prices back to plans", () => {
  it("resolves a configured price to its plan", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
    vi.stubEnv("STRIPE_PRICE_PORTFOLIO", "price_portfolio_456");
    vi.resetModules();
    const { planKeyForPrice } = await import("@/lib/stripe");

    expect(planKeyForPrice("price_pro_123")).toBe("pro");
    expect(planKeyForPrice("price_portfolio_456")).toBe("portfolio");
  });

  it("refuses to guess for an unknown, empty or missing price", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
    vi.resetModules();
    const { planKeyForPrice } = await import("@/lib/stripe");

    expect(planKeyForPrice("price_someone_elses")).toBeNull();
    expect(planKeyForPrice(null)).toBeNull();
    expect(planKeyForPrice(undefined)).toBeNull();
    expect(planKeyForPrice("")).toBeNull();
  });

  it("does not match a plan whose price is unset", async () => {
    // An unconfigured plan must never be granted by an undefined === undefined
    // comparison — that would hand out the agency plan for free.
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
    vi.stubEnv("STRIPE_PRICE_AGENCY", "");
    vi.resetModules();
    const { planKeyForPrice } = await import("@/lib/stripe");

    expect(planKeyForPrice(undefined)).toBeNull();
    expect(planKeyForPrice("")).toBeNull();
  });
});

describe("configuration gating", () => {
  it("reports billing as unconfigured with no secret key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.resetModules();
    const { stripeConfigured } = await import("@/lib/stripe");
    expect(stripeConfigured()).toBe(false);
  });

  it("offers no purchasable plans until prices are configured", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    vi.stubEnv("STRIPE_PRICE_PORTFOLIO", "");
    vi.stubEnv("STRIPE_PRICE_AGENCY", "");
    vi.resetModules();
    const { purchasablePlans } = await import("@/lib/stripe");
    expect(purchasablePlans()).toEqual([]);
  });

  it("never offers the free plan for purchase", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
    vi.resetModules();
    const { purchasablePlans } = await import("@/lib/stripe");
    expect(purchasablePlans().map((p) => p.key)).toEqual(["pro"]);
  });
});
