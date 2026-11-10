export type WorkoutSet = {
  id: string;
  exercise: string;
  reps: number;
  weight: number;
  rpe?: number;
};

export type Workout = {
  id: string;
  date: string;
  notes?: string;
  sets: WorkoutSet[];
  createdAt: string;
};

export type SuggestionAction =
  | "increase"
  | "decrease"
  | "deload"
  | "maintain"
  | "add_reps";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export type Suggestion = {
  id: string;
  exercise: string;
  action: SuggestionAction;
  amountKg?: number;
  reps?: number;
  reason: string;
  status: SuggestionStatus;
  createdAt: string;
  source: "agent" | "rules";
  messageId?: string;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  suggestionIds?: string[];
  toolsUsed?: string[];
  fallback?: boolean;
};

export type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  userId: string;
};

export type PersonalRecord = {
  exercise: string;
  e1rm: number;
  weight: number;
  reps: number;
  date: string;
};

export type ExerciseStat = {
  exercise: string;
  sessions: number;
  lastDate: string | null;
  bestE1rm: number;
  bestWeight: number;
  points: { date: string; e1rm: number; weight: number; volume: number }[];
  trendPct: number;
  plateau: boolean;
};

export type WeeklyVolume = {
  weekStart: string;
  label: string;
  volume: number;
  sets: number;
  sessions: number;
};

export type CoachResponse = {
  message: string;
  suggestions: Suggestion[];
  toolsUsed: string[];
  fallback: boolean;
};

export type ProgressSummary = {
  totalWorkouts: number;
  totalSets: number;
  totalVolume: number;
  thisWeekSessions: number;
  thisWeekVolume: number;
  lastWeekSessions: number;
  lastWeekVolume: number;
  prs: PersonalRecord[];
  exercises: ExerciseStat[];
  plateaus: string[];
  weeklyVolume: WeeklyVolume[];
};
