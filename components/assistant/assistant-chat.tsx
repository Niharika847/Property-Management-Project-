"use client";

import { askAssistant, type ChatTurn } from "@/app/(app)/assistant/actions";
import { Sparkles, ArrowUp, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  isError?: boolean;
}

const SUGGESTIONS = [
  "How much did I spend on maintenance this year?",
  "Which property costs the most?",
  "What's my monthly cash flow?",
  "Is any rent overdue?",
];

export function AssistantChat({ aiOn }: { aiOn: boolean }) {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const history: ChatTurn[] = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: q });
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);

    const res = await askAssistant(history);
    setLoading(false);
    if (res.ok) {
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } else {
      setMessages((m) => [...m, { role: "assistant", content: res.error, isError: true }]);
    }
  }

  // Auto-send a query passed from the "Ask Roost" bar (?q=...)
  useEffect(() => {
    const q = params.get("q");
    if (q && !startedRef.current) {
      startedRef.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink">AI Assistant</h1>
          <p className="text-xs text-muted">Answers come from your ledger — never invented.</p>
        </div>
      </div>

      {!aiOn && (
        <div className="mb-4 flex items-start gap-2 rounded-(--radius-field) border border-warn/40 bg-warn-soft px-3 py-2.5 text-xs text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            The assistant is off until an <code className="font-mono">ANTHROPIC_API_KEY</code> is set
            in <code className="font-mono">.env.local</code> and the dev server restarts.
          </span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold text-ink">Ask about your properties</p>
              <p className="mt-1 text-sm text-muted">
                Cash flow, expenses, rent, comparisons — grounded in your real numbers.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-line bg-card px-3.5 py-2 text-sm text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      m.isError ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"
                    }`}
                  >
                    {m.isError ? <TriangleAlert className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`inline-block whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-2.5 text-sm ${
                        m.isError ? "bg-danger-soft text-danger" : "bg-card text-ink"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand"
                          >
                            <Sparkles className="size-3" aria-hidden /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Sparkles className="size-4 animate-pulse" aria-hidden />
                </span>
                <div className="rounded-2xl rounded-tl-md bg-card px-4 py-2.5 text-sm text-muted">
                  Roost is checking your ledger…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2 rounded-(--radius-card) border border-line bg-card px-4 py-2.5 shadow-sm"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your cash flow, expenses, rent…"
          aria-label="Ask the assistant"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="flex size-8 items-center justify-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
