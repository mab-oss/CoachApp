import type {
  ChatMessage,
  ChatResponse,
  Exercise,
  ExerciseProgress,
  ProgressSummary,
  Suggestion,
  TokenResponse,
  User,
  Workout,
  WorkoutPayload,
} from './types'

export const TOKEN_KEY = 'coachapp_token'
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? (item as { msg?: unknown }).msg : null))
      .filter((msg): msg is string => typeof msg === 'string')
    if (messages.length) return messages.join(', ')
  }
  return null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      message = errorDetail(await response.json()) ?? message
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  register: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  demoLogin: () => request<TokenResponse>('/api/auth/demo', { method: 'POST' }),

  me: () => request<User>('/api/auth/me'),

  listExercises: () => request<Exercise[]>('/api/exercises'),

  listWorkouts: (params: { exercise?: string; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.exercise) query.set('exercise', params.exercise)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<Workout[]>(`/api/workouts${suffix}`)
  },

  createWorkout: (payload: WorkoutPayload) =>
    request<Workout>('/api/workouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteWorkout: (id: number) =>
    request<void>(`/api/workouts/${id}`, { method: 'DELETE' }),

  progressSummary: (weeks = 8) =>
    request<ProgressSummary>(`/api/progress/summary?weeks=${weeks}`),

  exerciseProgress: (exercise: string, weeks = 8) =>
    request<ExerciseProgress>(
      `/api/progress?exercise=${encodeURIComponent(exercise)}&weeks=${weeks}`,
    ),

  chat: (message: string) =>
    request<ChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  listMessages: () => request<ChatMessage[]>('/api/agent/messages'),

  listSuggestions: (status?: string) =>
    request<Suggestion[]>(`/api/suggestions${status ? `?status=${status}` : ''}`),

  acceptSuggestion: (id: number) =>
    request<Suggestion>(`/api/suggestions/${id}/accept`, { method: 'POST' }),

  rejectSuggestion: (id: number) =>
    request<Suggestion>(`/api/suggestions/${id}/reject`, { method: 'POST' }),
}
