# Roost — handoff

Everything another agent or developer needs to continue this project without
re-deriving it. Written to be read top to bottom once, then used as reference.

**Read `SETUP.md` too** — it covers the accounts and API keys the owner must
create, which several features are gated on.

---

## What this is

Roost is a property and expense management SaaS for Australian landlords.
Track properties, leases and rent schedules; log expenses with GST; upload
receipts that an AI extracts; see cash flow, tax reports and a calendar; invite
a team with role-based access; and (once keys exist) subscribe to a paid plan.

- **Live:** https://property-management-project.vercel.app
- **Repo:** https://github.com/Niharika847/Property-Management-Project-
- **Supabase project ref:** `virxkgvtskxythwikxoe`

Australia-first is a product decision, not an accident: AUD, financial year
1 July – 30 June, GST as 1/11th of a GST-inclusive total.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline` + CSS custom properties) |
| Database / auth / storage | Supabase (Postgres, `@supabase/ssr` cookie sessions, RLS) |
| AI | Google Gemini REST (`gemini-2.5-flash`), no SDK |
| Payments | Stripe (env-gated) |
| Tests | Vitest |
| Hosting | Vercel (deployed via CLI, **not** git-triggered) |

Only seven runtime dependencies: `@supabase/ssr`, `@supabase/supabase-js`,
`lucide-react`, `next`, `react`, `react-dom`, `stripe`. Keep it that way unless
there is a strong reason — several integrations (Gemini, Nominatim, Domain,
Resend) are deliberately plain `fetch` rather than an SDK.

---

## Commands

```bash
npm run dev            # local dev server on :3000
npm test               # 139 unit tests, offline
npm run test:live      # hits the real address provider (network)
npm run test:security  # RLS/role/billing tests against the REAL database
npm run typecheck      # tsc --noEmit
npm run build          # production build
```

Deploy: `npx vercel --prod --yes`. Migrations: `npx supabase db push`.
Both CLIs are already authenticated on the owner's machine.

---

## Layout

```
app/
  (app)/         authenticated pages; layout.tsx is the fixed app shell
  (auth)/        login, register, forgot/reset password
  (legal)/       privacy, terms — public
  api/           address lookup, stripe webhook, client error reporting
lib/
  supabase/      server.ts (SSR), client.ts (browser), admin.ts (service role)
  address/       provider-agnostic address search + AU parsing
  ai/tools.ts    whitelisted, workspace-scoped ledger reads for the assistant
components/
  ui/            primitives (Button, Input, Sheet, Select…)
  shell/         sidebar, mobile nav, workspace switcher
  <feature>/     one folder per feature area
