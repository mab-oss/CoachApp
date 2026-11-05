import { addDays, todayISO, weekStart } from './dates'
import { findExercise, type StoreData } from './storage'
import type { ExerciseProgress, ProgressSummary, WeeklyPoint } from './types'

export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export function roundToPlate(value: number): number {
  return (Math.round(value / 2.5) * 2.5)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

interface Bucket {
  volume: number
  best_e1rm: number
  best_weight: number
  total_sets: number
}

function clampWeeks(weeks: number): number {
  return Math.max(2, Math.min(52, Math.trunc(weeks) || 8))
}

export function progressForExercise(
  data: StoreData,
  exerciseName: string,
  weeks = 8,
  today = todayISO(),
): ExerciseProgress | null {
  const exercise = findExercise(data, exerciseName)
  if (!exercise) return null

  const lookback = clampWeeks(weeks)
  const cutoff = addDays(weekStart(today), -7 * (lookback - 1))
  const workouts = new Map(data.workouts.map((workout) => [workout.id, workout]))
  const exerciseSets = data.sets.filter((set) => set.exercise_id === exercise.id)

  let bestWeightAll = 0
  let bestE1rmAll = 0
  for (const set of exerciseSets) {
    bestWeightAll = Math.max(bestWeightAll, set.weight)
    bestE1rmAll = Math.max(bestE1rmAll, estimated1RM(set.weight, set.reps))
  }

  const buckets = new Map<string, Bucket>()
  for (const set of exerciseSets) {
    const workout = workouts.get(set.workout_id)
    if (!workout || workout.performed_at < cutoff) continue

    const week = weekStart(workout.performed_at)
    let bucket = buckets.get(week)
    if (!bucket) {
      bucket = { volume: 0, best_e1rm: 0, best_weight: 0, total_sets: 0 }
      buckets.set(week, bucket)
    }

    bucket.volume += set.weight * set.reps
    bucket.best_e1rm = Math.max(bucket.best_e1rm, estimated1RM(set.weight, set.reps))
    bucket.best_weight = Math.max(bucket.best_weight, set.weight)
    bucket.total_sets += 1
  }

  const weekly: WeeklyPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, bucket]) => ({
      week_start: week,
      volume: round1(bucket.volume),
      best_e1rm: round1(bucket.best_e1rm),
      best_weight: round1(bucket.best_weight),
      total_sets: bucket.total_sets,
    }))

  let changePct = 0
  if (weekly.length >= 2) {
    const baseline = mean(weekly.slice(0, 2).map((point) => point.best_e1rm))
    const recent = mean(weekly.slice(-2).map((point) => point.best_e1rm))
    if (baseline > 0) {
      changePct = round1(((recent - baseline) / baseline) * 100)
    }
  }

  let plateau = false
  if (weekly.length >= 3) {
    const recent = weekly.slice(-3)
    const recentBest = Math.max(...recent.map((point) => point.best_e1rm))
    const prior = weekly.slice(0, -3)
    if (prior.length > 0) {
      const priorBest = Math.max(...prior.map((point) => point.best_e1rm))
      plateau = recentBest <= priorBest * 1.001
    } else {
      const recentMin = Math.min(...recent.map((point) => point.best_e1rm))
      plateau = recentBest - recentMin <= 0.5
    }
  }

  let trend: ExerciseProgress['trend'] = 'flat'
  if (changePct > 1) trend = 'improving'
  else if (changePct < -1) trend = 'declining'

  return {
    exercise: exercise.name,
    target_weight: exercise.target_weight,
    weeks_tracked: weekly.length,
    best_weight: round1(bestWeightAll),
    best_e1rm: round1(bestE1rmAll),
    change_pct: changePct,
    trend,
    plateau,
    last_week_volume: weekly.length > 0 ? weekly[weekly.length - 1].volume : 0,
    weekly,
  }
}

export function getProgressSummary(
  data: StoreData,
  weeks = 8,
  today = todayISO(),
): ProgressSummary {
  const exercises = [...data.exercises].sort((a, b) => a.name.localeCompare(b.name))
  const results: ExerciseProgress[] = []
  for (const exercise of exercises) {
    const progress = progressForExercise(data, exercise.name, weeks, today)
    if (progress && progress.weeks_tracked > 0) results.push(progress)
  }
  return { exercises: results }
}

export function getExerciseProgress(
  data: StoreData,
  exerciseName: string,
  weeks = 8,
  today = todayISO(),
): ExerciseProgress | null {
  return progressForExercise(data, exerciseName, weeks, today)
}

export interface HistorySet {
  exercise: string
  set_index: number
  reps: number
  weight: number
}

export interface HistoryWorkout {
  id: number
  performed_at: string
  notes: string | null
  sets: HistorySet[]
}

interface HistoryOptions {
  date_from?: string
  date_to?: string
  exercise_name?: string | null
  limit?: number
}

export function getHistory(data: StoreData, options: HistoryOptions = {}): HistoryWorkout[] {
  const exercises = new Map(data.exercises.map((exercise) => [exercise.id, exercise]))
  const setsByWorkout = new Map<number, typeof data.sets>()
  for (const set of data.sets) {
    const group = setsByWorkout.get(set.workout_id) ?? []
    group.push(set)
    setsByWorkout.set(set.workout_id, group)
  }

  let exerciseFilter = null as number | null
  if (options.exercise_name) {
    exerciseFilter = findExercise(data, options.exercise_name)?.id ?? null
    if (exerciseFilter === null) return []
  }

  const sorted = [...data.workouts].sort((a, b) => {
    const byDate = b.performed_at.localeCompare(a.performed_at)
    return byDate !== 0 ? byDate : b.id - a.id
  })

  const results: HistoryWorkout[] = []
  for (const workout of sorted) {
    if (options.date_from && workout.performed_at < options.date_from) continue
    if (options.date_to && workout.performed_at > options.date_to) continue

    const sets = [...(setsByWorkout.get(workout.id) ?? [])]
      .sort((a, b) => a.id - b.id)
      .filter((set) => exerciseFilter === null || set.exercise_id === exerciseFilter)
      .map((set) => ({
        exercise: exercises.get(set.exercise_id)?.name ?? '',
        set_index: set.set_index,
        reps: set.reps,
        weight: set.weight,
      }))

    if (exerciseFilter !== null && sets.length === 0) continue

    results.push({
      id: workout.id,
      performed_at: workout.performed_at,
      notes: workout.notes,
      sets,
    })

    if (results.length >= (options.limit ?? 100)) break
  }

  return results
}
