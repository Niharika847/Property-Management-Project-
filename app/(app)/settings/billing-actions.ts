"use server";

import { actionContext } from "@/lib/action-helpers";
import { log } from "@/lib/logger";
import { PRICE_IDS, stripeClient, stripeConfigured } from "@/lib/stripe";
import { headers } from "next/headers";

type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const fail = (error: string): CheckoutResult => ({ ok: false, error });

async function origin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

/** Starts a Stripe Checkout session for the active workspace and returns the
 *  URL to send the browser to. Only owners may buy: a manager changing the
 *  workspace's billing would be a surprise for whoever owns the card. */
export async function startCheckout(planKey: string): Promise<CheckoutResult> {
  if (!stripeConfigured()) return fail("Billing isn't set up on this deployment yet.");

  const ctx = await actionContext();
  if (!ctx) return fail("You need to be signed in.");
  if (!ctx.workspace.isOwner) return fail("Only the workspace owner can change the plan.");

  const price = PRICE_IDS[planKey];
  if (!price) return fail("That plan isn't available for purchase.");

  try {
    const stripe = stripeClient();
    const base = await origin();

    const { data: ws } = await ctx.supabase
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", ctx.workspace.id)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Reusing the saved customer keeps one Stripe customer per workspace, so
      // the webhook's customer -> workspace lookup stays unambiguous.
      ...(ws?.stripe_customer_id
        ? { customer: ws.stripe_customer_id as string }
        : { customer_email: ctx.user.email ?? undefined }),
      // The webhook is the only thing that grants a plan, and it trusts this
      // metadata rather than anything the browser sends back.
      metadata: { workspace_id: ctx.workspace.id, plan: planKey },
      subscription_data: { metadata: { workspace_id: ctx.workspace.id, plan: planKey } },
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancelled`,
allow_promotion_codes: true,
    });

    if (!session.url) return fail("Stripe did not return a checkout URL.");
    return { ok: true, url: session.url };
  } catch (e) {
    log.error("billing.checkout_failed", e, { workspaceId: ctx.workspace.id, plan: planKey });
    return fail("Couldn't start checkout. Please try again.");
  }
}

/** Opens Stripe's own billing portal so the owner can change card, download
 *  invoices or cancel — none of which we need to reimplement. */
export async function openBillingPortal(): Promise<CheckoutResult> {
  if (!stripeConfigured()) return fail("Billing isn't set up on this deployment yet.");

  const ctx = await actionContext();
  if (!ctx) return fail("You need to be signed in.");
  if (!ctx.workspace.isOwner) return fail("Only the workspace owner can manage billing.");

  const { data: ws } = await ctx.supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", ctx.workspace.id)
    .maybeSingle();

  const customer = ws?.stripe_customer_id as string | null | undefined;
  if (!customer) return fail("This workspace has no billing history yet.");

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer,
      return_url: `${await origin()}/settings`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    log.error("billing.portal_failed", e, { workspaceId: ctx.workspace.id });
    return fail("Couldn't open the billing portal. Please try again.");
  }
}
