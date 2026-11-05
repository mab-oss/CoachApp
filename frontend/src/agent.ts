import { addDays, todayISO } from './dates'
import { getExerciseProgress, getHistory, getProgressSummary, roundToPlate } from './progress'
import { findExercise, nextId, nowISO, type StoreData } from './storage'
import type { Exercise, Suggestion, ToolCall } from './types'

const ADJUSTMENT_WORDS = [
  'should',
  'adjust',
  'next',
  'increase',
  'deload',
  'lighter',
  'change',
  'recommend',
  'suggest',
  'what do i do',
]

const ALIASES: Record<string, string> = {
  bench: 'bench',
  squat: 'squat',
  deadlift: 'deadlift',
  overhead: 'press',
  ohp: 'press',
  row: 'row',
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function g(value: number): string {
  return String(Number(value.toFixed(1)))
}

function proposedWeight(action: string, base: number): number {
  if (base <= 0) return 0
  if (action === 'increase') return roundToPlate(base + 2.5)
  if (action === 'deload') return roundToPlate(base * 0.9)
  return roundToPlate(base)
}

function mentionedExercise(data: StoreData, message: string): Exercise | null {
  const exercises = [...data.exercises].sort((a, b) => a.name.localeCompare(b.name))
  const lower = message.toLowerCase()
  const matches = exercises.filter((exercise) => lower.includes(exercise.name.toLowerCase()))
  if (matches.length > 0) {
    return matches.reduce((best, exercise) =>
      exercise.name.length > best.name.length ? exercise : best,
    )
  }
  if (exercises.length === 1) return exercises[0]

  for (const [token, alias] of Object.entries(ALIASES)) {
    if (!lower.includes(token)) continue
    const match = exercises.find((exercise) => exercise.name.toLowerCase().includes(alias))
    if (match) return match
  }
  return null
}

interface ExecutedTool {
  result: Record<string, unknown>
  suggestion: Suggestion | null
}

function executeTool(
  data: StoreData,
  name: string,
  args: Record<string, unknown>,
): ExecutedTool {
  if (name === 'get_history') {
    const today = todayISO()
    const workouts = getHistory(data, {
      date_from: asString(args.date_from) ?? addDays(today, -56),
      date_to: asString(args.date_to) ?? today,
      exercise_name: asString(args.exercise) ?? null,
    })
    return { result: { workout_count: workouts.length, workouts }, suggestion: null }
  }

  if (name === 'get_progress') {
    const weeks = Math.max(2, Math.min(52, Math.trunc(asNumber(args.weeks) ?? 8)))
    const exerciseName = asString(args.exercise)
    let exercises: unknown[]
    if (exerciseName) {
      const progress = getExerciseProgress(data, exerciseName, weeks)
      exercises = progress ? [progress] : []
    } else {
      exercises = getProgressSummary(data, weeks).exercises
    }
    return { result: { weeks, exercises }, suggestion: null }
  }

  if (name === 'suggest_adjustment') {
    const exercise = findExercise(data, asString(args.exercise) ?? '')
    if (!exercise) {
      return { result: { error: 'Exercise not found.' }, suggestion: null }
    }

    const action = asString(args.action) ?? 'maintain'
    const progress = getExerciseProgress(data, exercise.name, 8)
    const base = exercise.target_weight ?? progress?.best_weight ?? 0
    const proposed =
      asNumber(args.proposed_target_weight) ?? proposedWeight(action, base)

    const suggestion: Suggestion = {
      id: nextId(data),
      exercise_id: exercise.id,
      kind: action,
      message: (asString(args.change) ?? 'Adjust training.').slice(0, 500),
      payload: {
        exercise: exercise.name,
        action,
        reason: (asString(args.reason) ?? '').slice(0, 500),
        proposed_target_weight: round1(proposed),
      },
      status: 'pending',
      created_at: nowISO(),
      resolved_at: null,
    }
    data.suggestions.push(suggestion)

    return {
      result: {
        suggestion_id: suggestion.id,
        exercise: exercise.name,
        action,
        message: suggestion.message,
        proposed_target_weight: suggestion.payload.proposed_target_weight,
        status: 'pending',
        requires_user_approval: true,
      },
      suggestion,
    }
  }

  return { result: { error: `Unknown tool: ${name}` }, suggestion: null }
}

function compactResult(name: string, result: Record<string, unknown>): Record<string, unknown> {
  if (name === 'get_history') {
    return { workout_count: result.workout_count ?? 0 }
  }
  if (name === 'get_progress') {
    const exercises = Array.isArray(result.exercises) ? result.exercises : []
    return {
      weeks: result.weeks,
      exercises: exercises.map((item) => {
        const progress = item as Record<string, unknown>
        return {
          exercise: progress.exercise,
          best_e1rm: progress.best_e1rm,
          change_pct: progress.change_pct,
          trend: progress.trend,
          plateau: progress.plateau,
        }
      }),
    }
  }
  return result
}

function summaryLine(progress: {
  exercise: string
  best_e1rm: number
  change_pct: number
  weeks_tracked: number
  plateau: boolean
}): string {
  let line = `${progress.exercise}: best estimated 1RM ${g(progress.best_e1rm)} kg`
  if (progress.change_pct) {
    const direction = progress.change_pct > 0 ? 'up' : 'down'
    line += `, ${direction} ${g(Math.abs(progress.change_pct))}% over ${progress.weeks_tracked} weeks`
  } else {
    line += ` across ${progress.weeks_tracked} weeks`
  }
  if (progress.plateau) line += ' (no improvement for 3 weeks)'
  return line
}

function chooseSuggestion(progress: {
  exercise: string
  plateau: boolean
  change_pct: number
}): { action: string; change: string; reason: string } {
  const name = progress.exercise
  if (progress.plateau) {
    return {
      action: 'deload',
      change: `Take a lighter week for ${name}: reduce working weights by about 10%.`,
      reason: `${name} has not improved for 3 weeks, so a short deload should help recovery.`,
    }
  }
  if (progress.change_pct >= 2) {
    return {
      action: 'increase',
      change: `Add 2.5 kg to ${name} next session.`,
      reason: `${name} is improving steadily (${g(progress.change_pct)}% over the window).`,
    }
  }
  if (progress.change_pct <= -2) {
    return {
      action: 'reduce_volume',
      change: `Reduce ${name} volume by about 20% next session and keep the weight moderate.`,
      reason: `${name} is trending down (${g(progress.change_pct)}%), which suggests accumulated fatigue.`,
    }
  }
  return {
    action: 'maintain',
    change: `Keep the same weight on ${name} and add one rep per set.`,
    reason: `${name} is stable, so a small rep progression is a safer next step than more weight.`,
  }
}

export interface AgentRun {
  reply: string
  tool_calls: ToolCall[]
  suggestion: Suggestion | null
  mode: string
}

export function runDeterministic(data: StoreData, message: string): AgentRun {
  const toolCalls: ToolCall[] = []
  const lower = message.toLowerCase()
  const wantsAdjustment = ADJUSTMENT_WORDS.some((word) => lower.includes(word))
  const mentioned = mentionedExercise(data, message)

  const historyArgs: Record<string, unknown> = { weeks: 8 }
  const historyRun = executeTool(data, 'get_history', historyArgs)
  toolCalls.push({
    name: 'get_history',
    arguments: historyArgs,
    result: compactResult('get_history', historyRun.result),
  })

  const progressArgs: Record<string, unknown> = { weeks: 8 }
  if (mentioned) progressArgs.exercise = mentioned.name
  const progressRun = executeTool(data, 'get_progress', progressArgs)
  toolCalls.push({
    name: 'get_progress',
    arguments: progressArgs,
    result: compactResult('get_progress', progressRun.result),
  })

  const exercises = (
    Array.isArray(progressRun.result.exercises) ? progressRun.result.exercises : []
  ) as Array<{
    exercise: string
    plateau: boolean
    change_pct: number
    best_e1rm: number
    weeks_tracked: number
  }>

  if (exercises.length === 0) {
    return {
      reply:
        "I don't have any workouts logged yet. Add a few sessions and ask me again - " +
        'then I can show your progress and suggest a next step.',
      tool_calls: toolCalls,
      suggestion: null,
      mode: 'deterministic',
    }
  }

  const lines = exercises.slice(0, 5).map(summaryLine)
  if (exercises.length > 5) {
    lines.push(`...and ${exercises.length - 5} more exercises.`)
  }
  let reply = "Here's how you're doing:\n" + lines.join('\n')

  let target = exercises[0]
  if (mentioned) {
    target = exercises.find((progress) => progress.exercise === mentioned.name) ?? target
  } else if (!wantsAdjustment) {
    target = exercises.find((progress) => progress.plateau) ?? target
  } else if (exercises.some((progress) => progress.plateau)) {
    target = exercises.find((progress) => progress.plateau) ?? target
  }

  const { action, change, reason } = chooseSuggestion(target)
  const suggestionArgs: Record<string, unknown> = {
    exercise: target.exercise,
    action,
    change,
    reason,
  }
  const suggestionRun = executeTool(data, 'suggest_adjustment', suggestionArgs)
  toolCalls.push({
    name: 'suggest_adjustment',
    arguments: suggestionArgs,
    result: compactResult('suggest_adjustment', suggestionRun.result),
  })

  if (suggestionRun.suggestion) {
    reply += `\n\nMy suggestion: ${change} Do you want me to apply it?`
  }

  return {
    reply,
    tool_calls: toolCalls,
    suggestion: suggestionRun.suggestion,
    mode: 'deterministic',
  }
}
