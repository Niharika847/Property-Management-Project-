#!/usr/bin/env node
/**
 * Security regression test for Roost's row-level security.
 *
 * Proves, against the real database, that:
 *   1. Two unrelated workspaces cannot see each other's data.
 *   2. A read-only role (accountant) can read but cannot insert/update/delete.
 *   3. Removing a member revokes access immediately.
 *   4. An owner cannot promote their own workspace to a paid plan.
 *
 * Run: npm run test:security
 * Creates throwaway accounts, cleans up after itself, and exits non-zero on
 * the first failure so it can gate a deploy.
 */

import { readFileSync } from "node:fs";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    /* fall back to process.env */
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

let failures = 0;
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

const api = (path, { token, method = "GET", body, prefer } = {}) =>
  fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

/** Creates a usable test account.
 *  Email confirmation is enabled in production, so a plain signup no longer
 *  yields a session. With a service-role key we can create pre-confirmed users;
 *  without one the suite cannot run and says so rather than passing vacuously. */
const signUp = async (email, password) => {
  if (SERVICE_KEY) {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!res.ok) throw new Error(`admin create failed for ${email}: ${await res.text()}`);
  } else {
    await api("/auth/v1/signup", { method: "POST", body: { email, password } });
  }

  const res = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const json = await res.json();
  if (!json.access_token) {
    if (!SERVICE_KEY) {
      throw new Error(
        "cannot create confirmed test users — email confirmation is enabled.\n" +
          "  Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard →\n" +
          "  Project Settings → API → service_role) so the suite can create\n" +
          "  pre-confirmed throwaway accounts. It is server-only; never expose it."
      );
    }
    throw new Error(`login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.access_token;
};

const rpc = (token, fn, args = {}) =>
  api(`/rest/v1/rpc/${fn}`, { token, method: "POST", body: args }).then((r) => r.json());

const stamp = Date.now();
const OWNER = `roost.sec.owner.${stamp}@example.com`;
const READER = `roost.sec.reader.${stamp}@example.com`;
const STRANGER = `roost.sec.stranger.${stamp}@example.com`;
const PW = "SecTest!2026x";

console.log("\nRoost security tests\n");

try {
  const ownerTok = await signUp(OWNER, PW);
  const readerTok = await signUp(READER, PW);
  const strangerTok = await signUp(STRANGER, PW);

  const ownerWs = await rpc(ownerTok, "ensure_personal_workspace");
  await rpc(strangerTok, "ensure_personal_workspace");
  check("owner gets exactly one workspace", typeof ownerWs === "string" && ownerWs.length > 0);

  // Owner creates a property.
  const created = await api("/rest/v1/properties", {
    token: ownerTok,
    method: "POST",
    prefer: "return=representation",
    body: { workspace_id: ownerWs, address: "1 Secret Lane", suburb: "Private", status: "rental" },
  }).then((r) => r.json());
  check("owner can create a property", Array.isArray(created) && created.length === 1);
  const propId = created?.[0]?.id;

  // 1. Isolation: an unrelated account must see nothing.
  const strangerView = await api("/rest/v1/properties?select=id", { token: strangerTok }).then((r) =>
    r.json()
  );
  check("stranger cannot see another workspace's properties", Array.isArray(strangerView) && strangerView.length === 0);

  // 2. Invite the reader as a read-only accountant.
  await api("/rest/v1/workspace_invites", {
    token: ownerTok,
    method: "POST",
    body: { workspace_id: ownerWs, email: READER, role: "accountant" },
  });
  const invites = await api("/rest/v1/workspace_invites?select=id&accepted_at=is.null", {
    token: readerTok,
  }).then((r) => r.json());
  check("invitee can see their own invite", Array.isArray(invites) && invites.length === 1);
  await rpc(readerTok, "accept_workspace_invite", { p_invite_id: invites[0]?.id });

  const readerView = await api("/rest/v1/properties?select=id,address", { token: readerTok }).then(
    (r) => r.json()
  );
  check("accountant can READ the portfolio", Array.isArray(readerView) && readerView.length === 1);

  const insertRes = await api("/rest/v1/properties", {
    token: readerTok,
    method: "POST",
    body: { workspace_id: ownerWs, address: "Should Not Exist", suburb: "X", status: "rental" },
  });
  check("accountant INSERT is rejected", insertRes.status === 401 || insertRes.status === 403, `http ${insertRes.status}`);

  const updated = await api(`/rest/v1/properties?id=eq.${propId}`, {
    token: readerTok,
    method: "PATCH",
    prefer: "return=representation",
    body: { address: "TAMPERED" },
  }).then((r) => r.json());
  check("accountant UPDATE affects no rows", Array.isArray(updated) && updated.length === 0);

  const deleted = await api(`/rest/v1/properties?id=eq.${propId}`, {
    token: readerTok,
    method: "DELETE",
    prefer: "return=representation",
  }).then((r) => r.json());
  check("accountant DELETE affects no rows", Array.isArray(deleted) && deleted.length === 0);

  const stillThere = await api(`/rest/v1/properties?select=address&id=eq.${propId}`, {
    token: ownerTok,
  }).then((r) => r.json());
  check("owner's data survived intact", stillThere?.[0]?.address === "1 Secret Lane");

  // 3. Removing the member revokes access.
  const members = await api(`/rest/v1/workspace_members?select=user_id,role&workspace_id=eq.${ownerWs}`, {
    token: ownerTok,
  }).then((r) => r.json());
  const readerRow = members.find((m) => m.role === "accountant");
  await api(
    `/rest/v1/workspace_members?workspace_id=eq.${ownerWs}&user_id=eq.${readerRow?.user_id}`,
    { token: ownerTok, method: "DELETE" }
  );
  const afterRemoval = await api("/rest/v1/properties?select=id", { token: readerTok }).then((r) =>
    r.json()
  );
  check("removed member loses access immediately", Array.isArray(afterRemoval) && afterRemoval.length === 0);

  // 4. Billing integrity: the plan column gates paid limits, and the workspace
  // update policy lets an owner write their own workspace row — so the trigger
  // must be what stops a self-serve upgrade.
  const beforePlan = await api(`/rest/v1/workspaces?select=plan&id=eq.${ownerWs}`, {
    token: ownerTok,
  }).then((r) => r.json());

  await api(`/rest/v1/workspaces?id=eq.${ownerWs}`, {
    token: ownerTok,
    method: "PATCH",
    body: { plan: "agency" },
    prefer: "return=representation",
  });
  const afterUpgrade = await api(`/rest/v1/workspaces?select=plan&id=eq.${ownerWs}`, {
    token: ownerTok,
  }).then((r) => r.json());
  check(
    "owner cannot upgrade their own plan",
    afterUpgrade?.[0]?.plan === (beforePlan?.[0]?.plan ?? "free"),
    `plan is now "${afterUpgrade?.[0]?.plan}"`
  );

  // The same write must still succeed for service_role, or the Stripe webhook
  // could never grant a plan anyone actually paid for.
  if (SERVICE_KEY) {
    await fetch(`${URL_BASE}/rest/v1/workspaces?id=eq.${ownerWs}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: "pro" }),
    });
    const afterWebhook = await api(`/rest/v1/workspaces?select=plan&id=eq.${ownerWs}`, {
      token: ownerTok,
    }).then((r) => r.json());
    check("service_role (the Stripe webhook) can still set a plan", afterWebhook?.[0]?.plan === "pro");
  }

  // Owners must keep control of the non-billing fields.
  await api(`/rest/v1/workspaces?id=eq.${ownerWs}`, {
    token: ownerTok,
    method: "PATCH",
    body: { name: "Renamed by owner" },
  });
  const renamed = await api(`/rest/v1/workspaces?select=name&id=eq.${ownerWs}`, {
    token: ownerTok,
  }).then((r) => r.json());
  check("owner can still rename their workspace", renamed?.[0]?.name === "Renamed by owner");

  // Cleanup: owner removes their own data and workspace.
  await api(`/rest/v1/properties?workspace_id=eq.${ownerWs}`, { token: ownerTok, method: "DELETE" });
  await api(`/rest/v1/workspaces?id=eq.${ownerWs}`, { token: ownerTok, method: "DELETE" });
} catch (e) {
  console.error("\nTest run error:", e.message);
  failures++;
}

console.log(`\n${failures === 0 ? "All security checks passed." : `${failures} check(s) FAILED.`}\n`);
process.exit(failures === 0 ? 0 : 1);
