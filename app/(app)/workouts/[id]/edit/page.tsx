"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadWorkouts, updateWorkout } from "@/lib/store";
import { exerciseNames } from "@/lib/progress";
import type { Workout } from "@/lib/types";
import { WorkoutForm } from "@/components/workout-form";
import { EmptyState, PageHeader, Spinner, buttonClasses } from "@/components/ui";
import { Dumbbell } from "lucide-react";

export default function EditWorkoutPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  useEffect(() => {
    if (user) setWorkouts(loadWorkouts(user.id));
  }, [user]);

  if (!user || !workouts) {
    return <Spinner label="Loading workout…" />;
  }

  const workout = workouts.find((item) => item.id === params.id);

  if (!workout) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Workout not found"
        description="It may have been deleted from this browser."
        action={
          <Link href="/workouts" className={buttonClasses("primary", "md")}>
            Back to workouts
          </Link>
        }
      />
    );
  }

  const handleSubmit = (updated: Workout) => {
    updateWorkout(user.id, updated);
    router.push(`/workouts/${updated.id}`);
  };

  return (
    <div>
      <Link
        href={`/workouts/${workout.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to workout
      </Link>
      <PageHeader
        title="Edit workout"
        description="Changes update your progress charts and coach analysis immediately."
      />
      <WorkoutForm
        initial={workout}
        knownExercises={exerciseNames(workouts)}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/workouts/${workout.id}`)}
      />
    </div>
  );
}
