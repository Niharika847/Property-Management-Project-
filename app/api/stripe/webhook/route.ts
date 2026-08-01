import { log } from "@/lib/logger";
import { planForSubscriptionStatus, planKeyForPrice, stripeClient, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/** Stripe webhook. This endpoint is the ONLY thing that grants a paid plan —
 *  the database trigger blocks every other writer — so the signature check is
 *  the whole security boundary. Anything unsigned is rejected before it is
 *  parsed, and the plan is derived from Stripe's own objects rather than from
 *  anything a client could put in the request. */

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    // A bad signature is the expected shape of an attack, so it is logged as a
    // warning rather than an error — no need to page anyone for it.
    log.warn("billing.webhook_bad_signature", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handle(event);
  } catch (e) {
    log.error("billing.webhook_failed", e, { type: event.type, eventId: event.id });
    // 500 asks Stripe to retry, which is what we want for a transient DB error.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id;
      if (!workspaceId) {
        log.warn("billing.checkout_without_workspace", { sessionId: session.id });
        return;
      }
      // Record the customer/subscription now; the plan itself is set from the
      // subscription event, which carries the authoritative status.
      await supabase
        .from("workspaces")
        .update({
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id:
            typeof session.subscription === "string" ? session.subscription : null,
        })
        .eq("id", workspaceId);
      log.info("billing.checkout_completed", { workspaceId });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspace_id;

      const priceId = sub.items.data[0]?.price?.id;
      const planKey = planKeyForPrice(priceId) ?? sub.metadata?.plan ?? null;
      const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
      const plan = planForSubscriptionStatus(planKey, status);

      // Prefer the workspace id Stripe is carrying; fall back to the customer
      // mapping for subscriptions created outside checkout (e.g. in the portal).
      const query = supabase
        .from("workspaces")
        .update({ plan, plan_status: status, stripe_subscription_id: sub.id });

      const { error } = workspaceId
        ? await query.eq("id", workspaceId)
        : await query.eq("stripe_customer_id", String(sub.customer));

      if (error) throw error;
      log.info("billing.plan_synced", { workspaceId, plan, status });
      return;
    }

    default:
      // Everything else is deliberately ignored — acknowledging keeps Stripe
      // from retrying events this app has no opinion about.
      return;
  }
}
