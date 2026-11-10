import { formatNumber } from "./format";
import {
  buildSummary,
  daysSince,
  normalizeExercise,
  roundTo,
} from "./progress";
import { uid } from "./store";
import type {
  CoachResponse,
  ExerciseStat,
  Suggestion,
  Workout,
} from "./types";

type FallbackInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  workouts: Workout[];
  userName?: string;
};

const LOWER_BODY = /squat|deadlift|leg|hip|lunge|calf|romanian|rdl/i;

function findMentionedExercise(
  text: string,
  stats: ExerciseStat[]
): ExerciseStat | null {
  const lower = text.toLowerCase();
  const exact = stats.find((stat) =>
    lower.includes(normalizeExercise(stat.exercise))
  );
  if (exact) return exact;

  return (
    stats.find((stat) =>
      normalizeExercise(stat.exercise)
        .split(" ")
        .filter((word) => word.length > 3)
        .some((word) => lower.includes(word))
    ) ?? null
  );
}

function buildSuggestion(stat: ExerciseStat): Suggestion {
  const lower = LOWER_BODY.test(stat.exercise);
  const increment = lower ? 5 : 2.5;
  const base = {
    id: uid(),
    exercise: stat.exercise,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    source: "rules" as const,
  };

  if (stat.plateau) {
    const reduction = Math.max(2.5, roundTo(stat.bestWeight * 0.1, 2.5));
    return {
      ...base,
      action: "deload",
      amountKg: reduction,
      reason: `No new best on ${stat.exercise} in about 3 weeks. A lighter week (roughly 10% off) can help you recover and break the plateau.`,
    };
  }

  if (stat.trendPct >= 1) {
    return {
      ...base,
      action: "increase",
      amountKg: increment,
      reason: `${stat.exercise} is trending up ${stat.trendPct}% over the last 4 weeks. Add ${increment} kg next session while keeping your reps in range.`,
    };
  }

  if (stat.trendPct <= -1) {
    return {
      ...base,
      action: "decrease",
      amountKg: increment,
      reason: `${stat.exercise} has slipped ${Math.abs(stat.trendPct)}% recently. Drop ${increment} kg and rebuild with clean reps.`,
    };
  }

  return {
    ...base,
    action: "maintain",
    reason: `${stat.exercise} is holding steady. Keep the current load and focus on clean, controlled reps before adding weight.`,
  };
}

export function fallbackCoach({
  messages,
  workouts,
  userName,
}: FallbackInput): CoachResponse {
  const summary = buildSummary(workouts);
  const who = userName ? `${userName.split(" ")[0]}, ` : "";
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const text = (lastUser?.content ?? "").toLowerCase();

  if (summary.totalWorkouts === 0) {
    return {
      fallback: true,
      suggestions: [],
      toolsUsed: ["get_progress"],
      message:
        "I don't have any workouts to analyze yet. Log your first session and I'll break down your progress, spot plateaus, and suggest what to change next.",
    };
  }

  const mentioned = findMentionedExercise(text, summary.exercises);
  const toolsUsed = ["get_progress"];
  const suggestions: Suggestion[] = [];

  let target = mentioned;
  if (!target) {
    target =
      summary.exercises.find((stat) => stat.plateau) ??
      summary.exercises.find((stat) => stat.trendPct >= 1) ??
      summary.exercises[0];
  }

  if (target) {
    suggestions.push(buildSuggestion(target));
    toolsUsed.push("suggest_adjustment");
  }

  const weekLine = `${who}this week you have ${summary.thisWeekSessions} ${summary.thisWeekSessions === 1 ? "session" : "sessions"} and ${formatNumber(summary.thisWeekVolume)} kg of volume${
    summary.lastWeekSessions > 0
      ? ` (last week: ${summary.lastWeekSessions} sessions, ${formatNumber(summary.lastWeekVolume)} kg)`
      : ""
  }.`;

  const prLine =
    summary.prs.length > 0
      ? `Top lifts: ${summary.prs
          .slice(0, 3)
          .map(
            (pr) =>
              `${pr.exercise} ${new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 1,
              }).format(pr.weight)} kg × ${pr.reps}`
          )
          .join(", ")}.`
      : "";

  if (text.includes("plateau") || text.includes("stuck") || text.includes("stall")) {
    return {
      fallback: true,
      suggestions,
      toolsUsed,
      message:
        summary.plateaus.length > 0
          ? `${weekLine}\n\nThese lifts have not set a new best in roughly 3 weeks: ${summary.plateaus.join(", ")}. A short deload or a small load change is usually the fastest fix. I've drafted a suggestion below — accept it if it looks right.`
          : `${weekLine}\n\nNothing looks plateaued right now — every lift has improved within the last 3 weeks. Keep the current progression going and stay consistent.`,
    };
  }

  if (mentioned) {
    const sinceLast = mentioned.lastDate ? daysSince(mentioned.lastDate) : 0;
    const recency =
      sinceLast > 21
        ? ` Your last logged session for it was ${sinceLast} days ago.`
        : "";
    return {
      fallback: true,
      suggestions,
      toolsUsed,
      message: `${mentioned.exercise}: ${mentioned.sessions} sessions logged, best estimated 1RM ${new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 1,
      }).format(mentioned.bestE1rm)} kg. Four-week trend: ${mentioned.trendPct > 0 ? "+" : ""}${mentioned.trendPct}%.${
        mentioned.plateau
          ? " No new best in about 3 weeks, so it is plateauing."
          : " It is still moving in the right direction."
      }${recency}\n\n${suggestions[0]?.reason ?? ""}`,
    };
  }

  return {
    fallback: true,
    suggestions,
    toolsUsed,
    message: `${weekLine}\n${prLine}${
      summary.plateaus.length > 0
        ? `\n\nPlateau watch: ${summary.plateaus.join(", ")}.`
        : "\n\nNo plateaus detected — every lift has improved in the last 3 weeks."
    }\n\n${suggestions[0]?.reason ?? "Keep progressing steadily and log every session."} You can accept or reject my suggestion below.`,
  };
}
