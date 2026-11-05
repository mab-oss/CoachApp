export interface WorkoutSet {
  id: number
  exercise: string
  set_index: number
  reps: number
  weight: number
}

export interface Workout {
  id: number
  performed_at: string
  notes: string | null
  sets: WorkoutSet[]
}

export interface Exercise {
  id: number
  name: string
  target_weight: number | null
}

export interface WeeklyPoint {
  week_start: string
  volume: number
  best_e1rm: number
  best_weight: number
  total_sets: number
}

export interface ExerciseProgress {
  exercise: string
  target_weight: number | null
  weeks_tracked: number
  best_weight: number
  best_e1rm: number
  change_pct: number
  trend: 'improving' | 'declining' | 'flat'
  plateau: boolean
  last_week_volume: number
  weekly: WeeklyPoint[]
}

export interface ProgressSummary {
  exercises: ExerciseProgress[]
}

export interface Suggestion {
  id: number
  exercise_id: number | null
  kind: 'increase' | 'deload' | 'maintain' | 'reduce_volume' | string
  message: string
  payload: {
    exercise?: string
    action?: string
    reason?: string
    proposed_target_weight?: number
  }
  status: 'pending' | 'accepted' | 'rejected' | string
  created_at: string
  resolved_at: string | null
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
  result: Record<string, unknown>
}

export interface ChatResponse {
  reply: string
  tool_calls: ToolCall[]
  suggestion: Suggestion | null
  mode: string
}

export interface ChatMessage {
  id: number
  role: string
  content: string
  created_at: string
}

export interface WorkoutPayload {
  performed_at: string
  notes?: string | null
  sets: Array<{ exercise: string; reps: number; weight: number }>
}
