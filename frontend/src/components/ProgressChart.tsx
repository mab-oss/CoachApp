import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeeklyPoint } from '../types'
import { formatShortDate } from '../utils'

export default function ProgressChart({ points }: { points: WeeklyPoint[] }) {
  if (points.length === 0) {
    return <div className="empty-state compact">No weekly data in this window yet.</div>
  }

  const data = points.map((point) => ({
    ...point,
    label: formatShortDate(point.week_start),
  }))

  return (
    <ResponsiveContainer width="100%" height={310}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#223044" vertical={false} />
        <XAxis dataKey="label" stroke="#8b9bb0" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          yAxisId="volume"
          stroke="#8b9bb0"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
        />
        <YAxis
          yAxisId="e1rm"
          orientation="right"
          stroke="#8b9bb0"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: '#111821',
            border: '1px solid #243244',
            borderRadius: 10,
            color: '#e6edf5',
          }}
          labelStyle={{ color: '#8b9bb0' }}
        />
        <Bar
          yAxisId="volume"
          dataKey="volume"
          name="Weekly volume (kg)"
          fill="#ff7a1a"
          radius={[6, 6, 0, 0]}
          opacity={0.85}
        />
        <Line
          yAxisId="e1rm"
          type="monotone"
          dataKey="best_e1rm"
          name="Best e1RM (kg)"
          stroke="#3ddc97"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#3ddc97' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
