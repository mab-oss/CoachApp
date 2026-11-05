import { runDeterministic } from './agent'
import { getExerciseProgress, getProgressSummary } from './progress'
import {
  findExercise,
  getData,
  getOrCreateExercise,
  loadSampleData as seedSampleData,
  nextId,
  nowISO,
  resetData as clearAllData,
  saveData,
  type StoreData,
} from './storage'
import type {
  ChatMessage,
  ChatResponse,
  Exercise,
  ExerciseProgress,
  ProgressSummary,
  Suggestion,
  Workout,
  WorkoutPayload,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function serializeWorkout(data: StoreData, workoutId: number): Workout | null {
  const workout = data.workouts.find((item) => item.id === workoutId)
  if (!workout) return null

  const exercises = new Map(data.exercises.map((exercise) => [exercise.id, exercise]))
  const sets = data.sets
    .filter((set) => set.workout_id === workout.id)
    .sort((a, b) => a.id - b.id)
    .map((set) => ({
      id: set.id,
      exercise: exercises.get(set.exercise_id)?.name ?? '',
      set_index: set.set_index,
      reps: set.reps,
      weight: set.weight,
    }))

  return {
    id: workout.id,
    performed_at: workout.performed_at,
    notes: workout.notes,
    sets,
  }
}

function pendingSuggestion(data: StoreData, id: number): Suggestion {
  const suggestion = data.suggestions.find((item) => item.id === id)
  if (!suggestion) throw new ApiError('Suggestion not found.', 404)
  if (suggestion.status !== 'pending') {
    throw new ApiError('This suggestion was already resolved.', 409)
  }
  return suggestion
}

export const api = {
  listExercises: (): Promise<Exercise[]> => {
    const data = getData()
    return Promise.resolve(
      [...data.exercises]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((exercise) => ({ ...exercise })),
    )
  },

  listWorkouts: (params: { exercise?: string; limit?: number } = {}): Promise<Workout[]> => {
    const data = getData()
    let workouts = [...data.workouts]

    if (params.exercise) {
      const exercise = findExercise(data, params.exercise)
      if (!exercise) return Promise.resolve([])
      const workoutIds = new Set(
        data.sets
          .filter((set) => set.exercise_id === exercise.id)
          .map((set) => set.workout_id),
      )
      workouts = workouts.filter((workout) => workoutIds.has(workout.id))
    }

    workouts.sort((a, b) => {
      const byDate = b.performed_at.localeCompare(a.performed_at)
      return byDate !== 0 ? byDate : b.id - a.id
    })

    const limit = Math.max(1, Math.min(200, params.limit ?? 50))
    return Promise.resolve(
      workouts
        .slice(0, limit)
        .map((workout) => serializeWorkout(data, workout.id))
        .filter((workout): workout is Workout => workout !== null),
    )
  },

  createWorkout: (payload: WorkoutPayload): Promise<Workout> => {
    const data = getData()
    const workout = {
      id: nextId(data),
      performed_at: payload.performed_at,
      notes: payload.notes ?? null,
      created_at: nowISO(),
    }
    data.workouts.push(workout)

    const counters = new Map<number, number>()
    for (const item of payload.sets) {
      const exercise = getOrCreateExercise(data, item.exercise)
      const setIndex = (counters.get(exercise.id) ?? 0) + 1
      counters.set(exercise.id, setIndex)
      data.sets.push({
        id: nextId(data),
        workout_id: workout.id,
        exercise_id: exercise.id,
        set_index: setIndex,
        reps: item.reps,
        weight: item.weight,
      })
    }

    saveData(data)
    const created = serializeWorkout(data, workout.id)
    if (!created) throw new ApiError('Could not save the workout.', 500)
    return Promise.resolve(created)
  },

  deleteWorkout: (id: number): Promise<void> => {
    const data = getData()
    const index = data.workouts.findIndex((workout) => workout.id === id)
    if (index === -1) throw new ApiError('Workout not found.', 404)

    data.workouts.splice(index, 1)
    data.sets = data.sets.filter((set) => set.workout_id !== id)
    saveData(data)
    return Promise.resolve()
  },

  progressSummary: (weeks = 8): Promise<ProgressSummary> =>
    Promise.resolve(getProgressSummary(getData(), weeks)),

  exerciseProgress: (exercise: string, weeks = 8): Promise<ExerciseProgress> => {
    const progress = getExerciseProgress(getData(), exercise, weeks)
    if (!progress) throw new ApiError('Exercise not found.', 404)
    return Promise.resolve(progress)
  },

  chat: (message: string): Promise<ChatResponse> => {
    const data = getData()
    const run = runDeterministic(data, message)
    data.messages.push(
      {
        id: nextId(data),
        role: 'user',
        content: message,
        created_at: nowISO(),
      },
      {
        id: nextId(data),
        role: 'assistant',
        content: run.reply,
        created_at: nowISO(),
      },
    )
    saveData(data)

    return Promise.resolve({
      reply: run.reply,
      tool_calls: run.tool_calls,
      suggestion: run.suggestion,
      mode: run.mode,
    })
  },

  listMessages: (): Promise<ChatMessage[]> => {
    const data = getData()
    return Promise.resolve(
      data.messages.slice(-50).map((message) => ({ ...message })),
    )
  },

  listSuggestions: (status?: string): Promise<Suggestion[]> => {
    const data = getData()
    return Promise.resolve(
      data.suggestions
        .filter((suggestion) => !status || suggestion.status === status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 50)
        .map((suggestion) => ({ ...suggestion })),
    )
  },

  acceptSuggestion: (id: number): Promise<Suggestion> => {
    const data = getData()
    const suggestion = pendingSuggestion(data, id)
    if (suggestion.exercise_id !== null) {
      const exercise = data.exercises.find((item) => item.id === suggestion.exercise_id)
      const proposed = suggestion.payload.proposed_target_weight
      if (exercise && typeof proposed === 'number') {
        exercise.target_weight = proposed
      }
    }
    suggestion.status = 'accepted'
    suggestion.resolved_at = nowISO()
    saveData(data)
    return Promise.resolve({ ...suggestion })
  },

  rejectSuggestion: (id: number): Promise<Suggestion> => {
    const data = getData()
    const suggestion = pendingSuggestion(data, id)
    suggestion.status = 'rejected'
    suggestion.resolved_at = nowISO()
    saveData(data)
    return Promise.resolve({ ...suggestion })
  },

  loadSampleData: (): Promise<void> => {
    seedSampleData()
    return Promise.resolve()
  },

  resetData: (): Promise<void> => {
    clearAllData()
    return Promise.resolve()
  },
}
