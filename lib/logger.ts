/** Structured logging. Vercel captures stdout/stderr per request, so emitting
 *  single-line JSON makes failures searchable there without another service.
 *  If SENTRY_DSN (or a generic ERROR_WEBHOOK_URL) is set later, forwarding can
 *  be added here in one place. */

type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, event: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Never log secrets or full request bodies — only identifiers and messages. */
export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, error: unknown, fields?: LogFields) =>
    emit("error", event, {
      ...fields,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
    }),
};
