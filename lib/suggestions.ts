import type { Suggestion, SuggestionAction } from "./types";

export const actionLabels: Record<SuggestionAction, string> = {
  increase: "Increase load",
  decrease: "Reduce load",
  deload: "Deload week",
  maintain: "Maintain load",
  add_reps: "Add reps",
};

export function suggestionTitle(suggestion: Suggestion): string {
  const amount = suggestion.amountKg
    ? ` by ${new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 1,
      }).format(suggestion.amountKg)} kg`
    : "";
  const reps = suggestion.reps ? ` to ${suggestion.reps} reps` : "";

  switch (suggestion.action) {
    case "increase":
      return `Increase ${suggestion.exercise}${amount}`;
    case "decrease":
    case "deload":
      return `${suggestion.action === "deload" ? "Deload" : "Reduce"} ${suggestion.exercise}${amount}`;
    case "add_reps":
      return `Add reps on ${suggestion.exercise}${reps}`;
    case "maintain":
    default:
      return `Keep ${suggestion.exercise} at current load`;
  }
}
