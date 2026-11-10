"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  addSuggestions,
  clearChat,
  loadChat,
  loadSuggestions,
  loadWorkouts,
  saveChat,
  uid,
  updateSuggestion,
} from "@/lib/store";
import type {
  ChatMessage,
  CoachResponse,
  Suggestion,
} from "@/lib/types";
import { SuggestionCard } from "@/components/suggestion-card";
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui";

const prompts = [
  "How am I doing?",
  "Am I plateauing on bench?",
  "What should I change next?",
  "Summarize my last 4 weeks",
];

const toolLabels: Record<string, string> = {
  get_history: "Reviewed history",
  get_progress: "Calculated progress",
  suggest_adjustment: "Prepared suggestion",
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialPromptSent = useRef(false);

  useEffect(() => {
    if (!user) return;
    setMessages(loadChat(user.id));
    setSuggestions(loadSuggestions(user.id));
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: { ai?: boolean }) => setAiReady(Boolean(data.ai)))
      .catch(() => setAiReady(false));
  }, [user]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !user || !messages || sending) return;

      setError(null);
      setInput("");
      setSending(true);

      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages, userMessage];
      setMessages(next);
      saveChat(user.id, next);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            workouts: loadWorkouts(user.id),
            userName: user.name,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | (CoachResponse & { error?: string })
          | null;

        if (!response.ok || !data || !data.message) {
          throw new Error(data?.error ?? "The coach could not answer right now.");
        }

        const assistantId = uid();
        const stored = (data.suggestions ?? []).map((suggestion) => ({
          ...suggestion,
          messageId: assistantId,
        }));

        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
          toolsUsed: data.toolsUsed ?? [],
          fallback: data.fallback,
          ...(stored.length > 0
            ? { suggestionIds: stored.map((suggestion) => suggestion.id) }
            : {}),
        };

        const complete = [...next, assistantMessage];
        setMessages(complete);
        saveChat(user.id, complete);

        if (stored.length > 0) {
          setSuggestions(addSuggestions(user.id, stored));
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong. Try again."
        );
      } finally {
        setSending(false);
      }
    },
    [user, messages, sending]
  );

  useEffect(() => {
    if (!user || messages === null || initialPromptSent.current) return;
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    if (query) {
      initialPromptSent.current = true;
      window.history.replaceState({}, "", "/chat");
      void sendMessage(query);
    }
  }, [user, messages, sendMessage]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, sending]);

  const suggestionsByMessage = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const suggestion of suggestions) {
      if (!suggestion.messageId) continue;
      const list = map.get(suggestion.messageId) ?? [];
      list.push(suggestion);
      map.set(suggestion.messageId, list);
    }
    return map;
  }, [suggestions]);

  if (!user || messages === null) {
    return <Spinner label="Opening your coach…" />;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleStatus = (
    suggestion: Suggestion,
    status: Suggestion["status"]
  ) => {
    setSuggestions(updateSuggestion(user.id, suggestion.id, { status }));
  };

  const handleClear = () => {
    if (!window.confirm("Clear this conversation? Suggestions are kept.")) {
      return;
    }
    clearChat(user.id);
    setMessages([]);
    setError(null);
  };

  return (
    <div>
      <PageHeader
        title="Coach"
        description="Ask about your progress. Suggestions are proposals — you decide."
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null
        }
      />

      {aiReady === false ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-200/90">
            Live AI is not configured. CoachApp is using the built-in rules coach
            — add <code className="text-amber-100">OPENAI_API_KEY</code> in Vercel
            to enable the full agent.
          </p>
        </div>
      ) : null}

      <Card className="flex flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="min-h-[48vh] flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:max-h-[58vh] sm:px-6"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center">
              <span className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300 ring-1 ring-emerald-500/20">
                <Sparkles className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">
                Your coach is ready
              </h2>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-400">
                Ask a question about your training. CoachApp reads your logged
                workouts, calculates the trends, and proposes adjustments you
                can accept or reject.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const linked = message.suggestionIds?.length
                ? suggestionsByMessage.get(message.id) ??
                  suggestions.filter((item) =>
                    message.suggestionIds?.includes(item.id)
                  )
                : suggestionsByMessage.get(message.id) ?? [];

              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="rounded-2xl rounded-br-md bg-emerald-500 px-4 py-2.5 text-sm leading-relaxed text-emerald-950">
                        {message.content}
                      </div>
                      <p className="mt-1 text-right text-[10px] text-zinc-600">
                        {timeLabel(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex gap-3">
                  <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 sm:flex">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="max-w-[92%]">
                      <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                        {message.content}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <p className="text-[10px] text-zinc-600">
                          {timeLabel(message.createdAt)}
                        </p>
                        {message.fallback ? (
                          <Badge tone="amber">Rules coach</Badge>
                        ) : null}
                        {message.toolsUsed?.map((tool) =>
                          toolLabels[tool] ? (
                            <span
                              key={tool}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400"
                            >
                              <Check className="h-3 w-3 text-emerald-400" />
                              {toolLabels[tool]}
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>

                    {linked.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        {linked.map((suggestion) => (
                          <SuggestionCard
                            key={suggestion.id}
                            suggestion={suggestion}
                            onAccept={(item) => handleStatus(item, "accepted")}
                            onReject={(item) => handleStatus(item, "rejected")}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}

          {sending ? (
            <div className="flex items-center gap-3">
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 sm:flex">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-white/[0.015] p-3 sm:p-4">
          {messages.length > 0 ? (
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
              {prompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage(prompt)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-400 transition hover:text-emerald-300 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mb-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask your coach anything about your training…"
              disabled={sending}
              maxLength={500}
              aria-label="Message"
            />
            <Button
              type="submit"
              size="md"
              loading={sending}
              disabled={!input.trim()}
              className="shrink-0"
            >
              {!sending ? <Send className="h-4 w-4" /> : null}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
          <p className="mt-2 text-[10px] text-zinc-600">
            Enter to send. CoachApp analyses your log; suggestions are not
            automatic changes.
          </p>
        </div>
      </Card>
    </div>
  );
}
