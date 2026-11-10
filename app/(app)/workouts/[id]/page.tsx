"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Dumbbell,
  Layers,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadWorkouts, removeWorkout } from "@/lib/store";
import { estimate1RM } from "@/lib/progress";
import {
  formatFullDate,
  formatNumber,
  formatRelativeDay,
  formatWeight,
  pluralize,
} from "@/lib/format";
import type { Workout, WorkoutSet } from "@/lib/types";
import {
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";

export default function WorkoutDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  useEffect(() => {
    if (user) setWorkouts(loadWorkouts(user.id));
  }, [user]);

  const workout = useMemo(
    () => workouts?.find((item) => item.id === params.id) ?? null,
    [workouts, params.id]
  );

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of workout?.sets ?? []) {
      const list = map.get(set.exercise) ?? [];
      list.push(set);
      map.set(set.exercise, list);
    }
    return Array.from(map.entries());
  }, [workout]);

  if (!user || !workouts) {
    return <Spinner label="Loading workout…" />;
  }

  if (!workout) {
    return (
      <div>
        <EmptyState
          icon={Dumbbell}
          title="Workout not found"
          description="It may have been deleted, or this browser does not have it."
          action={
            <Link href="/workouts" className={buttonClasses("primary", "md")}>
              Back to workouts
            </Link>
          }
        />
      </div>
    );
  }

  const volume = workout.sets.reduce(
    (sum, set) => sum + set.weight * set.reps,
    0
  );
  const bestE1rm = workout.sets.reduce(
    (best, set) => Math.max(best, estimate1RM(set.weight, set.reps)),
    0
  );

  const handleDelete = () => {
    if (!window.confirm("Delete this workout? This cannot be undone.")) return;
    removeWorkout(user.id, workout.id);
    router.replace("/workouts");
  };

  return (
    <div>
      <Link
        href="/workouts"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to workouts
      </Link>

      <PageHeader
        title={formatRelativeDay(workout.date)}
        description={formatFullDate(workout.date)}
        actions={
          <>
            <Link
              href={`/workouts/${workout.id}/edit`}
              className={buttonClasses("secondary", "sm")}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className={buttonClasses("danger", "sm")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Sets"
          value={String(workout.sets.length)}
          hint={`${groups.length} ${pluralize(groups.length, "exercise")}`}
          tone="blue"
        />
        <StatCard
          icon={Dumbbell}
          label="Volume"
          value={`${formatNumber(volume)} kg`}
          hint="Weight × reps, all sets"
          tone="green"
        />
        <StatCard
          icon={CalendarDays}
          label="Best est. 1RM"
          value={`${bestE1rm.toFixed(1)} kg`}
          hint="Epley formula"
          tone="violet"
        />
        <StatCard
          icon={Sparkles}
          label="Coach check"
          value="Ask"
          hint="Compare this session"
          tone="amber"
        />
      </div>

      {workout.notes ? (
        <Card className="mt-4 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Notes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
            {workout.notes}
          </p>
        </Card>
      ) : null}

      <div className="mt-4 space-y-4">
        {groups.map(([exercise, sets]) => {
          const groupVolume = sets.reduce(
            (sum, set) => sum + set.weight * set.reps,
            0
          );
          return (
            <Card key={exercise} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {exercise}
                  </h2>
                  <Badge>{sets.length} sets</Badge>
                </div>
                <p className="text-xs font-medium text-zinc-400">
                  {formatNumber(groupVolume)} kg
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-5 py-2 font-medium">Set</th>
                      <th className="px-3 py-2 font-medium">Weight</th>
                      <th className="px-3 py-2 font-medium">Reps</th>
                      <th className="px-3 py-2 font-medium">RPE</th>
                      <th className="px-5 py-2 text-right font-medium">
                        Est. 1RM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {sets.map((set, index) => (
                      <tr key={set.id}>
                        <td className="px-5 py-2.5 text-zinc-500">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-200">
                          {formatWeight(set.weight)}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-300">
                          {set.reps}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">
                          {set.rpe ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium text-emerald-300">
                          {estimate1RM(set.weight, set.reps).toFixed(1)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-5">
        <Link
          href={`/chat?q=${encodeURIComponent(
            `How does my ${groups[0]?.[0] ?? "training"} work compare to recent sessions?`
          )}`}
          className={buttonClasses("secondary", "md")}
        >
          <Sparkles className="h-4 w-4" />
          Ask the coach about this session
        </Link>
      </div>
    </div>
  );
}
