/** Structured logging. Vercel captures stdout/stderr per request, so emitting
 *  single-line JSON makes failures searchable there.
 *
 *  Logs nobody reads are not monitoring, though — so when ERROR_WEBHOOK_URL is
 *  set, errors are also pushed to it (Slack, Discord, or any endpoint that
 *  accepts a JSON POST). Without that variable the app behaves exactly as it
 *  did before, so local development is unaffected. */

type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const WEBHOOK = process.env.ERROR_WEBHOOK_URL;

/** True when errors reach somewhere a person will actually see them. */
export const monitoringConfigured = () => Boolean(WEBHOOK);

/** Field names whose values must never leave the process. */
const SECRET_KEY = /key|token|secret|password|authorization|cookie|dsn/i;

/** Defence in depth: log calls are hand-written, but a stray `...fields`
 *  spread should never be what leaks a service-role key into an alert. */
export function redact(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    safe[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return safe;
}

/** Keeps an alert readable in a chat client without dumping a whole stack. */
export function summarizeForAlert(event: string, fields: LogFields): string {
  const message = typeof fields.message === "string" ? fields.message : "";
  const where = typeof fields.route === "string" ? ` (${fields.route})` : "";
  return `Roost error — ${event}${where}${message ? `: ${message}` : ""}`.slice(0, 500);
}

async function forward(event: string, fields: LogFields) {
  if (!WEBHOOK) return;
  const text = summarizeForAlert(event, fields);
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` suits Slack, `content` suits Discord, `event`/`fields` suit
      // anything generic — one payload covers the common sinks.
      body: JSON.stringify({ text, content: text, event, fields }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoring must never take a request down with it.
  }
}

function emit(level: Level, event: string, fields: LogFields = {}) {
  const safe = redact(fields);
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (level === "error") void forward(event, safe);
}

/** Not everything thrown is an Error. Supabase rejects with a plain object,
 *  and String()-ing that yields "[object Object]" — an alert that tells you
 *  something broke and nothing else. */
export function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    const parts = [o.message, o.code, o.details, o.hint].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(error).slice(0, 300);
    } catch {
      return "unserializable error";
    }
  }
  return String(error);
}

/** Never log secrets or full request bodies — only identifiers and messages. */
export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, error: unknown, fields?: LogFields) =>
    emit("error", event, {
      ...fields,
      message: messageFrom(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
    }),
};
