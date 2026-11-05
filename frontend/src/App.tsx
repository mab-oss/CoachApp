import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './components/Layout'
import AgentChat from './pages/AgentChat'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import LogWorkout from './pages/LogWorkout'
import Login from './pages/Login'
import Register from './pages/Register'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Loading CoachApp...</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="log" element={<LogWorkout />} />
        <Route path="history" element={<History />} />
        <Route path="coach" element={<AgentChat />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
