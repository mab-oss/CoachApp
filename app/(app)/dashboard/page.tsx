"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Flame,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadWorkouts, saveWorkouts } from "@/lib/store";
import { buildSummary, exerciseNames } from "@/lib/progress";
import { buildSampleWorkouts } from "@/lib/seed";
import { formatNumber, formatRelativeDay, formatWeight, pluralize } from "@/lib/format";
import type { Workout } from "@/lib/types";
import { ExerciseTrendChart, VolumeChart } from "@/components/charts";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  cn,
} from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (user) setWorkouts(loadWorkouts(user.id));
  }, [user]);

  const summary = useMemo(
    () => (workouts ? buildSummary(workouts) : null),
    [workouts]
  );
  const names = useMemo(
    () => (workouts ? exerciseNames(workouts) : []),
    [workouts]
  );

  const activeName = names.includes(selected) ? selected : names[0] ?? "";
  const activeStat = summary?.exercises.find(
    (stat) => stat.exercise === activeName
  );

  if (!user || !workouts || !summary) {
    return <Spinner label="Loading your training log…" />;
  }

  const firstName = user.name.split(" ")[0];

  const seed = () => {
    if (
      workouts.length > 0 &&
      !window.confirm(
        "This adds 6 weeks of sample workouts to your current log. Continue?"
      )
    ) {
      return;
    }
    const seeded = [...buildSampleWorkouts(), ...workouts];
    saveWorkouts(user.id, seeded);
    setWorkouts(loadWorkouts(user.id));
  };

  const volumeDelta =
    summary.lastWeekVolume > 0
      ? Math.round(
          ((summary.thisWeekVolume - summary.lastWeekVolume) /
            summary.lastWeekVolume) *
            100
        )
      : null;

  if (workouts.length === 0) {
    return (
      <div>
        <PageHeader
          title={`Welcome, ${firstName}`}
          description="Log a session to unlock progress tracking and your AI coach."
        />
        <EmptyState
          icon={ClipboardList}
          title="Your log is empty"
          description="Start with today's workout, or load six weeks of sample data to see how progress tracking and the AI coach work."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/workouts/new"
                className={buttonClasses("primary", "md")}
              >
                Log your first workout
              </Link>
              <Button variant="secondary" onClick={seed}>
                Load sample data
              </Button>
            </div>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: "Track every set",
              body: "Exercise, sets, reps, and weight — logged in seconds.",
            },
            {
              icon: TrendingUp,
              title: "See real trends",
              body: "Weekly volume, estimated 1RM, PRs, and plateau alerts.",
            },
            {
              icon: Sparkles,
              title: "Ask your coach",
              body: "Get plain-English answers and adjustments you approve.",
            },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <item.icon className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {item.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here is where your training stands right now."
        actions={
          <Link href="/workouts/new" className={buttonClasses("primary", "md")}>
            Log workout
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Sessions this week"
          value={String(summary.thisWeekSessions)}
          hint={
            summary.lastWeekSessions > 0
              ? `Last week: ${summary.lastWeekSessions}`
              : "First sessions of the week"
          }
          tone="blue"
        />
        <StatCard
          icon={Flame}
          label="Weekly volume"
          value={`${formatNumber(summary.thisWeekVolume)} kg`}
          hint={
            volumeDelta === null
              ? "No volume last week to compare"
              : `${volumeDelta >= 0 ? "+" : ""}${volumeDelta}% vs last week`
          }
          tone="green"
        />
        <StatCard
          icon={Trophy}
          label="Personal records"
          value={String(summary.prs.length)}
          hint={`Across ${pluralize(summary.prs.length, "lift")}`}
          tone="amber"
        />
        <StatCard
          icon={Lightbulb}
          label="Plateau alerts"
          value={String(summary.plateaus.length)}
          hint={
            summary.plateaus.length > 0
              ? summary.plateaus.slice(0, 2).join(", ")
              : "No plateaus detected"
          }
          tone={summary.plateaus.length > 0 ? "amber" : "green"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Weekly volume</h2>
              <p className="text-xs text-zinc-500">Last 8 weeks · kg lifted</p>
            </div>
            <Badge tone="green">
              {formatNumber(summary.totalVolume)} kg all time
            </Badge>
          </div>
          <VolumeChart data={summary.weeklyVolume} />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Strength trend
              </h2>
              <p className="text-xs text-zinc-500">
                Estimated 1RM per session
              </p>
            </div>
            {activeStat ? (
              <Badge tone={activeStat.plateau ? "amber" : "green"}>
                {activeStat.plateau ? "Plateau" : `${activeStat.trendPct >= 0 ? "+" : ""}${activeStat.trendPct}%`}
              </Badge>
            ) : null}
          </div>

          <select
            value={activeName}
            onChange={(event) => setSelected(event.target.value)}
            className="mb-2 w-full rounded-xl border border-white/10 bg-[#0b1118] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/40 focus:outline-none"
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {activeStat ? (
            <ExerciseTrendChart points={activeStat.points} />
          ) : (
            <p className="py-12 text-center text-sm text-zinc-500">
              No data for this lift yet.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent workouts</h2>
            <Link
              href="/workouts"
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {workouts.slice(0, 5).map((workout) => {
              const exercises = Array.from(
                new Set(workout.sets.map((set) => set.exercise))
              );
              const volume = workout.sets.reduce(
                (sum, set) => sum + set.weight * set.reps,
                0
              );
              return (
                <li key={workout.id}>
                  <Link
                    href={`/workouts/${workout.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        {formatRelativeDay(workout.date)}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {exercises.slice(0, 3).join(" · ")}
                        {exercises.length > 3
                          ? ` · +${exercises.length - 3} more`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-200">
                        {formatNumber(volume)} kg
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {workout.sets.length} {pluralize(workout.sets.length, "set")}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl" />
            <span className="inline-flex rounded-xl bg-emerald-500/10 p-2 text-emerald-300 ring-1 ring-emerald-500/20">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-white">
              Ask CoachApp
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Your agent reads your history, calculates trends, and proposes
              adjustments you can accept or reject.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["How am I doing?", "Am I plateauing on bench?"].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/chat?q=${encodeURIComponent(prompt)}`}
                  className={cn(
                    "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:border-emerald-500/30 hover:text-emerald-300"
                  )}
                >
                  {prompt}
                </Link>
              ))}
            </div>
            <Link
              href="/chat"
              className={buttonClasses("primary", "sm") + " mt-4 w-full"}
            >
              Open coach <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Top personal records
              </h2>
              <Trophy className="h-4 w-4 text-amber-300" />
            </div>
            {summary.prs.length === 0 ? (
              <p className="text-xs text-zinc-500">No records yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {summary.prs.slice(0, 4).map((pr) => (
                  <li
                    key={pr.exercise}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-200">{pr.exercise}</p>
                      <p className="text-[11px] text-zinc-500">
                        {formatWeight(pr.weight)} × {pr.reps} · {formatRelativeDay(pr.date)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-emerald-300">
                      {pr.e1rm.toFixed(1)} kg
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
