"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadWorkouts, removeWorkout } from "@/lib/store";
import {
  formatRelativeDay,
  formatNumber,
  parseISODate,
  pluralize,
} from "@/lib/format";
import type { Workout } from "@/lib/types";
import {
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui";

export default function WorkoutsPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (user) setWorkouts(loadWorkouts(user.id));
  }, [user]);

  const filtered = useMemo(() => {
    if (!workouts) return [];
    const term = query.trim().toLowerCase();
    if (!term) return workouts;
    return workouts.filter((workout) => {
      if (workout.notes?.toLowerCase().includes(term)) return true;
      return workout.sets.some((set) =>
        set.exercise.toLowerCase().includes(term)
      );
    });
  }, [workouts, query]);

  if (!user || !workouts) {
    return <Spinner label="Loading workouts…" />;
  }

  const totalSets = workouts.reduce(
    (sum, workout) => sum + workout.sets.length,
    0
  );

  const handleDelete = (workout: Workout) => {
    if (
      !window.confirm(
        `Delete the workout from ${formatRelativeDay(workout.date)}? This cannot be undone.`
      )
    ) {
      return;
    }
    setWorkouts(removeWorkout(user.id, workout.id));
  };

  return (
    <div>
      <PageHeader
        title="Workouts"
        description={`${workouts.length} ${pluralize(workouts.length, "session")} · ${totalSets} ${pluralize(totalSets, "set")} logged`}
        actions={
          <Link href="/workouts/new" className={buttonClasses("primary", "md")}>
            <Plus className="h-4 w-4" />
            Log workout
          </Link>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          type="search"
          placeholder="Search by exercise or note…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      {workouts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No workouts yet"
          description="Log your first session and CoachApp will start tracking volume, trends, and personal records."
          action={
            <Link
              href="/workouts/new"
              className={buttonClasses("primary", "md")}
            >
              Log your first workout
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-zinc-500">
          No workouts match “{query}”.
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((workout) => {
            const date = parseISODate(workout.date);
            const exercises = Array.from(
              new Set(workout.sets.map((set) => set.exercise))
            );
            const volume = workout.sets.reduce(
              (sum, set) => sum + set.weight * set.reps,
              0
            );

            return (
              <li key={workout.id}>
                <Card className="group relative p-4 transition hover:border-white/20 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                      <span className="text-xs font-medium uppercase text-zinc-500">
                        {date.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-semibold leading-none text-white">
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/workouts/${workout.id}`}
                          className="text-sm font-semibold text-white hover:text-emerald-300"
                        >
                          {formatRelativeDay(workout.date)}
                        </Link>
                        <Badge>{workout.sets.length} sets</Badge>
                        {exercises.length > 0 ? (
                          <Badge tone="blue">{exercises.length} lifts</Badge>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {exercises.slice(0, 5).map((exercise) => (
                          <span
                            key={exercise}
                            className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400"
                          >
                            {exercise}
                          </span>
                        ))}
                        {exercises.length > 5 ? (
                          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-500">
                            +{exercises.length - 5} more
                          </span>
                        ) : null}
                      </div>

                      {workout.notes ? (
                        <p className="mt-2 line-clamp-1 text-xs italic text-zinc-500">
                          {workout.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-semibold text-zinc-100">
                        {formatNumber(volume)} kg
                      </p>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/workouts/${workout.id}/edit`}
                          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-emerald-300"
                          title="Edit workout"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(workout)}
                          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-rose-300"
                          title="Delete workout"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
