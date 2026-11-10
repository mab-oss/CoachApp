"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Download,
  LogOut,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  clearWorkoutData,
  exportData,
  loadChat,
  loadSuggestions,
  loadWorkouts,
  saveWorkouts,
} from "@/lib/store";
import { buildSampleWorkouts } from "@/lib/seed";
import { pluralize } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Spinner,
} from "@/components/ui";

type Counts = {
  workouts: number;
  sets: number;
  suggestions: number;
  messages: number;
};

export default function SettingsPage() {
  const { user, updateProfile, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const workouts = loadWorkouts(user.id);
    setCounts({
      workouts: workouts.length,
      sets: workouts.reduce((sum, workout) => sum + workout.sets.length, 0),
      suggestions: loadSuggestions(user.id).length,
      messages: loadChat(user.id).length,
    });
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: { ai?: boolean; model?: string }) => {
        setAiReady(Boolean(data.ai));
        setModel(data.model ?? "");
      })
      .catch(() => setAiReady(false));
  }, [user]);

  if (!user || !counts) {
    return <Spinner label="Loading settings…" />;
  }

  const refreshCounts = () => {
    const workouts = loadWorkouts(user.id);
    setCounts({
      workouts: workouts.length,
      sets: workouts.reduce((sum, workout) => sum + workout.sets.length, 0),
      suggestions: loadSuggestions(user.id).length,
      messages: loadChat(user.id).length,
    });
  };

  const handleSaveName = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile({ name });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const payload = exportData(user.id);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coachapp-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleSeed = () => {
    if (
      !window.confirm(
        "Add 6 weeks of sample workouts to your log? This is useful for demos and can be cleared afterwards."
      )
    ) {
      return;
    }
    saveWorkouts(user.id, [...loadWorkouts(user.id), ...buildSampleWorkouts()]);
    refreshCounts();
  };

  const handleClearWorkouts = () => {
    if (
      !window.confirm(
        "Delete all workouts, suggestions, and chat history for this account? This cannot be undone."
      )
    ) {
      return;
    }
    clearWorkoutData(user.id);
    refreshCounts();
  };

  const handleDeleteAccount = () => {
    if (
      !window.confirm(
        "Delete this account and all of its local data? This cannot be undone."
      )
    ) {
      return;
    }
    deleteAccount();
    router.replace("/login");
  };

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Account, local data, and AI configuration."
      />

      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-white">Account</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="profile-name">Display name</Label>
              <form onSubmit={handleSaveName} className="flex gap-2">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                />
                <Button type="submit" variant="secondary" className="shrink-0">
                  <Save className="h-4 w-4" />
                  {saved ? "Saved" : "Save"}
                </Button>
              </form>
            </div>
            <div>
              <Label>Email</Label>
              <div className="flex h-11 items-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 text-sm text-zinc-400">
                {user.email}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <p className="text-xs text-zinc-500">
              Local account created{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              . Stored in this browser only.
            </p>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-white">Your data</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Workouts", value: counts.workouts },
              { label: "Sets", value: counts.sets },
              { label: "Suggestions", value: counts.suggestions },
              { label: "Messages", value: counts.messages },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
              >
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSeed}>
              <Sparkles className="h-3.5 w-3.5" />
              Add sample data
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearWorkouts}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear workout data
            </Button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            {counts.workouts} {pluralize(counts.workouts, "workout")} and{" "}
            {counts.sets} {pluralize(counts.sets, "set")} are stored in this
            browser&apos;s localStorage. Export a copy before clearing browser
            data.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold text-white">AI coach</h2>
            </div>
            {aiReady === null ? (
              <Badge>Checking…</Badge>
            ) : aiReady ? (
              <Badge tone="green">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge tone="amber">Rules fallback</Badge>
            )}
          </div>

          <p className="text-xs leading-relaxed text-zinc-400">
            {aiReady
              ? `CoachApp is using the OpenAI model ${model || "gpt-4o-mini"}. The agent can call get_history, get_progress, and suggest_adjustment.`
              : "No OPENAI_API_KEY is configured. The chat uses a deterministic rules coach that still calculates progress and proposes adjustments."}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ["get_history", "Reads past workouts by date or exercise."],
              ["get_progress", "Calculates volume, PRs, trends, plateaus."],
              ["suggest_adjustment", "Drafts a proposal for your approval."],
            ].map(([tool, description]) => (
              <div
                key={tool}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
              >
                <code className="text-[11px] font-medium text-emerald-300">
                  {tool}
                </code>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-rose-500/20 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-300" />
            <h2 className="text-sm font-semibold text-rose-200">Danger zone</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-relaxed text-zinc-500">
              Deleting your account removes the login and all workouts, chat,
              and suggestions stored in this browser.
            </p>
            <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
