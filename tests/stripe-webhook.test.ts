import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The webhook is the only thing in the system that can grant a paid plan (the
 *  database trigger blocks everyone else), so its signature check is the entire
 *  security boundary. These tests exercise the real route handler. */

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

/** Builds the header Stripe sends: HMAC-SHA256 of "timestamp.payload". */
function signPayload(payload: string, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

const post = async (body: string, headers: Record<string, string> = {}) => {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(new Request("https://roost.test/api/stripe/webhook", { method: "POST", body, headers }));
};

const subscriptionEvent = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "evt_test",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_test",
        customer: "cus_test",
        status: "active",
        metadata: { workspace_id: "ws-test", plan: "agency" },
        items: { data: [{ price: { id: "price_agency" } }] },
        ...over,
      },
    },
  });

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("webhook when billing is not configured", () => {
  it("refuses rather than half-processing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await post(subscriptionEvent(), { "stripe-signature": signPayload(subscriptionEvent()) });
    expect(res.status).toBe(503);
  });

  it("refuses when the key exists but the webhook secret does not", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await post(subscriptionEvent());
    expect(res.status).toBe(503);
  });
});

describe("webhook signature enforcement", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  });

  it("rejects a request with no signature at all", async () => {
    const res = await post(subscriptionEvent());
    expect(res.status).toBe(400);
  });

  it("rejects a forged signature", async () => {
    // This is the attack: a real-looking upgrade event, signed with a secret
    // the attacker guessed. It must never reach the database.
    const body = subscriptionEvent();
    const res = await post(body, { "stripe-signature": "t=1,v1=deadbeef" });
    expect(res.status).toBe(400);
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const body = subscriptionEvent();
    const res = await post(body, { "stripe-signature": signPayload(body, "whsec_attacker_secret") });
    expect(res.status).toBe(400);
  });

  it("rejects a body that was tampered with after signing", async () => {
    const original = subscriptionEvent({ metadata: { workspace_id: "ws-test", plan: "pro" } });
    const signature = signPayload(original);
    const tampered = subscriptionEvent({ metadata: { workspace_id: "ws-test", plan: "agency" } });
    const res = await post(tampered, { "stripe-signature": signature });
    expect(res.status).toBe(400);
  });

  it("rejects a replayed signature from outside the tolerance window", async () => {
    const body = subscriptionEvent();
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const res = await post(body, { "stripe-signature": signPayload(body, WEBHOOK_SECRET, anHourAgo) });
    expect(res.status).toBe(400);
  });

  it("accepts a correctly signed payload", async () => {
    // Supabase is not reachable from a unit test, so the handler is expected to
    // fail at the database step — the point is that it got PAST the signature
    // check, which a 400 would mean it had not.
    const body = subscriptionEvent();
    const res = await post(body, { "stripe-signature": signPayload(body) });
    expect(res.status).not.toBe(400);
  });
});
