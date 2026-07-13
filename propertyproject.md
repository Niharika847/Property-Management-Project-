# Build Brief —: Property Income & Expense Manager

You are building a commercial web application for property investors to track rental income and
expenses across multiple properties, with AI woven through the experience. Read this whole brief
before writing code, then propose a plan before implementing. Ask me before making irreversible
architectural decisions.

---

## 1. What we're building

Roost is a web app where a property owner adds each of their properties (rented out, owner-occupied,
or vacant), records the rent coming in and the expenses going out, and instantly sees whether each
property — and the whole portfolio — is making or losing money per week, per month, and per year. It
should feel systematic and precise, like a financial ledger, and it should be controllable through
natural language ("log $240 plumbing at 42 Marine Parade", "what's my net this quarter").

The core question the app must answer at a glance: **for each property and overall, how much is
coming in, how much is going out, and what's the net position.**

## 2. Who it's for (primary user for v1)

A solo-to-small landlord/investor managing **1–20 properties** in Australia (default market: Victoria).
Assume they are not accountants. Optimise for clarity and speed of data entry.

Out of scope for v1 (design so it *could* be added, don't build it yet): the property-manager persona
who manages many properties on behalf of multiple separate owners, with per-owner statements and
permissions. Keep the data model owner-scoped so this is possible later.

## 3. Tech stack (decided)

This stack is chosen — build with it unless you hit a genuine blocker, in which case raise it before switching.

- **Start with plain HTML, CSS, and JavaScript (no framework).** Build the first version as static
  HTML/CSS/vanilla-JS pages — it keeps things simple, fast, and easy to reason about while the product
  takes shape. This still deploys on **Vercel** and talks to **Supabase** through the `supabase-js`
  client (loaded via CDN or a small bundle), and can call **Vercel serverless functions** for anything
  that must run server-side. Only move to a framework (e.g. Next.js/React) later, if and when the app's
  complexity actually calls for it — don't reach for it prematurely.
- **Hosting:** **Vercel**. Responsive, mobile-first — expense entry must be usable one-handed on a phone in under ~3 taps. Server-side logic runs as Vercel serverless functions.
- **Backend + database + auth + storage:** **Supabase**.
  - Postgres for all persistent data (nothing important lives only in the browser).
  - Supabase **Auth** for user accounts.
  - Supabase **Storage** buckets for receipts and documents (leases, inspection reports).
  - **Row Level Security (RLS) is mandatory** on every table — each owner can only ever read/write their own rows. This is how the app stays owner-scoped and secure; write and test the RLS policies deliberately, don't leave tables open.
  - Use Supabase **Edge Functions** (or Vercel serverless functions) for server-side work that shouldn't run in the browser (calling the Google API, calling Claude, running the parsing pipeline) so no API keys are ever exposed client-side.
- **Parsing / OCR:** a **Google API** — default to **Google Cloud Vision** (or **Document AI** if you need better structured extraction) for reading text off receipts, invoices, and statements. Confirm which one you're using and why before wiring it in. (If we later want address autocomplete, Google **Places** can be added — but the parsing use case above is the priority.)
- **AI reasoning:** **Anthropic API (Claude)** for turning raw parsed/OCR text into structured records and for the natural-language features in section 7.

**Keys and secrets:** every third-party key (Google, Anthropic, Supabase service role) lives server-side only — in Vercel env vars or Supabase Edge Function secrets. Never ship a secret to the client.

A front-end prototype already exists in plain HTML/CSS/JS (calming "ledger" aesthetic, in-memory demo
data) — use it as the visual and UX starting point, and grow the real app out from it.

## 4. Design direction — calm and unhurried

The overriding feeling is **calm**. This is financial data, which is stressful by nature; the interface's
job is to make the owner feel in control and at ease, never alarmed. Design for a slow, confident,
uncluttered experience — closer to a quiet reading app than a trading terminal.

- **Palette:** soft and muted, low-contrast but still accessible. Keep the pine/sage green as the primary (calming, tied to property and growth) over warm off-white "paper" surfaces and gentle ink-green text. Use a **muted sage** for income and a **soft clay/terracotta** for expenses — never a harsh alarm-red. Amber only as a quiet accent. Avoid pure black, pure white, saturated or neon colours, and heavy shadows.
- **Space and rhythm:** generous whitespace and breathing room; let elements sit calmly rather than packing the screen. Fewer things per view, clear hierarchy, one primary action per screen.
- **Typography:** a soft, characterful serif for the wordmark and hero figures, a clean humanist sans for UI, and a **monospace with tabular figures for all money** so columns align like a ledger. Comfortable line-height, restrained weights.
- **Motion:** gentle and minimal — soft fades and easing, nothing sudden, bouncy, or attention-grabbing. Respect `prefers-reduced-motion`.
- **Tone of numbers:** present negatives and shortfalls factually and softly (muted clay, plain wording), not with red warnings or exclamation. Alerts should feel like a helpful nudge, not an alarm.
- **Signature elements:** (a) a persistent, quietly-present **AI command bar**, and (b) a per-property **income-vs-expense strip** so the whole portfolio is scannable at a glance without effort.
- **Accessible baseline:** visible keyboard focus, works down to mobile, sufficient colour contrast, reduced motion respected.

## 5. Core data model

Owner-scoped. Suggested entities and key fields (refine as needed):

- **User / Owner** — id, name, email, auth credentials, settings (currency default AUD, financial-year start).
- **Property** — id, owner_id, address, suburb/state, type (house / unit / townhouse), status (rented / vacant / owner-occupied), purchase_price, current_value, purchase_date.
- **Loan** (0..1 per property) — id, property_id, lender, balance, interest_rate, repayment_amount, repayment_frequency, interest_only vs P&I. Used to split repayments into interest vs principal.
- **Lease / Tenancy** — id, property_id, tenant_name(s), rent_amount, rent_frequency (weekly / fortnightly / monthly), start_date, end_date, rent_review_date, bond_amount.
- **RentPayment (income)** — id, lease_id/property_id, amount, due_date, paid_date (nullable → arrears if overdue and unpaid), status.
- **Expense** — id, property_id, category (Repairs, Rates, Insurance, Cleaning, Utilities, Mgmt fees, Interest, General), amount, date, description, recurring (bool + frequency), tax_deductible (bool), receipt_document_id (nullable).
- **Document** — id, property_id, type (lease / receipt / inspection / other), file_ref, uploaded_at.

**Money math to get right:**
- Normalise all frequencies to a common period. Weekly → monthly = `amount × 52 / 12`; fortnightly → monthly = `amount × 26 / 12`.
- **Net cashflow (per property, monthly)** = rent in − operating expenses − loan repayment. Show whether it's a surplus or shortfall.
- **Gross rental yield %** = `annual rent / current_value × 100`.
- **Net rental yield %** = `(annual rent − annual expenses) / current_value × 100`.
- **Cash-on-cash return %** = `annual pre-tax cashflow / total cash invested × 100`.
- Handle vacant and owner-occupied properties correctly (no rent, but expenses still count).

## 6. Features by phase

### Phase 1 — MVP (make this genuinely usable)
- Add / edit / delete **multiple properties**, each with status and rent.
- Record **rent income** and **expenses** per property; mark expenses recurring.
- **Rent shown per week AND per month** via a global toggle; all totals recalc live.
- **Portfolio dashboard:** KPIs (total rent income, total expenses, net cashflow, property count), a cashflow chart over recent months, and a property list with per-property net.
- **Category breakdown** of expenses.
- Working auth + persistent storage so a real account's data is saved.

### Phase 2 — Make it an investment tool, not just an expense tracker
- **Loan / mortgage** tracking per property; net cashflow reflects real out-of-pocket position, with interest vs principal split.
- **Yield metrics:** gross yield, net yield, cash-on-cash, vacancy rate over time.
- **Single-property drill-down page:** its own P&L, timeline of income/expenses, documents, and metrics.
- **Date-range selector** (this month / quarter / financial year / custom) — figures must not be stuck on "this month".
- **Tenants & leases:** lease dates, rent review dates, rent-due tracking with **arrears** flagging.
- **Reminders:** lease expiry, rates due, insurance renewal.
- **Search / filter** across properties and expenses.
- **Export:** CSV and PDF (per property and portfolio).

### Phase 3 — Australian tax layer (a real differentiator)
- Per-expense **tax-deductible** flag and reporting.
- **Depreciation schedule** support.
- **Negative-gearing view:** is a property running at a paper loss for tax purposes?
- **End-of-financial-year export** structured so an accountant can actually use it at tax time.

## 7. Parsing & AI ("controlled by AI")

Parsing is a **core, first-class part of this product**, not a nice-to-have. The main way people add
data should be by pointing the app at a receipt, an invoice, a bank/statement line, or a typed
sentence — and having it come back as a clean, structured, editable record. Get this pipeline right.

**The parsing pipeline (build this carefully):**
1. **Capture** — user photographs/uploads a receipt or document (mobile camera or file), stored in a Supabase Storage bucket.
2. **OCR / text extraction** — a Supabase Edge Function calls the **Google API** (Cloud Vision or Document AI) to pull raw text/fields off the image or PDF.
3. **Structuring** — pass that raw text to **Claude** to extract a structured expense: amount, date, vendor/merchant, suggested category, and a best-guess property match. Return strict JSON.
4. **Confirm** — present the result **pre-filled and fully editable**; the user reviews and taps save. Nothing is written to the database until they confirm.

Design the pipeline to fail gracefully: if OCR is low-confidence or a field can't be read, show the
fields blank/flagged for the user to fill, never a wrong silent guess.

**Other AI features (implement progressively):**
- **Natural-language command bar** (present throughout, quietly): parse typed commands like "log $240 plumbing at Marine Parade" into a pre-filled, editable expense; answer questions like "what's my net this month" or "which properties are vacant" from the user's real data.
- **Auto-categorisation** of recurring bills, learned from past entries.
- **Proactive insights (calm, not alarming):** e.g. "St Kilda expenses are a little higher this month", "landlord insurance renews in 12 days", "Footscray has been vacant 3 weeks — about $1,440 in missed rent". Phrase these as gentle nudges.
- **Natural-language reports:** "how did Footscray do last quarter" → a plain-language summary with the numbers.

Two hard rules: (1) all parsing/AI calls run **server-side** (Edge Functions / Vercel functions) so
keys stay secret; (2) AI output is always **editable and confirmable** before it writes to the
database — never let the model silently create, change, or delete financial records.

## 8. Non-functional requirements

- **Persistence:** all data in Supabase Postgres, scoped per owner via RLS; nothing important lives only in the browser.
- **Security & privacy:** this is financial data. Enforce **Row Level Security on every table**, keep all third-party keys server-side (Vercel env vars / Edge Function secrets), rely on Supabase Auth for credential handling rather than rolling your own, protect against common web vulnerabilities, and never log secrets. Users should be able to export and delete their data.
- **Not financial/tax advice:** show clear framing that Roost is a record-keeping tool, not licensed tax or financial advice; tax features assist an accountant, they don't replace one.
- **Accessibility & responsiveness** as described in section 4.
- **Sensible empty states and error messages** written in plain language (what happened, how to fix it).

## 9. Suggested build order

1. **Foundation:** static HTML/CSS/JS front-end on Vercel + a Supabase project; schema with **RLS policies on every table**; Supabase Auth wired in via `supabase-js`. Confirm the schema before building on it.
2. Properties CRUD + expense/income entry + the dashboard with per-week/per-month toggle (Phase 1).
3. **Parsing pipeline** — receipt/document capture → Google OCR → Claude structuring → confirm-and-save. Given parsing is core, stand this up early (late Phase 1 / early Phase 2) rather than leaving it to the end.
4. Single-property drill-down, loans, and yield metrics (Phase 2 core).
5. Leases, arrears, reminders, date-range, search, export (rest of Phase 2).
6. NL command bar → proactive insights → NL reports (rest of Phase 3 AI).
7. Australian tax layer (Phase 3 tax).

Start by confirming the stack and sketching the schema and the Phase 1 screens, then build Phase 1
end-to-end before moving on. Ship each phase working before starting the next.