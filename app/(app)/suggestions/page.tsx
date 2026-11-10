"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadSuggestions, updateSuggestion } from "@/lib/store";
import type { Suggestion } from "@/lib/types";
import { SuggestionCard } from "@/components/suggestion-card";
import {
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  cn,
} from "@/components/ui";

type Tab = "pending" | "history";

export default function SuggestionsPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [tab, setTab] = useState<Tab>("pending");

  useEffect(() => {
    if (user) setSuggestions(loadSuggestions(user.id));
  }, [user]);

  const pending = useMemo(
    () => (suggestions ?? []).filter((item) => item.status === "pending"),
    [suggestions]
  );
  const history = useMemo(
    () =>
      (suggestions ?? [])
        .filter((item) => item.status !== "pending")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [suggestions]
  );

  if (!user || !suggestions) {
    return <Spinner label="Loading suggestions…" />;
  }

  const setStatus = (suggestion: Suggestion, status: Suggestion["status"]) => {
    setSuggestions(updateSuggestion(user.id, suggestion.id, { status }));
  };

  const shown = tab === "pending" ? pending : history;

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Proposals from your coach. Nothing changes until you accept."
        actions={
          <Link href="/chat" className={buttonClasses("secondary", "md")}>
            <Sparkles className="h-4 w-4" />
            Ask coach
          </Link>
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            tab === "pending"
              ? "bg-white/[0.08] text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            tab === "history"
              ? "bg-white/[0.08] text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          History ({history.length})
        </button>
      </div>

      {shown.length === 0 ? (
        tab === "pending" ? (
          <EmptyState
            icon={Lightbulb}
            title="No pending suggestions"
            description="Ask your coach how you are doing. When the data supports a change, a proposal will appear here for your approval."
            action={
              <Link href="/chat" className={buttonClasses("primary", "md")}>
                <Sparkles className="h-4 w-4" />
                Ask CoachApp
              </Link>
            }
          />
        ) : (
          <Card className="px-6 py-12 text-center text-sm text-zinc-500">
            Accepted and rejected suggestions will appear here.
          </Card>
        )
      ) : (
        <div className="space-y-3">
          {shown.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              {...(tab === "pending"
                ? {
                    onAccept: (item: Suggestion) => setStatus(item, "accepted"),
                    onReject: (item: Suggestion) => setStatus(item, "rejected"),
                  }
                : {})}
            />
          ))}
        </div>
      )}

      {tab === "pending" && pending.length > 0 ? (
        <Card className="mt-4 flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-xs leading-relaxed text-zinc-400">
            Accepting a suggestion records your decision here. CoachApp never
            changes your logged workouts automatically.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