supabase/migrations/   12 migrations, applied in filename order
tests/                 Vitest; *.live.test.ts excluded from the default run
scripts/security-test.mjs
```

Pages are server components that fetch and pass data down; the interactive
piece is a `<Feature>View` client component. Mutations are server actions in
`app/(app)/<feature>/actions.ts` returning `ActionResult`
(`{ ok: true } | { ok: false, error }`) — see `lib/action-helpers.ts`.

---

## Invariants — do not break these

These are load-bearing. Each one exists because something broke.

1. **Security lives in the database, not the app.** RLS policies decide who
   sees and writes what. `SELECT` for any workspace member; `INSERT`/`UPDATE`/
   `DELETE` for `owner`/`manager` only. Accountants and viewers are read-only
   *at the database*, not merely hidden in the UI. Never "fix" an authorisation
   bug by adding a client-side check.

2. **Only the Stripe webhook may grant a paid plan.** RLS is per-row, not
   per-column, and the workspace update policy lets owners write their own row —
   so a trigger (`protect_workspace_billing`) pins `plan`, `plan_status` and the
   Stripe ids for every caller except `service_role`. Without it an owner can
   grant themselves any tier from the browser. `npm run test:security` proves
   it still holds.

3. **`lib/workspace.ts` imports `next/headers` and must never reach the client
   bundle.** Client components import from `lib/roles.ts` instead. Breaking this
   produces a confusing build error far from the cause.

4. **Never invent numbers.** The assistant answers only from a ledger snapshot;
   receipt extraction reports what it read; property lookups leave unknown
   fields blank. This is a tax and lending context — a plausible fabricated
   valuation is worse than an empty field. Do not "helpfully" have an LLM guess
   bedroom counts, land sizes or valuations.

5. **Optional integrations degrade, never throw.** Gemini, Stripe, Resend,
   Domain and Google Places are each gated on an env var, with a
   `xConfigured()` helper and a clear "not set up" state in the UI. Follow the
   pattern for anything new.

6. **Fit-to-viewport styling is gated behind `lg:`.** The app shell pins to
   `h-dvh` and panels scroll internally only at ≥1024px. Below that, panels
   stack and splitting viewport height between them squashes everything to
   nothing. If you add a panel, match the existing
   `lg:min-h-0 lg:flex-1 lg:overflow-y-auto` pattern.

7. **Never run `npm run build` while the dev server is running.** It clobbers
   the running server's `.next`, which 404s `main-app.js`, which kills
   hydration, which makes every form silently fall back to a native GET. It
   looks exactly like "login is broken". Stop the server, build, `rm -rf .next`.

---

## Data model

`workspaces` is the tenancy boundary; every table carries `workspace_id` and
its RLS policies check membership in `workspace_members`.

- `workspaces` — name, currency, `plan`, `plan_status`, Stripe ids
- `workspace_members` — user ↔ workspace with `role`
- `workspace_invites` — pending invites, accepted via `accept_workspace_invite`
- `profiles` — mirror of `auth.users`, kept current by a trigger
- `properties` — address, suburb/state/postcode, beds/baths/parking,
  `land_size`, purchase price/date, `current_value`
- `leases`, `tenants`, `rent_charges` — rent schedule; charges generated by
  `generate_rent_charges`
- `income`, `expenses`, `categories` — the ledger
- `documents` — receipts in the private `receipts` storage bucket
- `recurring_rules` — caught up by `run_recurring_rules`
- `mortgages` — repayments feed the cash-flow figures

Key RPCs: `ensure_personal_workspace` (advisory-locked, prevents the duplicate
workspace race that bit us), `generate_rent_charges`, `run_recurring_rules`,
`accept_workspace_invite`.

---

## Current state

**Working and verified:** auth with email confirmation and validation;
workspaces, teams, roles and invites (incl. invite links); properties, leases,
rent schedules; expense ledger with GST, recurring rules and pagination;
receipt upload with Gemini extraction; grounded AI assistant; dashboard,
analytics, calendar, notifications, reports (CSV + print); settings; mobile
nav; address autocomplete.

**Built but NOT verified end to end:**

- **Stripe checkout round-trip** — needs the owner's keys. The signature check,
  entitlement rules and escalation block are all tested; a real payment is not.
- **Domain property lookup** (`lib/property-data.ts`) — adapter written against
  the documented API, never run against a real key.
- **Error webhook in production** — verified locally against a fake listener.

**Known gaps / next candidates:** maintenance log; mobile app; the security
test leaves throwaway `roost.sec.stranger.*` workspaces behind (cleanup gap in
the script, not the app); several stale empty workspaces in production from
typo signups; two dev accounts still live in the production database.

---

## Environment

`.env.local` (git-ignored) and Vercel Production:

| Variable | Required? | Effect when missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | app cannot start |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | app cannot start |
| `SUPABASE_SERVICE_ROLE_KEY` | local only | `test:security` fails loudly; **must not** go on Vercel — no app code reads it |
| `Google_gemini_API_KEY` | no | assistant + receipt extraction switch off cleanly |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET` | no | billing UI shows "arrives later"; webhook returns 503 |
| `GOOGLE_PLACES_API_KEY` | no | address search falls back to OpenStreetMap |
| `DOMAIN_API_KEY` | no | property attribute lookup returns null |
| `RESEND_API_KEY` | no | invite emails no-op |
| `ERROR_WEBHOOK_URL` | no | errors only go to Vercel logs |

Vercel also carries two unused legacy vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
from an older prototype. Harmless; nothing reads them.

---

## Working notes

- **Deploys are CLI-driven**, so GitHub can lag production. Push before
  deploying or the repo stops being an accurate backup.
- **`app/api/stripe/webhook` and `app/api/client-error` are in the middleware's
  `PUBLIC_PATHS`** by necessity — they have no session by definition. Each
  authenticates itself (signature; accepting nothing it echoes). Do not "secure"
  them by removing them from that list.
- **Address autocomplete stays a plain text input underneath.** Address data has
  incomplete coverage; a form that refuses an unlisted address is worse than no
  autocomplete.
- **Only overwrite a form field a provider actually returned.** An `undefined`
  bedroom count must not wipe a number the user typed.
- **The owner is not a developer.** Explain in plain terms, avoid unexplained
  jargon, and never leave the browser preview pointed at `localhost` — it reads
  as "the app isn't deployed".
