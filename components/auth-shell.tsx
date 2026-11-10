import type { ReactNode } from "react";
import { CheckCircle2, LineChart, Sparkles } from "lucide-react";
import { Logo } from "./logo";

const features = [
  {
    icon: LineChart,
    title: "Log every set",
    body: "Reps, weight, and notes in a fast, clean form.",
  },
  {
    icon: Sparkles,
    title: "Ask your coach",
    body: "“How am I doing?” gets a real answer from your history.",
  },
  {
    icon: CheckCircle2,
    title: "Stay in control",
    body: "Adjustments are proposals. You accept or reject them.",
  },
];

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

        <Logo />

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            The workout tracker that
            <span className="text-emerald-400"> coaches you back.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            CoachApp reads your training history, shows where you are actually
            progressing, and suggests what to change next — instead of leaving
            you to guess from a chart.
          </p>

          <div className="mt-8 space-y-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-emerald-500/10 p-2 text-emerald-300 ring-1 ring-emerald-500/20">
                  <feature.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {feature.title}
                  </p>
                  <p className="text-xs text-zinc-500">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-300">
            “Your bench press has not improved for 3 weeks. Take a lighter week,
            then add 2.5 kg.”
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
            CoachApp · example agent reply
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-600">
            CoachApp is a demo app. Accounts and workout data are stored only in
            this browser, not on a server.
          </p>
        </div>
      </div>
    </div>
  );
}
