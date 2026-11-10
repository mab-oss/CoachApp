"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { addWorkout, loadWorkouts } from "@/lib/store";
import { exerciseNames } from "@/lib/progress";
import type { Workout } from "@/lib/types";
import { WorkoutForm } from "@/components/workout-form";
import { PageHeader, Spinner } from "@/components/ui";

export default function NewWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [known, setKnown] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    setKnown(exerciseNames(loadWorkouts(user.id)));
    setLoaded(true);
  }, [user]);

  if (!user || !loaded) {
    return <Spinner label="Preparing the log form…" />;
  }

  const handleSubmit = (workout: Workout) => {
    addWorkout(user.id, workout);
    router.push(`/workouts/${workout.id}`);
  };

  return (
    <div>
      <Link
        href="/workouts"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to workouts
      </Link>
      <PageHeader
        title="Log a workout"
        description="Add each exercise once with its sets, reps, and working weight."
      />
      <WorkoutForm
        knownExercises={known}
        submitLabel="Save workout"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/workouts")}
      />
    </div>
  );
}
