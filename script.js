/**
 * Roost — property income & expense tracker
 * Commercial starter · plain HTML/CSS/JS · no build step · deploys as a static site.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────
 *   CONFIG    App/backend configuration (Supabase project URL + anon key).
 *   Store     Data-access layer. The ONLY place that touches persistence —
 *             every method queries Supabase directly.
 *   state     Latest in-memory snapshot the UI reads synchronously.
 *   render*   View. Paints the DOM from `state`. Never mutates data.
 *   handlers  Controller. Mutate through Store, then refresh() and repaint.
 *
 * Data flow:  user action → Store.mutate() → refresh() → Store.get() → paint()
 * ──────────────────────────────────────────────────────────────────────────
 */

"use strict";

/* ============================================================
 * CONFIG
 * The anon key is public-safe by design — Supabase enforces access
 * with the row-level security policies below, not by hiding this key.
 * Service/secret keys must never appear in client code.
 * ========================================================== */
const CONFIG = {
  supabaseUrl: "https://virxkgvtskxythwikxoe.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcnhrZ3Z0c2t4eXRod2lreG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MTc1MDksImV4cCI6MjA5OTM5MzUwOX0._21fg13EXjzGzZciuYGNId5QBVOe5i0wHoEFaAYgt1c",
  currency: "en-AU",
};

const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

/* ============================================================
 * AUTH — no login screen yet, so each browser gets a persistent
 * anonymous Supabase user. RLS policies scope every row to it.
 * ========================================================== */
async function ensureSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

/* ============================================================
 * ROW MAPPING — translate between DB columns and the UI's shape.
 * ========================================================== */
const fromPropertyRow = (r) => ({
  id: r.id,
  address: r.address,
  suburb: r.suburb,
  status: r.status,
  rent: Number(r.rent),
  period: r.period,
});
const toPropertyRow = (p) => ({
  address: p.address,
  suburb: p.suburb,
  status: p.status,
  rent: p.rent,
  period: p.period,
});
const fromExpenseRow = (r) => ({
  id: r.id,
  pid: r.property_id,
  cat: r.category,
  label: r.label,
  amount: Number(r.amount),
  date: formatDate(r.occurred_at),
  occurredAt: r.occurred_at,
  recurring: r.recurring,
});
const toExpenseRow = (e) => ({
  property_id: e.pid,
  category: e.cat,
  label: e.label,
  amount: e.amount,
  recurring: e.recurring,
});

/* ============================================================
 * DATA STORE — the only place that touches Supabase.
 * Every method is async and returns plain objects the UI expects.
 * ========================================================== */
const Store = {
  async getProperties() {
    const { data, error } = await sb.from("properties").select("*").order("created_at");
    if (error) throw error;
    return data.map(fromPropertyRow);
  },
  async addProperty(p) {
    const { data, error } = await sb.from("properties").insert(toPropertyRow(p)).select().single();
    if (error) throw error;
    return fromPropertyRow(data);
  },
  async getExpenses() {
    const { data, error } = await sb.from("expenses").select("*").order("occurred_at", { ascending: false });
    if (error) throw error;
    return data.map(fromExpenseRow);
  },
  async addExpense(e) {
    const { data, error } = await sb.from("expenses").insert(toExpenseRow(e)).select().single();
    if (error) throw error;
    return fromExpenseRow(data);
  },
  async deleteExpense(id) {
    const { error } = await sb.from("expenses").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ============================================================
 * APP STATE — latest snapshot for synchronous UI code.
 * ========================================================== */
const state = { properties: [], expenses: [], view: "month" };

// Last 6 calendar months, aggregated from real expenses. Income uses the
// current rent roll for every month since we don't keep historical rent
// snapshots — treat it as "income at today's rents", not a true history.
let CHART = [];
function buildChart() {
  const now = new Date();
  const income = state.properties.reduce((s, p) => s + propMonthly(p), 0);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const exp = state.expenses.reduce((s, e) => {
      const ed = new Date(e.occurredAt);
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth() ? s + e.amount : s;
    }, 0);
    return { m: d.toLocaleDateString(CONFIG.currency, { month: "short" }), inc: income, exp };
  });
}
const CAT_COLOR = {
  Repairs: "#C0855F", Rates: "#B0873F", Insurance: "#4C7A64",
  Cleaning: "#5F9A7E", Utilities: "#7C8A82", General: "#93A29A",
};

