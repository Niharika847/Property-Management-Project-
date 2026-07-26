import Anthropic from "@anthropic-ai/sdk";

/** Design spec §9: high-volume extraction runs on Haiku, chat/summaries on a
 *  larger model. Kept as a constant so the routing decision lives in one place. */
const EXTRACTION_MODEL = "claude-haiku-4-5";

const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const isVisionType = (mime: string | null) => !!mime && VISION_TYPES.has(mime);

/** Turns raw SDK/API errors into something a user can act on. */
export function friendlyAiError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (status === 401)
    return "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local — it may have a duplicated 'sk-ant-' prefix — then restart the dev server.";
  if (status === 429) return "The AI is rate-limited right now — wait a moment and try again.";
  if (status === 529) return "The AI is temporarily overloaded — try again shortly.";
  return e instanceof Error ? e.message : "The AI hit an error.";
}

export interface ReceiptExtraction {
  vendor: string | null;
  date: string | null; // ISO yyyy-mm-dd
  amount: number | null; // total, GST-inclusive
  gst_amount: number | null;
  category: string | null; // one of the provided category names
  description: string | null;
  confidence: number | null; // 0..1
}

const SYSTEM = `You read Australian receipts and tax invoices and return structured data.
Rules:
- Amounts are in AUD. "amount" is the GST-inclusive total actually paid.
- "gst_amount" is the GST component if the receipt states one; otherwise null (do not guess).
- "date" is the purchase date as ISO yyyy-mm-dd.
- "category" MUST be exactly one of the category names provided by the user, or null if none fit.
- "description" is a short human label for the purchase (e.g. "Hot water valve replacement").
- "confidence" is your overall confidence from 0 to 1.
Return ONLY a JSON object with keys: vendor, date, amount, gst_amount, category, description, confidence. No prose, no code fences.`;

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Extracts receipt fields from an image. Throws if the API key is missing or
 *  the call fails — callers should catch and fall back to manual entry. */
export async function extractReceipt(opts: {
  base64: string;
  mediaType: string;
  categories: string[];
}): Promise<ReceiptExtraction> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: opts.base64,
            },
          },
          {
            type: "text",
            text: `Available categories: ${opts.categories.join(", ")}.\nExtract the receipt now.`,
          },
        ],
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text");
  const raw = text && "text" in text ? text.text : "";
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Could not read the receipt — try again or enter it manually.");
  }

  return {
    vendor: (parsed.vendor as string) || null,
    date: (parsed.date as string) || null,
    amount: coerceNumber(parsed.amount),
    gst_amount: coerceNumber(parsed.gst_amount),
    category: (parsed.category as string) || null,
    description: (parsed.description as string) || null,
    confidence: coerceNumber(parsed.confidence),
  };
}
