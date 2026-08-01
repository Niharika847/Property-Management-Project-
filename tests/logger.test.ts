import { describe, expect, it } from "vitest";
import { messageFrom, redact, summarizeForAlert } from "@/lib/logger";

describe("redact — secrets must never reach a log line or an alert", () => {
  it("redacts anything that looks like a credential", () => {
    const safe = redact({
      SUPABASE_SERVICE_ROLE_KEY: "sb-secret-value",
      apiKey: "abc123",
      access_token: "tok",
      password: "hunter2",
      authorization: "Bearer xyz",
      cookie: "session=1",
      SENTRY_DSN: "https://x@y/1",
    });
    for (const value of Object.values(safe)) {
      expect(value).toBe("[redacted]");
    }
  });

  it("is case-insensitive and matches keys containing the word", () => {
    expect(redact({ StripeSecretKey: "sk_live_x" }).StripeSecretKey).toBe("[redacted]");
    expect(redact({ user_api_token: "t" }).user_api_token).toBe("[redacted]");
  });

  it("leaves ordinary diagnostic fields untouched", () => {
    const safe = redact({ route: "/dashboard", workspaceId: "abc", count: 3, message: "boom" });
    expect(safe).toEqual({ route: "/dashboard", workspaceId: "abc", count: 3, message: "boom" });
  });

  it("never leaks the original secret value anywhere in the output", () => {
    const serialized = JSON.stringify(redact({ serviceRoleKey: "SUPER-SECRET" }));
    expect(serialized).not.toContain("SUPER-SECRET");
  });
});

describe("summarizeForAlert", () => {
  it("includes the event and message", () => {
    const text = summarizeForAlert("assistant.failed", { message: "Gemini timed out" });
    expect(text).toContain("assistant.failed");
    expect(text).toContain("Gemini timed out");
  });

  it("includes the route when there is one", () => {
    expect(summarizeForAlert("client.render_error", { route: "/expenses" })).toContain("/expenses");
  });

  it("copes with no message at all", () => {
    expect(summarizeForAlert("something.broke", {})).toContain("something.broke");
  });

  it("caps the length so a stack trace cannot flood a chat channel", () => {
    const text = summarizeForAlert("boom", { message: "x".repeat(5000) });
    expect(text.length).toBeLessThanOrEqual(500);
  });
});

describe("messageFrom — alerts must say what actually broke", () => {
  it("reads an Error's message", () => {
    expect(messageFrom(new Error("Gemini timed out"))).toBe("Gemini timed out");
  });

  it("passes a string through", () => {
    expect(messageFrom("plain failure")).toBe("plain failure");
  });

  it("unpacks a Supabase-style error object instead of [object Object]", () => {
    const supabaseError = {
      message: "column workspaces.plan does not exist",
      code: "42703",
      details: null,
      hint: null,
    };
    const text = messageFrom(supabaseError);
    expect(text).toContain("column workspaces.plan does not exist");
    expect(text).toContain("42703");
    expect(text).not.toBe("[object Object]");
  });

  it("falls back to JSON for an object with no recognisable fields", () => {
    const text = messageFrom({ weird: true, nested: { a: 1 } });
    expect(text).not.toBe("[object Object]");
    expect(text).toContain("weird");
  });

  it("survives an object that cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => messageFrom(circular)).not.toThrow();
  });

  it("handles null and undefined", () => {
    expect(messageFrom(null)).toBe("null");
    expect(messageFrom(undefined)).toBe("undefined");
  });
});
