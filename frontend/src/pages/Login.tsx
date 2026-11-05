import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const { user, login, demoLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDemo() {
    setBusy(true)
    setError('')
    try {
      await demoLogin()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your training history and ask the coach what to do next."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <div className="form">
        <button
          className="btn btn-primary btn-block"
          type="button"
          onClick={handleDemo}
          disabled={busy}
        >
          {busy ? 'Starting demo...' : 'Try the demo'}
        </button>
        <p className="muted small center">
          No account needed - each demo starts with eight weeks of sample training.
        </p>
      </div>

      <p className="muted small center">or log in with email</p>

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}
