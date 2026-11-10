import { isoWeekStart, toISODate } from "./format";
import { uid } from "./store";
import type { Workout, WorkoutSet } from "./types";

type SetSpec = {
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  rpe?: number;
};

function makeSets(specs: SetSpec[]): WorkoutSet[] {
  const sets: WorkoutSet[] = [];
  for (const spec of specs) {
    for (let index = 0; index < spec.sets; index += 1) {
      sets.push({
        id: uid(),
        exercise: spec.exercise,
        reps: spec.reps,
        weight: spec.weight,
        ...(spec.rpe ? { rpe: spec.rpe } : {}),
      });
    }
  }
  return sets;
}

export function buildSampleWorkouts(): Workout[] {
  const workouts: Workout[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = isoWeekStart(today);

  const benchByWeek = [72.5, 75, 77.5, 80, 80, 80];

  for (let week = 5; week >= 0; week -= 1) {
    const index = 5 - week;
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() - week * 7);

    const squat = 90 + index * 2.5;
    const bench = benchByWeek[index];
    const deadlift = 120 + index * 5;
    const press = 45 + index * 1.25;
    const row = 60 + index * 1.25;

    const sessions: { day: number; specs: SetSpec[]; notes?: string }[] = [
      {
        day: 0,
        specs: [
          { exercise: "Back Squat", sets: 3, reps: 5, weight: squat },
          { exercise: "Bench Press", sets: 3, reps: 5, weight: bench },
          { exercise: "Barbell Row", sets: 3, reps: 8, weight: row },
        ],
      },
      {
        day: 2,
        specs: [
          { exercise: "Deadlift", sets: 1, reps: 5, weight: deadlift },
          { exercise: "Overhead Press", sets: 3, reps: 5, weight: press },
          { exercise: "Barbell Row", sets: 3, reps: 8, weight: row },
        ],
      },
      {
        day: 4,
        specs: [
          { exercise: "Back Squat", sets: 3, reps: 5, weight: squat },
          { exercise: "Bench Press", sets: 3, reps: 5, weight: bench },
          { exercise: "Deadlift", sets: 1, reps: 5, weight: deadlift },
        ],
        notes: index === 5 ? "Felt strong today. Bench still stuck at 80 kg." : undefined,
      },
    ];

    for (const session of sessions) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + session.day);
      if (date > today) continue;

      workouts.push({
        id: uid(),
        date: toISODate(date),
        ...(session.notes ? { notes: session.notes } : {}),
        sets: makeSets(session.specs),
        createdAt: date.toISOString(),
      });
    }
  }

  return workouts;
}
