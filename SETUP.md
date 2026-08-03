# Roost — going live checklist

Everything in this file needs an account or a key that only the account owner
can create. The app runs without any of it — each feature degrades to a clear
"not configured" state rather than breaking — but the first two items below are
what stand between a demo and something you can actually share.

---

## 1. Email delivery (REQUIRED before sharing the link)

Sign-up requires email confirmation, and Supabase's built-in mailer sends only
a few messages an hour with unreliable delivery. Share the app with ten people
today and most of them cannot get in at all.

1. Create an account at [resend.com](https://resend.com) and verify a domain
   (or use their test sender to start).
2. Create an API key.
3. In Supabase → **Project Settings → Authentication → SMTP Settings**, enable
   custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: *your Resend API key*
   - Sender email / name: whatever your users should see
4. Optionally add the same key to `.env.local` and Vercel as `RESEND_API_KEY`
   so team invite emails send too (`lib/email.ts` no-ops without it).

**Verify it worked:** register a new account with a real address and confirm
the email arrives within a minute.

---

## 2. Delete the test accounts (REQUIRED before sharing)

Two accounts exist in the production database from development:

- `roost.phase0.test@gmail.com`
- `roost.seedtest@example.com`

Remove them in Supabase → **Authentication → Users**. Deleting the user cascades
to their workspace and data.

---

## 3. Stripe billing (optional — plan limits are already enforced)

Without these variables Settings shows "billing arrives later" and nothing is
purchasable. With them, owners can subscribe and the plan syncs automatically.

1. In the [Stripe dashboard](https://dashboard.stripe.com) create a recurring
   **Product + Price** for each paid plan you want to sell (Pro, Portfolio,
   Agency). Copy each price ID (`price_...`).
2. Add to `.env.local` **and** Vercel (Production):

   ```
   STRIPE_SECRET_KEY=sk_test_...        # sk_live_... when you go live
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_PORTFOLIO=price_...
   STRIPE_PRICE_AGENCY=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...      # from step 3
   ```

3. In Stripe → **Developers → Webhooks**, add an endpoint:

   - URL: `https://property-management-project.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

4. Locally you can test with `stripe listen --forward-to
   localhost:3000/api/stripe/webhook`.

**How entitlement works.** The webhook is the *only* thing that can grant a paid
plan. A database trigger (`protect_workspace_billing`) pins the billing columns
for every caller except `service_role`, because the workspace update policy
otherwise lets an owner set their own plan straight from the browser. A
subscription only entitles a workspace while its status is `active` or
`trialing` — `past_due`, `unpaid` and `canceled` all fall back to free.

**This is the one feature that has not been verified end to end**, because
testing a real checkout needs your keys. The signature check, the entitlement
rules and the escalation block are all covered by automated tests
(`npm test`, `npm run test:security`); the live payment round-trip is not.

---

## 4. Google sign-in (optional)

The Google button stays hidden until a provider is genuinely enabled, so
nothing looks broken while this is unset.

1. In [Google Cloud Console](https://console.cloud.google.com) → **APIs &
   Services → Credentials**, create an OAuth 2.0 Client ID (Web application).
2. Authorised redirect URI:
   `https://virxkgvtskxythwikxoe.supabase.co/auth/v1/callback`
3. Paste the client ID and secret into Supabase → **Authentication → Providers
   → Google** and enable it.

The button appears on its own once `/auth/v1/settings` reports Google as
enabled.

---

## 5. Address autocomplete & property data (optional)

**Address autocomplete works right now with no key**, using OpenStreetMap's
Nominatim. Coverage of Australian unit-level addresses is thin and OSM asks for
no more than ~1 request/second, so it is fine for getting started and not for
real traffic. To upgrade:

```
GOOGLE_PLACES_API_KEY=...
```

Create it in [Google Cloud Console](https://console.cloud.google.com) with the
**Places API (New)** enabled, and restrict it to your Vercel domain. Google
gives a monthly free allowance; past that, autocomplete is billed per session.
The app picks Google automatically once the key is present.

**Bedrooms, bathrooms, land size and a value estimate are a different problem.**
Geocoders know where a building is, not what is inside it. That data is
licensed from commercial providers, and there is no free tier worth relying on:

- **Domain** ([developer.domain.com.au](https://developer.domain.com.au)) —
  easiest to start with, has an introductory package. This is the one wired up.
- **CoreLogic / PropTrack** — richer valuation data, enterprise contracts.

```
DOMAIN_API_KEY=...
```

Without it, the address still fills in suburb/state/postcode and the remaining
fields are left for you to type. The app will never guess a bedroom count or a
valuation — a made-up number in a tax and lending context is worse than a blank
field, which is also why the AI assistant is not used for this.

> The Domain adapter in `lib/property-data.ts` is written but **unverified** —
> it needs a real key to test against.

---

## 6. Error monitoring (optional)

Set `ERROR_WEBHOOK_URL` to a Slack or Discord incoming webhook (or any endpoint
that accepts a JSON POST). Errors are then pushed there as well as written to
the Vercel logs. Secret-looking fields are redacted before anything is sent.
Without the variable, behaviour is unchanged.

---

## Commands

```bash
npm run dev            # local dev server
npm test               # unit tests (ledger maths, validation, billing rules)
npm run test:security  # RLS + role + billing-escalation tests against the real DB
npm run typecheck      # tsc --noEmit
```

`npm run test:security` needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
because email confirmation is enabled — it creates pre-confirmed throwaway
accounts and deletes them afterwards.
