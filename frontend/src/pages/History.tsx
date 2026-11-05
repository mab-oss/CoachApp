import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Exercise, Workout } from '../types'
import { formatDate, formatNumber, workoutVolume } from '../utils'

export default function History() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    api
      .listExercises()
      .then(setExercises)
      .catch(() => setExercises([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listWorkouts({ exercise: filter || undefined, limit: 100 })
      .then((data) => {
        if (!cancelled) setWorkouts(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return
    setDeleting(id)
    try {
      await api.deleteWorkout(id)
      setWorkouts((current) => current.filter((workout) => workout.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the workout.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Training log</p>
          <h1>History</h1>
          <p className="muted">Every session you have logged, newest first.</p>
        </div>
        <div className="head-actions">
          <select
            className="input select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter by exercise"
          >
            <option value="">All exercises</option>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.name}>
                {exercise.name}
              </option>
            ))}
          </select>
          <Link className="btn btn-primary" to="/log">
            Log workout
          </Link>
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
          <span>Loading workouts...</span>
        </div>
      ) : workouts.length === 0 ? (
        <div className="empty-state">
          <h2>No workouts found</h2>
          <p>
            {filter
              ? `Nothing logged for ${filter} yet.`
              : 'Your training history will appear here after your first session.'}
          </p>
          <Link className="btn btn-primary" to="/log">
            Log a workout
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {workouts.map((workout) => {
            const grouped = workout.sets.reduce<Record<string, typeof workout.sets>>(
              (groups, set) => {
                groups[set.exercise] = [...(groups[set.exercise] ?? []), set]
                return groups
              },
              {},
            )
            return (
              <article className="card workout-card" key={workout.id}>
                <div className="workout-head">
                  <div>
                    <h3>{formatDate(workout.performed_at)}</h3>
                    <p className="muted small">
                      {workout.sets.length} sets - {formatNumber(workoutVolume(workout.sets))} kg total
                      volume
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deleting === workout.id}
                    onClick={() => handleDelete(workout.id)}
                  >
                    {deleting === workout.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                <div className="set-groups">
                  {Object.entries(grouped).map(([exercise, sets]) => (
                    <div className="set-group" key={exercise}>
                      <span className="set-group-name">{exercise}</span>
                      <div className="set-chips">
                        {sets.map((set) => (
                          <span className="set-chip" key={set.id}>
                            {set.reps} x {formatNumber(set.weight, 1)} kg
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {workout.notes && <p className="workout-notes">{workout.notes}</p>}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
