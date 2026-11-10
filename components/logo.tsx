import { Dumbbell } from "lucide-react";
import { cn } from "./ui";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-emerald-950 shadow-[0_0_24px_-6px_rgba(16,185,129,0.8)]">
        <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact ? (
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-tight text-white">
            CoachApp
          </span>
          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/20">
            AI
          </span>
        </span>
      ) : null}
    </div>
  );
}
