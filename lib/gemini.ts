/** Google Gemini integration (Generative Language API, REST — no SDK needed).
 *  Replaces the previous Anthropic client; keeps the same exported surface so
 *  the rest of the app is unchanged. */

// gemini-2.5-flash is multimodal and (unlike 2.0-flash on this key) has free-tier
// quota, so it powers both receipt vision and chat.
export const GEMINI_VISION_MODEL = "gemini-2.5-flash";
export const GEMINI_CHAT_MODEL = "gemini-2.5-flash";

const KEY_NAMES = ["Google_gemini_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY"];
const apiKey = (): string | undefined => {
  for (const n of KEY_NAMES) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
};

const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const aiConfigured = () => !!apiKey();
export const isVisionType = (mime: string | null) => !!mime && VISION_TYPES.has(mime);

class GeminiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Gemini ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

/** Turns raw API errors into something a user can act on. */
export function friendlyAiError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const detail = ((e as { detail?: string })?.detail ?? "").toLowerCase();

  if (status === 429 || detail.includes("resource_exhausted") || detail.includes("quota")) {
    if (detail.includes("limit: 0") || detail.includes("free_tier")) {
      return "Your Gemini project has no available quota (free-tier limit is 0). Enable billing or a paid tier for the key in Google AI Studio (aistudio.google.com → Get API key → Plan), then try again.";
    }
    return "Gemini is rate-limited right now — wait a moment and try again.";
  }
  if (status === 400 && detail.includes("api key not valid")) {
    return "Your Gemini API key was rejected. Check Google_gemini_API_KEY in .env.local, then restart the dev server.";
  }
  if (status === 403) return "Gemini denied the request — check the API key's permissions and that the Generative Language API is enabled.";
  if (status === 404) return "That Gemini model isn't available to your key. It may need billing enabled.";
  if (status === 503) return "Gemini is temporarily overloaded — try again shortly.";
  return e instanceof Error ? e.message : "The AI hit an error.";
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** Low-level call to generateContent. Returns the model's text output, or
 *  throws GeminiError (carrying status + detail for friendlyAiError). */
async function generate(opts: {
  model: string;
  system: string;
  contents: GeminiContent[];
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const key = apiKey();
  if (!key) throw new GeminiError(401, "no api key");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${key}`;
  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new GeminiError(0, e instanceof Error ? e.message : "network error");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      detail = JSON.parse(text)?.error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new GeminiError(res.status, detail || res.statusText);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(400, `blocked: ${data.promptFeedback.blockReason}`);
  }
  const cand = data.candidates?.[0];
  if (!cand) throw new GeminiError(502, "Gemini returned no answer");
  if (cand.finishReason && cand.finishReason !== "STOP" && cand.finishReason !== "MAX_TOKENS") {
    throw new GeminiError(400, `stopped: ${cand.finishReason}`);
  }
  return (cand.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

/** Chat completion for the assistant (plain text). */
export function geminiChat(opts: {
  system: string;
  contents: GeminiContent[];
}): Promise<string> {
  return generate({
    model: GEMINI_CHAT_MODEL,
    system: opts.system,
    contents: opts.contents,
    maxOutputTokens: 1200,
    temperature: 0.25,
  });
}

// ── Receipt extraction ──────────────────────────────────────────────────────
export interface ReceiptExtraction {
  vendor: string | null;
  date: string | null; // ISO yyyy-mm-dd
  amount: number | null; // total, GST-inclusive
  gst_amount: number | null;
  category: string | null;
  description: string | null;
  confidence: number | null; // 0..1
}

const EXTRACT_SYSTEM = `You read Australian receipts and tax invoices and return structured data.
Rules:
- Amounts are in AUD. "amount" is the GST-inclusive total actually paid.
- "gst_amount" is the GST component if the receipt states one; otherwise null (do not guess).
- "date" is the purchase date as ISO yyyy-mm-dd.
- "category" MUST be exactly one of the category names provided by the user, or null if none fit.
- "description" is a short human label for the purchase (e.g. "Hot water valve replacement").
- "confidence" is your overall confidence from 0 to 1.
Return ONLY a JSON object with keys: vendor, date, amount, gst_amount, category, description, confidence.`;

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Extracts receipt fields from an image. Throws on failure — callers catch
 *  and fall back to manual entry. */
export async function extractReceipt(opts: {
  base64: string;
  mediaType: string;
  categories: string[];
}): Promise<ReceiptExtraction> {
  const raw = await generate({
    model: GEMINI_VISION_MODEL,
    system: EXTRACT_SYSTEM,
    json: true,
    temperature: 0.1,
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: opts.mediaType, data: opts.base64 } },
          { text: `Available categories: ${opts.categories.join(", ")}.\nExtract the receipt now.` },
        ],
      },
    ],
  });

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
