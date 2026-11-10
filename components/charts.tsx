"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyVolume } from "@/lib/types";
import { formatNumber } from "@/lib/format";

const tooltipStyle = {
  background: "#0d141c",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e5e7eb",
  padding: "8px 12px",
};

const tickStyle = { fill: "#71717a", fontSize: 11 };

export function VolumeChart({
  data,
  metric = "volume",
}: {
  data: WeeklyVolume[];
  metric?: "volume" | "sessions";
}) {
  const isSessions = metric === "sessions";

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={tickStyle}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={tickStyle}
            width={44}
            tickFormatter={(value: number) =>
              isSessions ? String(value) : formatNumber(value)
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value) => [
              isSessions
                ? `${value} sessions`
                : `${formatNumber(Number(value))} kg`,
              isSessions ? "Sessions" : "Volume",
            ]}
          />
          <Bar
            dataKey={isSessions ? "sessions" : "volume"}
            fill="url(#volumeFill)"
            radius={[6, 6, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExerciseTrendChart({
  points,
}: {
  points: { date: string; e1rm: number; weight: number }[];
}) {
  const data = points.map((point) => ({
    ...point,
    label: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={tickStyle}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={tickStyle}
            width={44}
            domain={["dataMin - 5", "dataMax + 5"]}
            tickFormatter={(value: number) => `${Math.round(value)}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value, name) => [
              `${Number(value).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })} kg`,
              name === "e1rm" ? "Est. 1RM" : "Top set",
            ]}
          />
          <Area
            type="monotone"
            dataKey="e1rm"
            stroke="#34d399"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            dot={{ r: 3, fill: "#0b0f14", stroke: "#34d399", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#052e22" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