/* ============================================================
 * HELPERS
 * ========================================================== */
const $ = (id) => document.getElementById(id);
const AUD = (n) => "$" + Math.round(n).toLocaleString(CONFIG.currency);
const wkToMonth = (w) => (w * 52) / 12;
const sameId = (a, b) => String(a) === String(b);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const formatDate = (iso) => new Date(iso).toLocaleDateString(CONFIG.currency, { day: "numeric", month: "short" });

const propMonthly = (p) => (p.status === "rented" ? (p.period === "week" ? wkToMonth(p.rent) : p.rent) : 0);
const expByProp = (pid) => state.expenses.filter((e) => sameId(e.pid, pid)).reduce((s, e) => s + e.amount, 0);

function totals() {
  const income = state.properties.reduce((s, p) => s + propMonthly(p), 0);
  const expTotal = state.expenses.reduce((s, e) => s + e.amount, 0);
  return { income, expTotal, net: income - expTotal };
}

/* ============================================================
 * DATA LIFECYCLE — load from Store, cache in state, repaint.
 * ========================================================== */
async function refresh() {
  try {
    const [properties, expenses] = await Promise.all([Store.getProperties(), Store.getExpenses()]);
    state.properties = properties;
    state.expenses = expenses;
    CHART = buildChart();
    paint();
  } catch (err) {
    console.error("Roost: failed to load data", err);
    toast("Couldn't load your data. Please try again.", "error");
  }
}

function paint() {
  renderKpis();
  renderChart();
  renderProperties();
  renderExpenses();
  renderBreakdown();
  syncToggle();
}

/* ============================================================
 * RENDER (view)
 * ========================================================== */
function renderKpis() {
  const { income, expTotal, net } = totals();
  const rented = state.properties.filter((p) => p.status === "rented").length;
  const vacant = state.properties.filter((p) => p.status === "vacant").length;
  const per = state.view === "week" ? "/wk" : "/mo";
  const wk = (m) => AUD((m * 12) / 52);

  $("kpis").innerHTML = [
    kpi("Rent income", AUD(income), `${state.view === "week" ? wk(income) + per : "per month"} · ${rented} tenanted`, "↗", "var(--pine-soft)", "var(--income)"),
    kpi("Expenses", AUD(expTotal), `${state.expenses.length} entries this month`, "▾", "#F5E9DF", "var(--expense)"),
    kpi("Net cashflow", `<span class="${net >= 0 ? "up" : "down"}">${AUD(net)}</span>`, `${net >= 0 ? "surplus" : "shortfall"} · ${state.view === "week" ? wk(net) + per : "per month"}`, "✦", "var(--amber-soft)", "var(--amber)"),
    kpi("Portfolio", state.properties.length, `${rented} rented · ${vacant} vacant`, "⌂", "var(--pine-soft)", "var(--pine)"),
  ].join("");
}

function kpi(label, val, sub, icon, bg, color) {
  return `<div class="kpi">
    <div class="k-ico" style="background:${bg};color:${color}">${icon}</div>
    <div class="k-lbl">${label}</div>
    <div class="k-val mono">${val}</div>
    <div class="k-sub">${sub}</div>
  </div>`;
}

function renderChart() {
  const maxBar = Math.max(...CHART.map((c) => Math.max(c.inc, c.exp)));
  $("chart").innerHTML = CHART.map((c) => `
    <div class="col">
      <div class="bars">
        <div class="bar inc" style="height:${(c.inc / maxBar) * 100}%" title="Income ${AUD(c.inc)}"></div>
        <div class="bar exp" style="height:${(c.exp / maxBar) * 100}%" title="Expenses ${AUD(c.exp)}"></div>
      </div>
      <div class="m">${c.m}</div>
    </div>`).join("");
}

