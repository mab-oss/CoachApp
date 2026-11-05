import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AgentChat from './pages/AgentChat'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import LogWorkout from './pages/LogWorkout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="log" element={<LogWorkout />} />
        <Route path="history" element={<History />} />
        <Route path="coach" element={<AgentChat />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
