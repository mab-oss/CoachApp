import { addDays, todayISO, weekStart } from './dates'
import type { ChatMessage, Exercise, Suggestion } from './types'

export interface StoredWorkout {
  id: number
  performed_at: string
  notes: string | null
  created_at: string
}

export interface StoredSet {
  id: number
  workout_id: number
  exercise_id: number
  set_index: number
  reps: number
  weight: number
}

export interface StoreData {
  version: 1
  exercises: Exercise[]
  workouts: StoredWorkout[]
  sets: StoredSet[]
  suggestions: Suggestion[]
  messages: ChatMessage[]
  nextId: number
}

const STORAGE_KEY = 'coachapp:data:v1'

let memory: StoreData | null = null

function emptyData(): StoreData {
  return {
    version: 1,
    exercises: [],
    workouts: [],
    sets: [],
    suggestions: [],
    messages: [],
    nextId: 1,
  }
}

function isStoreData(value: unknown): value is StoreData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<StoreData>
  return (
    data.version === 1 &&
    Array.isArray(data.exercises) &&
    Array.isArray(data.workouts) &&
    Array.isArray(data.sets) &&
    Array.isArray(data.suggestions) &&
    Array.isArray(data.messages) &&
    typeof data.nextId === 'number'
  )
}

function persist(data: StoreData): void {
  memory = data
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Keep the in-memory copy usable when storage is unavailable or full.
  }
}

export function getData(): StoreData {
  if (memory) return memory

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isStoreData(parsed)) {
        memory = parsed
        return parsed
      }
    }
  } catch {
    // Fall through to a fresh store.
  }

  const data = emptyData()
  persist(data)
  return data
}

export function saveData(data: StoreData): void {
  persist(data)
}

export function resetData(): void {
  persist(emptyData())
}

export function nextId(data: StoreData): number {
  return data.nextId++
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function normalizeName(name: string): string {
  return name.trim().split(/\s+/).join(' ')
}

export function findExercise(data: StoreData, name: string): Exercise | undefined {
  const target = normalizeName(name).toLowerCase()
  if (!target) return undefined
  return data.exercises.find((exercise) => exercise.name.toLowerCase() === target)
}

export function getOrCreateExercise(data: StoreData, name: string): Exercise {
  const cleaned = normalizeName(name)
  const existing = findExercise(data, cleaned)
  if (existing) return existing

  const exercise: Exercise = {
    id: nextId(data),
    name: cleaned,
    target_weight: null,
  }
  data.exercises.push(exercise)
  return exercise
}

const NOTES = [
  'Felt strong today.',
  'Good session, steady tempo.',
  'Slightly tired but form was clean.',
  'Focused on controlled reps.',
  null,
]

interface Session {
  dayOffset: number
  exercises: Record<string, Array<[number, number]>>
}

export function loadSampleData(): void {
  const data = emptyData()
  const today = todayISO()
  const currentMonday = weekStart(today)
  let notesIndex = 0

  for (let week = 0; week < 8; week += 1) {
    const monday = addDays(currentMonday, -7 * (7 - week))
    const bench = 70 + 2.5 * Math.floor(week / 2)
    const squat = 90 + 5 * Math.floor(week / 2)
    const deadlift = 110 + 5 * Math.floor(week / 2)
    const overhead = week < 3 ? 45 : 47.5

    const sessions: Session[] = [
      {
        dayOffset: 0,
        exercises: {
          'Bench Press': [
            [8, bench],
            [8, bench],
            [8, bench],
          ],
          'Overhead Press': [
            [8, overhead],
            [8, overhead],
            [8, overhead],
          ],
        },
      },
      {
        dayOffset: 2,
        exercises: {
          'Back Squat': [
            [5, squat],
            [5, squat],
            [5, squat],
          ],
        },
      },
      {
        dayOffset: 4,
        exercises: {
          Deadlift: [
            [5, deadlift],
            [5, deadlift],
            [5, deadlift],
          ],
          'Overhead Press': [
            [8, overhead],
            [8, overhead],
            [8, overhead],
          ],
        },
      },
    ]

    for (const session of sessions) {
      const performedAt = addDays(monday, session.dayOffset)
      if (performedAt > today) continue

      const workout: StoredWorkout = {
        id: nextId(data),
        performed_at: performedAt,
        notes: NOTES[notesIndex % NOTES.length],
        created_at: nowISO(),
      }
      data.workouts.push(workout)
      notesIndex += 1

      for (const [exerciseName, sets] of Object.entries(session.exercises)) {
        const exercise = getOrCreateExercise(data, exerciseName)
        sets.forEach(([reps, weight], index) => {
          data.sets.push({
            id: nextId(data),
            workout_id: workout.id,
            exercise_id: exercise.id,
            set_index: index + 1,
            reps,
            weight,
          })
        })
      }
    }
  }

  saveData(data)
}
