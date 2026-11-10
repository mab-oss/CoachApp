import { formatShortDate, isoWeekStart, parseISODate, toISODate } from "./format";
import type {
  ExerciseStat,
  PersonalRecord,
  ProgressSummary,
  WeeklyVolume,
  Workout,
} from "./types";

export function normalizeExercise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function displayExercise(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function roundTo(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

function daysBetween(a: string, b: string): number {
  const first = parseISODate(a).getTime();
  const second = parseISODate(b).getTime();
  return Math.abs(first - second) / 86_400_000;
}

export function weeklyVolume(workouts: Workout[], weeks = 8): WeeklyVolume[] {
  const currentWeek = isoWeekStart(new Date());
  const buckets = new Map<
    string,
    { volume: number; sets: number; sessions: Set<string> }
  >();

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const week = new Date(currentWeek);
    week.setDate(week.getDate() - index * 7);
    buckets.set(toISODate(week), { volume: 0, sets: 0, sessions: new Set() });
  }

  for (const workout of workouts) {
    const key = toISODate(isoWeekStart(parseISODate(workout.date)));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    for (const set of workout.sets) {
      bucket.volume += set.weight * set.reps;
      bucket.sets += 1;
    }
    bucket.sessions.add(workout.id);
  }

  return Array.from(buckets.entries()).map(([weekStart, bucket]) => ({
    weekStart,
    label: formatShortDate(weekStart),
    volume: Math.round(bucket.volume),
    sets: bucket.sets,
    sessions: bucket.sessions.size,
  }));
}

function summarizeExercise(
  name: string,
  byDate: Map<string, { e1rm: number; weight: number; volume: number }>
): ExerciseStat {
  const points = Array.from(byDate.entries())
    .map(([date, value]) => ({
      date,
      e1rm: Math.round(value.e1rm * 10) / 10,
      weight: value.weight,
      volume: Math.round(value.volume),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const best = points.reduce(
    (acc, point) => (point.e1rm > acc.e1rm ? point : acc),
    points[0]
  );
  const last = points[points.length - 1];

  const fourWeeksAgo = new Date(parseISODate(last.date));
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const baseline =
    [...points].reverse().find((point) => point.date <= toISODate(fourWeeksAgo)) ??
    points[0];

  const trendPct =
    baseline.e1rm > 0
      ? Math.round(((last.e1rm - baseline.e1rm) / baseline.e1rm) * 1000) / 10
      : 0;

  const referenceWeek = isoWeekStart(parseISODate(last.date));
  const recentStart = new Date(referenceWeek);
  recentStart.setDate(recentStart.getDate() - 14);
  const recentStartIso = toISODate(recentStart);

  const recent = points.filter((point) => point.date >= recentStartIso);
  const firstRecent = recent[0];
  const lastRecent = recent[recent.length - 1];

  const plateau =
    points.length >= 4 &&
    recent.length >= 3 &&
    Boolean(firstRecent && lastRecent) &&
    lastRecent.e1rm <= firstRecent.e1rm * 1.005;

  return {
    exercise: name,
    sessions: points.length,
    lastDate: last.date,
    bestE1rm: Math.round(best.e1rm * 10) / 10,
    bestWeight: best.weight,
    points,
    trendPct,
    plateau,
  };
}

export function exerciseStats(workouts: Workout[]): ExerciseStat[] {
  const map = new Map<
    string,
    {
      display: string;
      byDate: Map<string, { e1rm: number; weight: number; volume: number }>;
    }
  >();

  for (const workout of workouts) {
    for (const set of workout.sets) {
      const key = normalizeExercise(set.exercise);
      if (!key) continue;
      const entry = map.get(key) ?? {
        display: displayExercise(set.exercise),
        byDate: new Map(),
      };
      const dateEntry = entry.byDate.get(workout.date) ?? {
        e1rm: 0,
        weight: 0,
        volume: 0,
      };
      dateEntry.e1rm = Math.max(dateEntry.e1rm, estimate1RM(set.weight, set.reps));
      dateEntry.weight = Math.max(dateEntry.weight, set.weight);
      dateEntry.volume += set.weight * set.reps;
      entry.byDate.set(workout.date, dateEntry);
      map.set(key, entry);
    }
  }

  return Array.from(map.values())
    .map((entry) => summarizeExercise(entry.display, entry.byDate))
    .sort((a, b) => b.sessions - a.sessions);
}

export function personalRecords(workouts: Workout[]): PersonalRecord[] {
  return exerciseStats(workouts)
    .map((stat) => {
      const bestSet = workouts
        .flatMap((workout) =>
          workout.sets
            .filter(
              (set) =>
                normalizeExercise(set.exercise) ===
                normalizeExercise(stat.exercise)
            )
            .map((set) => ({ set, date: workout.date }))
        )
        .sort(
          (a, b) =>
            estimate1RM(b.set.weight, b.set.reps) -
            estimate1RM(a.set.weight, a.set.reps)
        )[0];

      return {
        exercise: stat.exercise,
        e1rm: bestSet
          ? Math.round(estimate1RM(bestSet.set.weight, bestSet.set.reps) * 10) / 10
          : 0,
        weight: bestSet?.set.weight ?? 0,
        reps: bestSet?.set.reps ?? 0,
        date: bestSet?.date ?? stat.lastDate ?? "",
      };
    })
    .filter((record) => record.date)
    .sort((a, b) => b.e1rm - a.e1rm);
}

export function buildSummary(workouts: Workout[]): ProgressSummary {
  const now = new Date();
  const currentWeek = isoWeekStart(now);
  const previousWeek = new Date(currentWeek);
  previousWeek.setDate(previousWeek.getDate() - 7);

  let thisWeekSessions = 0;
  let thisWeekVolume = 0;
  let lastWeekSessions = 0;
  let lastWeekVolume = 0;

  for (const workout of workouts) {
    const week = toISODate(isoWeekStart(parseISODate(workout.date)));
    const volume = workout.sets.reduce(
      (sum, set) => sum + set.weight * set.reps,
      0
    );
    if (week === toISODate(currentWeek)) {
      thisWeekSessions += 1;
      thisWeekVolume += volume;
    } else if (week === toISODate(previousWeek)) {
      lastWeekSessions += 1;
      lastWeekVolume += volume;
    }
  }

  const stats = exerciseStats(workouts);

  return {
    totalWorkouts: workouts.length,
    totalSets: workouts.reduce((sum, workout) => sum + workout.sets.length, 0),
    totalVolume: Math.round(
      workouts.reduce(
        (sum, workout) =>
          sum +
          workout.sets.reduce(
            (setSum, set) => setSum + set.weight * set.reps,
            0
          ),
        0
      )
    ),
    thisWeekSessions,
    thisWeekVolume: Math.round(thisWeekVolume),
    lastWeekSessions,
    lastWeekVolume: Math.round(lastWeekVolume),
    prs: personalRecords(workouts),
    exercises: stats,
    plateaus: stats.filter((stat) => stat.plateau).map((stat) => stat.exercise),
    weeklyVolume: weeklyVolume(workouts),
  };
}

export type HistoryQuery = {
  exercise?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export type HistoryEntry = {
  date: string;
  notes?: string;
  volume: number;
  sets: {
    exercise: string;
    reps: number;
    weight: number;
    rpe?: number;
  }[];
};

export function getHistory(
  workouts: Workout[],
  query: HistoryQuery = {}
): HistoryEntry[] {
  const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
  const exerciseKey = query.exercise ? normalizeExercise(query.exercise) : null;

  return workouts
    .filter((workout) => {
      if (query.startDate && workout.date < query.startDate) return false;
      if (query.endDate && workout.date > query.endDate) return false;
      return true;
    })
    .map((workout) => {
      const sets = workout.sets
        .filter(
          (set) =>
            !exerciseKey || normalizeExercise(set.exercise) === exerciseKey
        )
        .map((set) => ({
          exercise: displayExercise(set.exercise),
          reps: set.reps,
          weight: set.weight,
          ...(set.rpe ? { rpe: set.rpe } : {}),
        }));

      return {
        date: workout.date,
        ...(workout.notes ? { notes: workout.notes } : {}),
        volume: Math.round(
          sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
        ),
        sets,
      };
    })
    .filter((entry) => entry.sets.length > 0)
    .slice(0, limit);
}

export function findExerciseStat(
  workouts: Workout[],
  exercise: string
): ExerciseStat | null {
  const key = normalizeExercise(exercise);
  return (
    exerciseStats(workouts).find(
      (stat) => normalizeExercise(stat.exercise) === key
    ) ?? null
  );
}

export function exerciseNames(workouts: Workout[]): string[] {
  const seen = new Map<string, string>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      const key = normalizeExercise(set.exercise);
      if (key && !seen.has(key)) seen.set(key, displayExercise(set.exercise));
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export function daysSince(dateIso: string): number {
  return Math.round(daysBetween(dateIso, toISODate(new Date())));
}
