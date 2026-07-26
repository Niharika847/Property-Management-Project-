"use server";

import Anthropic from "@anthropic-ai/sdk";
import { actionContext } from "@/lib/action-helpers";
import { aiConfigured, friendlyAiError } from "@/lib/anthropic";
import { ASSISTANT_TOOLS, TOOL_LABELS, runAssistantTool } from "@/lib/ai/tools";

/** Design spec §9: chat/summaries run on a larger model than extraction. */
const ASSISTANT_MODEL = "claude-sonnet-5";
const MAX_STEPS = 6;

const SYSTEM = `You are Roost, a financial assistant for an Australian property investor.

Rules you must follow:
- Answer ONLY from the results of the tools provided. Never invent, estimate, or recall figures — every number you state must come from a tool call in this conversation.
- Money is in AUD. Format amounts with a dollar sign and thousands separators (e.g. $7,940). The financial year runs 1 July–30 June.
- Be concise and direct. Lead with the answer, then a short supporting detail if useful. No preamble.
- If the tools don't contain what's needed to answer, say so plainly and suggest what the user could add (e.g. "add current values to your properties").
- For tax questions, you may explain general treatment but add: "confirm with your accountant." You are not a licensed adviser.
- If asked to make a change (add an expense, mark rent paid), explain that you can answer questions here, and point them to the relevant page to make the change.`;

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
        "The assistant needs an ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server, then ask again.",
    };
  }
  const ctx = await actionContext();
  if (!ctx) return { ok: false, error: "You're signed out — log in again." };

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const sources = new Set<string>();

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tools: ASSISTANT_TOOLS as unknown as Anthropic.Tool[],
        messages,
      });

      if (res.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of res.content) {
          if (block.type === "tool_use") {
            sources.add(TOOL_LABELS[block.name] ?? block.name);
            const output = await runAssistantTool(
              block.name,
              (block.input ?? {}) as Record<string, unknown>,
              ctx.supabase,
              ctx.workspace.id
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(output),
            });
          }
        }
        // Echo the assistant turn (incl. any thinking blocks) then the results.
        messages.push({ role: "assistant", content: res.content });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const answer = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return { ok: true, answer: answer || "I couldn't find an answer to that.", sources: [...sources] };
    }
    return {
      ok: true,
      answer: "That question needed too many steps — try narrowing it down.",
      sources: [...sources],
    };
  } catch (e) {
    return { ok: false, error: friendlyAiError(e) };
  }
}
