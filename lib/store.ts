import type {
  ChatMessage,
  LocalUser,
  Session,
  Suggestion,
  Workout,
} from "./types";

const PREFIX = "coachapp.v1";

const keys = {
  users: `${PREFIX}.users`,
  session: `${PREFIX}.session`,
  workouts: (userId: string) => `${PREFIX}.workouts.${userId}`,
  suggestions: (userId: string) => `${PREFIX}.suggestions.${userId}`,
  chat: (userId: string) => `${PREFIX}.chat.${userId}`,
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail (private mode / quota). Callers surface errors.
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadUsers(): LocalUser[] {
  return read<LocalUser[]>(keys.users, []);
}

export function saveUsers(users: LocalUser[]): void {
  write(keys.users, users);
}

export function loadSession(): Session | null {
  return read<Session | null>(keys.session, null);
}

export function saveSession(session: Session): void {
  write(keys.session, session);
}

export function clearSession(): void {
  remove(keys.session);
}

export function loadWorkouts(userId: string): Workout[] {
  const workouts = read<Workout[]>(keys.workouts(userId), []);
  return sortWorkouts(workouts);
}

export function saveWorkouts(userId: string, workouts: Workout[]): void {
  write(keys.workouts(userId), sortWorkouts(workouts));
}

export function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => {
    if (a.date === b.date) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.date.localeCompare(a.date);
  });
}

export function addWorkout(userId: string, workout: Workout): Workout[] {
  const workouts = [workout, ...loadWorkouts(userId)];
  saveWorkouts(userId, workouts);
  return sortWorkouts(workouts);
}

export function updateWorkout(userId: string, workout: Workout): Workout[] {
  const workouts = loadWorkouts(userId).map((item) =>
    item.id === workout.id ? workout : item
  );
  saveWorkouts(userId, workouts);
  return workouts;
}

export function removeWorkout(userId: string, workoutId: string): Workout[] {
  const workouts = loadWorkouts(userId).filter((item) => item.id !== workoutId);
  saveWorkouts(userId, workouts);
  return workouts;
}

export function loadSuggestions(userId: string): Suggestion[] {
  return read<Suggestion[]>(keys.suggestions(userId), []);
}

export function saveSuggestions(userId: string, suggestions: Suggestion[]): void {
  write(keys.suggestions(userId), suggestions);
}

export function addSuggestions(
  userId: string,
  suggestions: Suggestion[]
): Suggestion[] {
  const merged = [...suggestions, ...loadSuggestions(userId)];
  saveSuggestions(userId, merged);
  return merged;
}

export function updateSuggestion(
  userId: string,
  suggestionId: string,
  patch: Partial<Suggestion>
): Suggestion[] {
  const suggestions = loadSuggestions(userId).map((item) =>
    item.id === suggestionId ? { ...item, ...patch } : item
  );
  saveSuggestions(userId, suggestions);
  return suggestions;
}

export function removeSuggestion(
  userId: string,
  suggestionId: string
): Suggestion[] {
  const suggestions = loadSuggestions(userId).filter(
    (item) => item.id !== suggestionId
  );
  saveSuggestions(userId, suggestions);
  return suggestions;
}

export function loadChat(userId: string): ChatMessage[] {
  return read<ChatMessage[]>(keys.chat(userId), []);
}

export function saveChat(userId: string, messages: ChatMessage[]): void {
  write(keys.chat(userId), messages);
}

export function clearChat(userId: string): void {
  remove(keys.chat(userId));
}

export function clearWorkoutData(userId: string): void {
  remove(keys.workouts(userId));
  remove(keys.suggestions(userId));
  remove(keys.chat(userId));
}

export function deleteUser(userId: string): void {
  saveUsers(loadUsers().filter((user) => user.id !== userId));
  remove(keys.workouts(userId));
  remove(keys.suggestions(userId));
  remove(keys.chat(userId));
}

export function exportData(userId: string) {
  return {
    exportedAt: new Date().toISOString(),
    user: loadUsers().find((user) => user.id === userId) ?? null,
    workouts: loadWorkouts(userId),
    suggestions: loadSuggestions(userId),
    chat: loadChat(userId),
  };
}
