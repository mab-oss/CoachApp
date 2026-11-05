import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import ProgressChart from '../components/ProgressChart'
import type { ProgressSummary, Workout } from '../types'
import { formatDate, formatNumber, workoutVolume } from '../utils'

function trendClass(trend: string): string {
  if (trend === 'improving') return 'trend-up'
  if (trend === 'declining') return 'trend-down'
  return 'trend-flat'
}

export default function Dashboard() {
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.progressSummary(8), api.listWorkouts({ limit: 100 })])
      .then(([summaryData, workoutData]) => {
        if (cancelled) return
        setSummary(summaryData)
        setWorkouts(workoutData)
        setSelected(summaryData.exercises[0]?.exercise ?? '')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const exercises = useMemo(() => summary?.exercises ?? [], [summary])
  const selectedProgress = exercises.find((item) => item.exercise === selected) ?? exercises[0]

  const stats = useMemo(() => {
    const bestE1rm = exercises.reduce((max, item) => Math.max(max, item.best_e1rm), 0)
    const improving = exercises.filter((item) => item.trend === 'improving').length
    const plateaued = exercises.filter((item) => item.plateau).length
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const thisMonth = workouts.filter(
      (workout) => new Date(`${workout.performed_at}T00:00:00`) >= monthStart,
    ).length
    return { bestE1rm, improving, plateaued, thisMonth }
  }, [exercises, workouts])

  async function handleLoadSample() {
    setSeeding(true)
    setError('')
    try {
      await api.loadSampleData()
      const [summaryData, workoutData] = await Promise.all([
        api.progressSummary(8),
        api.listWorkouts({ limit: 100 }),
      ])
      setSummary(summaryData)
      setWorkouts(workoutData)
      setSelected(summaryData.exercises[0]?.exercise ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the sample data.')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Loading your training data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <h2>Could not load the dashboard</h2>
        <p>{error}</p>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Training overview</p>
          <h1>Your progress</h1>
          <p className="muted">
            Last 8 weeks. Volume is reps x weight; e1RM is an estimated one-rep max.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" to="/coach">
            Ask the coach
          </Link>
          <Link className="btn btn-primary" to="/log">
            Log workout
          </Link>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Exercises tracked</span>
          <span className="stat-value">{exercises.length}</span>
          <span className="stat-hint">{stats.improving} improving</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Best estimated 1RM</span>
          <span className="stat-value">{formatNumber(stats.bestE1rm, 1)} kg</span>
          <span className="stat-hint">Across all exercises</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sessions this month</span>
          <span className="stat-value">{stats.thisMonth}</span>
          <span className="stat-hint">{workouts.length} in the last 100 logged</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Plateaus</span>
          <span className="stat-value">{stats.plateaued}</span>
          <span className="stat-hint">{stats.plateaued ? 'Coach can suggest a deload' : 'No stalls detected'}</span>
        </div>
      </section>

      {exercises.length === 0 ? (
        <div className="empty-state">
          <h2>No workouts yet</h2>
          <p>
            Log your first session, or load eight weeks of sample training to explore the
            dashboard and coach. All data stays in this browser.
          </p>
          <div className="head-actions">
            <Link className="btn btn-primary" to="/log">
              Log your first workout
            </Link>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleLoadSample}
              disabled={seeding}
            >
              {seeding ? 'Loading sample data...' : 'Load sample data'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="card chart-card">
            <div className="card-head">
              <div>
                <h2>Weekly volume and strength</h2>
                <p className="muted small">Bars show volume; the line shows best estimated 1RM.</p>
              </div>
              <select
                className="input select"
                value={selectedProgress?.exercise ?? ''}
                onChange={(event) => setSelected(event.target.value)}
                aria-label="Select exercise"
              >
                {exercises.map((item) => (
                  <option key={item.exercise} value={item.exercise}>
                    {item.exercise}
                  </option>
                ))}
              </select>
            </div>

            {selectedProgress && (
              <>
                <div className="chart-meta">
                  <span className={`badge ${trendClass(selectedProgress.trend)}`}>
                    {selectedProgress.trend}
                  </span>
                  <span className="muted small">
                    {selectedProgress.change_pct > 0 ? '+' : ''}
                    {selectedProgress.change_pct}% change over {selectedProgress.weeks_tracked} weeks
                  </span>
                  <span className="muted small">
                    PR {formatNumber(selectedProgress.best_weight, 1)} kg
                  </span>
                  {selectedProgress.target_weight != null && (
                    <span className="muted small">
                      Target {formatNumber(selectedProgress.target_weight, 1)} kg
                    </span>
                  )}
                </div>
                <ProgressChart points={selectedProgress.weekly} />
              </>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Exercises</h2>
              <span className="muted small">Click a card to chart it above</span>
            </div>
            <div className="exercise-grid">
              {exercises.map((item) => (
                <button
                  key={item.exercise}
                  type="button"
                  className={`exercise-card${item.exercise === selectedProgress?.exercise ? ' selected' : ''}`}
                  onClick={() => setSelected(item.exercise)}
                >
                  <div className="exercise-top">
                    <h3>{item.exercise}</h3>
                    <span className={`badge ${trendClass(item.trend)}`}>{item.trend}</span>
                  </div>
                  <div className="exercise-stats">
                    <div>
                      <span className="mini-label">e1RM</span>
                      <strong>{formatNumber(item.best_e1rm, 1)} kg</strong>
                    </div>
                    <div>
                      <span className="mini-label">PR</span>
                      <strong>{formatNumber(item.best_weight, 1)} kg</strong>
                    </div>
                    <div>
                      <span className="mini-label">Change</span>
                      <strong>
                        {item.change_pct > 0 ? '+' : ''}
                        {item.change_pct}%
                      </strong>
                    </div>
                  </div>
                  {item.plateau && (
                    <p className="plateau-note">No improvement for 3 weeks - consider a lighter week.</p>
                  )}
                  {item.target_weight != null && (
                    <p className="muted small">Next target: {formatNumber(item.target_weight, 1)} kg</p>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Recent workouts</h2>
              <Link className="link" to="/history">
                View full history
              </Link>
            </div>
            <div className="table-wrap card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exercises</th>
                    <th>Sets</th>
                    <th>Volume</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {workouts.slice(0, 6).map((workout) => {
                    const names = [...new Set(workout.sets.map((set) => set.exercise))]
                    return (
                      <tr key={workout.id}>
                        <td>{formatDate(workout.performed_at)}</td>
                        <td>{names.join(', ')}</td>
                        <td>{workout.sets.length}</td>
                        <td>{formatNumber(workoutVolume(workout.sets))} kg</td>
                        <td className="muted">{workout.notes ?? '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
