"use server";

import { actionContext } from "@/lib/action-helpers";
import { aiConfigured, friendlyAiError, geminiChat } from "@/lib/gemini";
import { runAssistantTool } from "@/lib/ai/tools";
import { log } from "@/lib/logger";

const SYSTEM = `You are Roost, a financial assistant for an Australian property investor.

You are given the user's CURRENT PORTFOLIO DATA as JSON (all figures are authoritative and in AUD). Rules:
- Answer ONLY from that data. Never invent, estimate, or recall figures — every number you state must come from the provided data.
- Format money with a dollar sign and thousands separators (e.g. $7,940). The financial year runs 1 July–30 June.
- Be concise and direct. Lead with the answer, then a short supporting detail if useful. No preamble.
- If the data doesn't contain what's needed, say so plainly and suggest what to add (e.g. "add current values to your properties").
- For tax questions you may explain general treatment but add: "confirm with your accountant." You are not a licensed adviser.
- If asked to make a change (add an expense, mark rent paid), explain that you answer questions here and point them to the relevant page.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AskResult =
  | { ok: true; answer: string; sources: string[] }
  | { ok: false; error: string };

export async function askAssistant(history: ChatTurn[]): Promise<AskResult> {
  if (!aiConfigured()) {
    return {
      ok: false,
      error:
        "The assistant needs a Gemini API key. Add Google_gemini_API_KEY to .env.local and restart the dev server, then ask again.",
    };
  }
  const ctx = await actionContext();
  if (!ctx) return { ok: false, error: "You're signed out — log in again." };

  const wid = ctx.workspace.id;
  const run = (name: string, input: Record<string, unknown> = {}) =>
    runAssistantTool(name, input, ctx.supabase, wid);

  try {
    // Grounding: assemble a compact, authoritative snapshot of the ledger.
    const [overview, properties, expThisFy, expThisMonth, expLastFy, income, rent] =
      await Promise.all([
        run("get_overview"),
        run("list_properties"),
        run("sum_expenses", { period: "this_fy" }),
        run("sum_expenses", { period: "this_month" }),
        run("sum_expenses", { period: "last_fy" }),
        run("sum_income", { period: "this_fy" }),
        run("rent_status"),
      ]);

    const snapshot = {
      overview,
      properties,
      expenses: { this_financial_year: expThisFy, this_month: expThisMonth, last_financial_year: expLastFy },
      income_this_financial_year: income,
      rent_status: rent,
    };

    const system = `${SYSTEM}\n\nCURRENT PORTFOLIO DATA:\n${JSON.stringify(snapshot)}`;
    const contents = history.map((t) => ({
      role: (t.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: t.content }],
    }));

    const answer = (await geminiChat({ system, contents })).trim();
    return {
      ok: true,
      answer: answer || "I couldn't find an answer to that.",
      sources: ["Portfolio overview", "All properties", "Expenses", "Income", "Rent status"],
    };
  } catch (e) {
    log.error("assistant.failed", e, { workspace: wid });
    return { ok: false, error: friendlyAiError(e) };
  }
}
