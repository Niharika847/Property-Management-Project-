import Stripe from "stripe";
import { PLANS } from "@/lib/plans";

/** Billing is optional. Without STRIPE_SECRET_KEY every entry point degrades to
 *  "billing isn't set up" rather than throwing, matching how the app treats a
 *  missing AI key or email provider. */

const SECRET = process.env.STRIPE_SECRET_KEY;

export const stripeConfigured = () => Boolean(SECRET);

let client: Stripe | null = null;
export function stripeClient(): Stripe {
  if (!SECRET) throw new Error("STRIPE_SECRET_KEY is not set");
  // Pin nothing: the installed SDK version already targets its own API
  // version, and hardcoding a stale string breaks on every SDK upgrade.
  client ??= new Stripe(SECRET);
  return client;
}

/** Stripe price IDs, one per paid plan. A plan with no price configured simply
 *  is not offered for purchase. */
export const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  portfolio: process.env.STRIPE_PRICE_PORTFOLIO,
  agency: process.env.STRIPE_PRICE_AGENCY,
};

/** Plans that can actually be bought right now. */
export function purchasablePlans() {
  return Object.values(PLANS).filter((p) => p.key !== "free" && PRICE_IDS[p.key]);
}

/** Reverse lookup used by the webhook: which plan does this price belong to? */
export function planKeyForPrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  for (const [key, id] of Object.entries(PRICE_IDS)) {
    if (id && id === priceId) return key;
  }
  return null;
}

/** A subscription only entitles a workspace while it is genuinely live —
 *  past_due, unpaid and canceled all fall back to the free plan. */
export function planForSubscriptionStatus(
  planKey: string | null,
  status: string | null | undefined
): string {
  if (!planKey) return "free";
  return status === "active" || status === "trialing" ? planKey : "free";
}
