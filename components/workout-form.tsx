"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { todayISO } from "@/lib/format";
import { uid } from "@/lib/store";
import type { Workout, WorkoutSet } from "@/lib/types";
import { Button, Card, Input, Label } from "./ui";

type Block = {
  key: string;
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
};

function emptyBlock(exercise = ""): Block {
  return {
    key: uid(),
    exercise,
    sets: "3",
    reps: "5",
    weight: "",
    rpe: "",
  };
}

function blocksFromWorkout(workout: Workout): Block[] {
  const map = new Map<string, Block>();
  for (const set of workout.sets) {
    const key = `${set.exercise}|${set.reps}|${set.weight}|${set.rpe ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.sets = String(Number(existing.sets) + 1);
    } else {
      map.set(key, {
        key: uid(),
        exercise: set.exercise,
        sets: "1",
        reps: String(set.reps),
        weight: String(set.weight),
        rpe: set.rpe ? String(set.rpe) : "",
      });
    }
  }
  return Array.from(map.values());
}

export function WorkoutForm({
  initial,
  knownExercises,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Workout;
  knownExercises: string[];
  submitLabel: string;
  onSubmit: (workout: Workout) => void;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [blocks, setBlocks] = useState<Block[]>(
    initial ? blocksFromWorkout(initial) : [emptyBlock()]
  );
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    let sets = 0;
    let volume = 0;
    for (const block of blocks) {
      const count = Number(block.sets) || 0;
      const reps = Number(block.reps) || 0;
      const weight = Number(block.weight) || 0;
      sets += count;
      volume += count * reps * weight;
    }
    return { sets, volume: Math.round(volume) };
  }, [blocks]);

  const updateBlock = (key: string, patch: Partial<Block>) => {
    setBlocks((current) =>
      current.map((block) => (block.key === key ? { ...block, ...patch } : block))
    );
  };

  const addBlock = () => {
    setBlocks((current) => [...current, emptyBlock()]);
  };

  const removeBlock = (key: string) => {
    setBlocks((current) => {
      const next = current.filter((block) => block.key !== key);
      return next.length > 0 ? next : [emptyBlock()];
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!date) {
      setError("Pick a date for this session.");
      return;
    }

    const sets: WorkoutSet[] = [];
    for (const block of blocks) {
      const exercise = block.exercise.trim();
      const count = Number(block.sets);
      const reps = Number(block.reps);
      const weight = Number(block.weight);
      const rpe = block.rpe.trim() === "" ? undefined : Number(block.rpe);

      if (!exercise && !block.weight) continue;
      if (!exercise) {
        setError("Every exercise needs a name.");
        return;
      }
      if (!Number.isFinite(count) || count < 1 || count > 20) {
        setError(`Sets for ${exercise} must be between 1 and 20.`);
        return;
      }
      if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
        setError(`Reps for ${exercise} must be between 1 and 100.`);
        return;
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 2000) {
        setError(`Weight for ${exercise} must be between 0 and 2000 kg.`);
        return;
      }
      if (rpe !== undefined && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
        setError(`RPE for ${exercise} must be between 1 and 10.`);
        return;
      }

      for (let index = 0; index < count; index += 1) {
        sets.push({
          id: uid(),
          exercise,
          reps,
          weight,
          ...(rpe !== undefined ? { rpe } : {}),
        });
      }
    }

    if (sets.length === 0) {
      setError("Add at least one exercise with sets, reps, and weight.");
      return;
    }

    onSubmit({
      id: initial?.id ?? uid(),
      date,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      sets,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="workout-date">Session date</Label>
            <Input
              id="workout-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="workout-notes" hint="optional">
              Notes
            </Label>
            <Input
              id="workout-notes"
              type="text"
              placeholder="How did it feel?"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
            />
          </div>
        </div>
      </Card>

      <datalist id="exercise-options">
        {knownExercises.map((exercise) => (
          <option key={exercise} value={exercise} />
        ))}
      </datalist>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <Card key={block.key} className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Exercise {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeBlock(block.key)}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-rose-300"
                title="Remove exercise"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-12">
                <Label htmlFor={`exercise-${block.key}`}>Exercise</Label>
                <Input
                  id={`exercise-${block.key}`}
                  type="text"
                  list="exercise-options"
                  placeholder="e.g. Bench Press"
                  value={block.exercise}
                  onChange={(event) =>
                    updateBlock(block.key, { exercise: event.target.value })
                  }
                  maxLength={120}
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor={`sets-${block.key}`}>Sets</Label>
                <Input
                  id={`sets-${block.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={block.sets}
                  onChange={(event) =>
                    updateBlock(block.key, { sets: event.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor={`reps-${block.key}`}>Reps</Label>
                <Input
                  id={`reps-${block.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={block.reps}
                  onChange={(event) =>
                    updateBlock(block.key, { reps: event.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor={`weight-${block.key}`}>Weight (kg)</Label>
                <Input
                  id={`weight-${block.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  placeholder="0"
                  value={block.weight}
                  onChange={(event) =>
                    updateBlock(block.key, { weight: event.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor={`rpe-${block.key}`} hint="optional">
                  RPE
                </Label>
                <Input
                  id={`rpe-${block.key}`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={10}
                  step="0.5"
                  placeholder="—"
                  value={block.rpe}
                  onChange={(event) =>
                    updateBlock(block.key, { rpe: event.target.value })
                  }
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={addBlock}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4" />
        Add exercise
      </Button>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Total sets
            </p>
            <p className="text-lg font-semibold text-white">{preview.sets}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Volume
            </p>
            <p className="text-lg font-semibold text-white">
              {preview.volume.toLocaleString()} kg
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Card>

      {error ? (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