function renderProperties() {
  const el = $("props");
  if (!state.properties.length) {
    el.innerHTML = `<div class="empty"><span class="em-strong">No properties yet</span>Add your first property to start tracking rent and expenses.</div>`;
    return;
  }
  el.innerHTML = state.properties.map((p) => {
    const inc = propMonthly(p);
    const ex = expByProp(p.id);
    const n = inc - ex;
    const tot = inc + ex || 1;
    let rentTxt = "—";
    if (p.status === "rented") {
      const wk = p.period === "week" ? p.rent : (p.rent * 12) / 52;
      rentTxt = state.view === "week" ? AUD(wk) + "/wk" : AUD(wkToMonth(wk)) + "/mo";
    }
    const label = p.status === "owner" ? "Owner-occ." : p.status.charAt(0).toUpperCase() + p.status.slice(1);
    return `<div class="prow">
      <div>
        <div class="prop-name">${esc(p.address)}</div>
        <div class="prop-sub">${esc(p.suburb)}</div>
        <div class="strip"><div class="si" style="width:${(inc / tot) * 100}%"></div><div class="se" style="width:${(ex / tot) * 100}%"></div></div>
      </div>
      <div><span class="pill ${p.status}">${label}</span></div>
      <div class="mono">${rentTxt}</div>
      <div class="mono hide-sm" style="color:var(--expense)">${ex ? "-" + AUD(ex) : "—"}</div>
      <div class="mono ${n >= 0 ? "netpos" : "netneg"}">${AUD(n)}</div>
    </div>`;
  }).join("");
}

function renderExpenses() {
  const el = $("exps");
  if (!state.expenses.length) {
    el.innerHTML = `<div class="empty"><span class="em-strong">No expenses logged</span>Use “+ Add” or the command bar to record your first expense.</div>`;
    return;
  }
  el.innerHTML = state.expenses.map((e) => {
    const p = state.properties.find((x) => sameId(x.id, e.pid));
    return `<div class="exp">
      <div class="cat">${esc(e.cat.slice(0, 2).toUpperCase())}</div>
      <div class="meta">
        <div class="t">${esc(e.label)}</div>
        <div class="s">${p ? esc(p.address) : "—"} · ${esc(e.date)}${e.recurring ? " · recurring" : ""}</div>
      </div>
      <div class="mono amt">-${AUD(e.amount)}</div>
      <button class="del" data-id="${esc(e.id)}" aria-label="Delete expense">✕</button>
    </div>`;
  }).join("");
  el.querySelectorAll(".del").forEach((b) => (b.onclick = () => deleteExpense(b.dataset.id)));
}

function renderBreakdown() {
  const { expTotal } = totals();
  const cats = {};
  state.expenses.forEach((e) => (cats[e.cat] = (cats[e.cat] || 0) + e.amount));
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  $("brk").innerHTML = sorted.length
    ? sorted.map(([c, a]) => `
        <div class="row">
          <div class="top"><span style="font-weight:600">${esc(c)}</span><span class="mono">${AUD(a)}</span></div>
          <div class="track"><div class="fill" style="width:${(a / expTotal) * 100}%;background:${CAT_COLOR[c] || "#93A29A"}"></div></div>
        </div>`).join("")
    : `<div class="empty">Nothing spent yet this month.</div>`;
  $("totalOut").textContent = "-" + AUD(expTotal);
}

function syncToggle() {
  $("segWeek").classList.toggle("on", state.view === "week");
  $("segMonth").classList.toggle("on", state.view === "month");
}

/* ============================================================
 * CONTROLLER (handlers) — mutate via Store, then refresh.
 * ========================================================== */
async function saveProperty(p) {
  try {
    await Store.addProperty(p);
    await refresh();
    toast("Property added", "ok");
  } catch (err) {
    console.error(err);
    toast("Couldn't save the property.", "error");
  }
}

