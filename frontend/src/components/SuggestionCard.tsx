import { useState } from 'react'
import { api } from '../api'
import type { Suggestion } from '../types'

const KIND_LABELS: Record<string, string> = {
  increase: 'Increase load',
  deload: 'Deload week',
  maintain: 'Maintain',
  reduce_volume: 'Reduce volume',
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onResolved?: (suggestion: Suggestion) => void
}

export default function SuggestionCard({ suggestion, onResolved }: SuggestionCardProps) {
  const [current, setCurrent] = useState(suggestion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pending = current.status === 'pending'
  const label = KIND_LABELS[current.kind] ?? current.kind
  const target = current.payload.proposed_target_weight

  async function resolve(action: 'accept' | 'reject') {
    setBusy(true)
    setError('')
    try {
      const updated =
        action === 'accept'
          ? await api.acceptSuggestion(current.id)
          : await api.rejectSuggestion(current.id)
      setCurrent(updated)
      onResolved?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the suggestion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`suggestion-card kind-${current.kind} status-${current.status}`}>
      <div className="suggestion-top">
        <span className={`badge kind-${current.kind}`}>{label}</span>
        <span className="muted small">Pending your approval</span>
      </div>

      <p className="suggestion-message">{current.message}</p>

      {current.payload.reason && <p className="muted small">{current.payload.reason}</p>}

      {typeof target === 'number' && target > 0 && (
        <div className="suggestion-target">
          Proposed working weight: <strong>{target} kg</strong>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {pending ? (
        <div className="suggestion-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => resolve('accept')}
          >
            {busy ? 'Saving...' : 'Accept'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => resolve('reject')}
          >
            Reject
          </button>
        </div>
      ) : (
        <div className={`badge status-badge status-${current.status}`}>
          {current.status === 'accepted' ? 'Applied to your plan' : 'Rejected'}
        </div>
      )}
    </div>
  )
}
