"use client";

import {
  BatteryLow,
  Check,
  Minus,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { suggestionTitle } from "@/lib/suggestions";
import type { Suggestion } from "@/lib/types";
import { Badge, Button, cn } from "./ui";

const actionStyles = {
  increase: {
    icon: TrendingUp,
    tone: "green" as const,
    ring: "ring-emerald-500/20",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  decrease: {
    icon: TrendingDown,
    tone: "amber" as const,
    ring: "ring-amber-500/20",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  deload: {
    icon: BatteryLow,
    tone: "blue" as const,
    ring: "ring-sky-500/20",
    text: "text-sky-300",
    bg: "bg-sky-500/10",
  },
  add_reps: {
    icon: Repeat,
    tone: "blue" as const,
    ring: "ring-sky-500/20",
    text: "text-sky-300",
    bg: "bg-sky-500/10",
  },
  maintain: {
    icon: Minus,
    tone: "neutral" as const,
    ring: "ring-white/10",
    text: "text-zinc-300",
    bg: "bg-white/[0.06]",
  },
};

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept?: (suggestion: Suggestion) => void;
  onReject?: (suggestion: Suggestion) => void;
}) {
  const style = actionStyles[suggestion.action];
  const Icon = style.icon;
  const isPending = suggestion.status === "pending";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
        !isPending && "opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 rounded-xl p-2 ring-1",
            style.bg,
            style.ring,
            style.text
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {suggestionTitle(suggestion)}
            </p>
            <Badge tone={style.tone}>
              <Sparkles className="h-3 w-3" />
              {suggestion.source === "agent" ? "AI proposal" : "Coach proposal"}
            </Badge>
            {suggestion.status === "accepted" ? (
              <Badge tone="green">Accepted</Badge>
            ) : null}
            {suggestion.status === "rejected" ? (
              <Badge tone="rose">Rejected</Badge>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            {suggestion.reason}
          </p>

          {isPending && (onAccept || onReject) ? (
            <div className="mt-3 flex gap-2">
              {onAccept ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAccept(suggestion)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
              ) : null}
              {onReject ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onReject(suggestion)}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