async function saveExpense(e) {
  try {
    await Store.addExpense(e);
    await refresh();
    toast("Expense logged", "ok");
  } catch (err) {
    console.error(err);
    toast("Couldn't save the expense.", "error");
  }
}

async function deleteExpense(id) {
  try {
    await Store.deleteExpense(id);
    await refresh();
    toast("Expense removed", "ok");
  } catch (err) {
    console.error(err);
    toast("Couldn't remove the expense.", "error");
  }
}

function setView(v) {
  state.view = v;
  paint(); // no data change — repaint only
}

/* ============================================================
 * MODALS
 * ========================================================== */
const scrim = $("scrim");
const modalRoot = $("modalRoot");

function closeModal() {
  scrim.classList.remove("show");
  modalRoot.innerHTML = "";
}
scrim.onclick = (e) => { if (e.target === scrim) closeModal(); };

function openProperty() {
  modalRoot.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Add property">
    <div class="mh"><h2 class="disp">Add property</h2><button class="close" id="mClose" aria-label="Close">✕</button></div>
    <label for="pAddr">Street address</label><input class="fi" id="pAddr" placeholder="42 Marine Parade">
    <label for="pSub">Suburb / state</label><input class="fi" id="pSub" placeholder="St Kilda VIC">
    <div class="r2">
      <div><label for="pStatus">Status</label><select class="fi" id="pStatus">
        <option value="rented">Rented</option><option value="vacant">Vacant</option><option value="owner">Owner-occupied</option>
      </select></div>
      <div><label for="pPeriod">Rent period</label><select class="fi" id="pPeriod">
        <option value="week">Per week</option><option value="month">Per month</option>
      </select></div>
    </div>
    <label for="pRent">Rent amount (AUD)</label><input class="fi mono" id="pRent" type="number" min="0" placeholder="650">
    <button class="save" id="pSave">Save property</button>
  </div>`;
  scrim.classList.add("show");
  $("mClose").onclick = closeModal;
  $("pStatus").onchange = (e) => { $("pRent").disabled = e.target.value === "owner"; };
  $("pAddr").focus();
  $("pSave").onclick = () => {
    const address = $("pAddr").value.trim();
    if (!address) { $("pAddr").focus(); return; }
    saveProperty({
      address,
      suburb: $("pSub").value.trim() || "—",
      status: $("pStatus").value,
      period: $("pPeriod").value,
      rent: Math.max(0, Number($("pRent").value) || 0),
    });
    closeModal();
  };
}

function openExpense(prefill = {}) {
  const opts = state.properties
    .map((p) => `<option value="${esc(p.id)}" ${sameId(prefill.pid, p.id) ? "selected" : ""}>${esc(p.address)}</option>`)
    .join("");
  const catOpts = ["Repairs", "Rates", "Insurance", "Cleaning", "Utilities", "General"]
    .map((c) => `<option ${prefill.cat === c ? "selected" : ""}>${c}</option>`)
    .join("");
  modalRoot.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Log expense">
    <div class="mh"><h2 class="disp">Log expense</h2><button class="close" id="mClose" aria-label="Close">✕</button></div>
    ${prefill.fromAI ? `<div class="hint">✦ Pre-filled by Roost from your command. Adjust anything before saving.</div>` : ""}
    <label for="eProp">Property</label><select class="fi" id="eProp">${opts}</select>
    <div class="r2">
      <div><label for="eCat">Category</label><select class="fi" id="eCat">${catOpts}</select></div>
      <div><label for="eAmt">Amount (AUD)</label><input class="fi mono" id="eAmt" type="number" min="0" placeholder="240" value="${prefill.amount || ""}"></div>
    </div>
    <label for="eLabel">Description</label><input class="fi" id="eLabel" placeholder="Plumbing — leaking tap" value="${prefill.label ? esc(prefill.label) : ""}">
    <label style="display:flex;align-items:center;gap:8px;margin-top:18px;cursor:pointer;font-weight:500">
      <input type="checkbox" id="eRec"> Recurring every month
    </label>
    <button class="save" id="eSave">Save expense</button>
  </div>`;
  scrim.classList.add("show");
  $("mClose").onclick = closeModal;
  (prefill.amount ? $("eLabel") : $("eAmt")).focus();
  $("eSave").onclick = () => {
    const amount = Number($("eAmt").value);
    if (!amount || amount <= 0) { $("eAmt").focus(); return; }
    const cat = $("eCat").value;
    saveExpense({
      pid: $("eProp").value,
      cat,
      label: $("eLabel").value.trim() || cat,
      amount,
      recurring: $("eRec").checked,
    });
    closeModal();
  };
}

