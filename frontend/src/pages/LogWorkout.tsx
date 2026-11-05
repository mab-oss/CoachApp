import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Exercise } from '../types'
import { todayISO } from '../utils'

interface Row {
  id: number
  exercise: string
  reps: string
  weight: string
}

export default function LogWorkout() {
  const navigate = useNavigate()
  const nextId = useRef(3)
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([
    { id: 0, exercise: '', reps: '8', weight: '' },
    { id: 1, exercise: '', reps: '8', weight: '' },
    { id: 2, exercise: '', reps: '8', weight: '' },
  ])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .listExercises()
      .then(setExercises)
      .catch(() => setExercises([]))
  }, [])

  function updateRow(id: number, field: 'exercise' | 'reps' | 'weight', value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: nextId.current++, exercise: '', reps: '8', weight: '' },
    ])
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current))
  }

  function targetFor(name: string): number | null {
    const match = exercises.find(
      (exercise) => exercise.name.toLowerCase() === name.trim().toLowerCase(),
    )
    return match?.target_weight ?? null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const sets = rows.map((row) => ({
      exercise: row.exercise.trim(),
      reps: Number(row.reps),
      weight: Number(row.weight),
    }))

    if (sets.some((set) => !set.exercise)) {
      setError('Add an exercise name for every set.')
      return
    }
    if (sets.some((set) => !Number.isFinite(set.reps) || set.reps <= 0)) {
      setError('Reps must be a positive number.')
      return
    }
    if (sets.some((set) => !Number.isFinite(set.weight) || set.weight < 0)) {
      setError('Weight must be zero or more.')
      return
    }

    setBusy(true)
    try {
      await api.createWorkout({
        performed_at: date,
        notes: notes.trim() || null,
        sets,
      })
      navigate('/history')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the workout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">New session</p>
          <h1>Log workout</h1>
          <p className="muted">Add one row per set. Exercises are created automatically.</p>
        </div>
      </header>

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field">
            <span className="label">Date</span>
            <input
              className="input"
              type="date"
              required
              value={date}
              max={todayISO()}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="field grow">
            <span className="label">Notes (optional)</span>
            <input
              className="input"
              type="text"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How did the session feel?"
            />
          </label>
        </div>

        <datalist id="exercise-options">
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.name} />
          ))}
        </datalist>

        <div className="sets-editor">
          <div className="set-editor-head">
            <span>Exercise</span>
            <span>Reps</span>
            <span>Weight (kg)</span>
            <span />
          </div>

          {rows.map((row, index) => {
            const target = targetFor(row.exercise)
            return (
              <div className="set-editor-row" key={row.id}>
                <div className="set-field">
                  <input
                    className="input"
                    type="text"
                    list="exercise-options"
                    required
                    placeholder={`Exercise ${index + 1}`}
                    value={row.exercise}
                    onChange={(event) => updateRow(row.id, 'exercise', event.target.value)}
                  />
                  {target != null && (
                    <span className="input-hint">Coach target: {target} kg</span>
                  )}
                </div>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={row.reps}
                  onChange={(event) => updateRow(row.id, 'reps', event.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.5"
                  required
                  value={row.weight}
                  onChange={(event) => updateRow(row.id, 'weight', event.target.value)}
                  placeholder="0"
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  aria-label="Remove set"
                  title="Remove set"
                >
                  x
                </button>
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn-ghost" onClick={addRow}>
          + Add set
        </button>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save workout'}
          </button>
        </div>
      </form>
    </div>
  )
}
