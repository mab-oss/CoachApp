import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthShell from '../components/AuthShell'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await register(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start logging workouts and let the coach turn your history into a plan."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="field">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        <label className="field">
          <span className="label">Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat your password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