/* ============================================================
 * AI COMMAND BAR — offline keyword fallback.
 * In production, send the raw text to Claude server-side and use
 * this only when that call is unavailable.
 * ========================================================== */
function runAI() {
  const q = $("aiInput").value.trim();
  if (!q) return;
  const ql = q.toLowerCase();
  const ans = $("aiAns");
  const { income, expTotal, net } = totals();
  const amt = ql.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/);
  const hit = state.properties.find(
    (p) => ql.includes(p.suburb.split(" ")[0].toLowerCase()) ||
           ql.includes(p.address.toLowerCase().split(" ").slice(1).join(" "))
  );
  const isExp = /(expense|spent|paid|cost|repair|fix|plumb|clean|rates|insur|bill|utilit)/.test(ql);

  if (isExp && amt) {
    let cat = "General";
    if (/plumb|fix|repair|broke/.test(ql)) cat = "Repairs";
    else if (/clean/.test(ql)) cat = "Cleaning";
    else if (/rates|council/.test(ql)) cat = "Rates";
    else if (/insur/.test(ql)) cat = "Insurance";
    else if (/water|gas|electric|utilit|bill/.test(ql)) cat = "Utilities";
    const val = Number(amt[1].replace(/,/g, ""));
    openExpense({ pid: hit ? hit.id : state.properties[0]?.id, amount: val, cat, label: q, fromAI: true });
    say(ans, `Drafted a ${cat.toLowerCase()} expense of ${AUD(val)}${hit ? " for " + hit.address : ""}. Review and save.`);
  } else if (/net|profit|cashflow|earn|making|how much/.test(ql)) {
    say(ans, `Portfolio net this month is ${AUD(net)} — ${AUD(income)} rent in, ${AUD(expTotal)} expenses out across ${state.properties.length} properties.`);
  } else if (/vacant|empty|not rented/.test(ql)) {
    const v = state.properties.filter((p) => p.status === "vacant");
    say(ans, v.length
      ? `${v.length} vacant: ${v.map((p) => p.address).join(", ")}. About ${AUD(v.reduce((s, p) => s + wkToMonth(p.rent), 0))}/mo in missed rent.`
      : "Every rentable property is currently tenanted.");
  } else {
    say(ans, `Try: “log $240 plumbing at Marine Parade”, “what’s my net this month”, or “which properties are vacant”.`);
  }
  $("aiInput").value = "";
}

function say(el, text) {
  el.innerHTML = `<span style="color:var(--amber)">✦</span> ${esc(text)}`;
  el.classList.add("show");
}

/* ============================================================
 * TOASTS
 * ========================================================== */
function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  $("toasts").appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => {
    t.classList.remove("in");
    setTimeout(() => t.remove(), 260);
  }, 2600);
}

/* ============================================================
 * INIT — wire events, then load data.
 * ========================================================== */
async function init() {
  $("aiGo").onclick = runAI;
  $("aiInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runAI(); });
  $("addProp").onclick = openProperty;
  $("addExp").onclick = () => openExpense();
  $("segWeek").onclick = () => setView("week");
  $("segMonth").onclick = () => setView("month");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  try {
    await ensureSession();
  } catch (err) {
    console.error("Roost: auth failed", err);
    toast("Couldn't connect to your account. Please refresh.", "error");
    return;
  }
  refresh();
}

document.addEventListener("DOMContentLoaded", init);