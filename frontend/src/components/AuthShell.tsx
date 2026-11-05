import type { ReactNode } from 'react'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand brand-large">
          <span className="brand-mark">CA</span>
          <span>
            Coach<span className="brand-accent">App</span>
          </span>
        </div>
        <h1>Track the work. Understand the trend.</h1>
        <p className="auth-hero-text">
          Log workouts, watch your weekly volume and estimated 1RM, and ask the built-in AI coach
          what to change next. Every suggestion is a proposal - you stay in control.
        </p>
        <ul className="auth-features">
          <li>
            <span className="feature-dot" />
            Workout logging with sets, reps and weight
          </li>
          <li>
            <span className="feature-dot" />
            Weekly volume and strength progress charts
          </li>
          <li>
            <span className="feature-dot" />
            Agent tools: history, progress and adjustment proposals
          </li>
        </ul>
      </section>

      <section className="auth-panel">
        <div className="card auth-card">
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
    </div>
  )
}
