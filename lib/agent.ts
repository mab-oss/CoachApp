import OpenAI from "openai";
import { z } from "zod";
import { buildSummary, findExerciseStat, getHistory } from "./progress";
import { uid } from "./store";
import type { CoachResponse, Suggestion, Workout } from "./types";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type RunAgentInput = {
  messages: ConversationMessage[];
  workouts: Workout[];
  userName?: string;
  apiKey: string;
  model: string;
};

type ToolContext = {
  workouts: Workout[];
  suggestions: Suggestion[];
};

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const workoutSetSchema = z.object({
  id: z.string(),
  exercise: z.string().max(120),
  reps: z.number().int().min(1).max(1000),
  weight: z.number().min(0).max(2000),
  rpe: z.number().min(1).max(10).optional(),
});

const workoutSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional(),
  sets: z.array(workoutSetSchema).max(200),
  createdAt: z.string(),
});

export const coachRequestSchema = z.object({
  messages: z.array(chatMessageSchema).max(40),
  workouts: z.array(workoutSchema).max(1000),
  userName: z.string().max(120).optional(),
});

export type CoachRequest = z.infer<typeof coachRequestSchema>;

const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_history",
      description:
        "Read the user's past workouts. Filter by exercise name, date range, and limit. Use this when the user asks about specific sessions or dates.",
      parameters: {
        type: "object",
        properties: {
          exercise: {
            type: "string",
            description: "Exercise name to filter by, e.g. 'Bench Press'.",
          },
          startDate: {
            type: "string",
            description: "Inclusive start date in YYYY-MM-DD format.",
          },
          endDate: {
            type: "string",
            description: "Inclusive end date in YYYY-MM-DD format.",
          },
          limit: {
            type: "number",
            description: "Maximum workouts to return (1-50). Defaults to 10.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_progress",
      description:
        "Calculate progress metrics: weekly volume, personal records, estimated 1RM trends, and plateaus. Call this before answering any question about progress. Pass an exercise to focus on one lift.",
      parameters: {
        type: "object",
        properties: {
          exercise: {
            type: "string",
            description: "Optional exercise name for a focused report.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_adjustment",
      description:
        "Create a proposed training adjustment for the user to accept or reject. Only call this when the data clearly supports a change. At most two per reply.",
      parameters: {
        type: "object",
        properties: {
          exercise: {
            type: "string",
            description: "Exercise the adjustment applies to.",
          },
          action: {
            type: "string",
            enum: ["increase", "decrease", "deload", "maintain", "add_reps"],
            description: "The kind of adjustment to propose.",
          },
          amountKg: {
            type: "number",
            description: "Load change in kg, when relevant.",
          },
          reps: {
            type: "number",
            description: "Target reps, when relevant.",
          },
          reason: {
            type: "string",
            description:
              "Short evidence-based explanation (max 300 characters).",
          },
        },
        required: ["exercise", "action", "reason"],
        additionalProperties: false,
      },
    },
  },
];

const historyQuerySchema = z.object({
  exercise: z.string().max(120).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const progressQuerySchema = z.object({
  exercise: z.string().max(120).optional(),
});

const suggestionInputSchema = z.object({
  exercise: z.string().min(1).max(120),
  action: z.enum(["increase", "decrease", "deload", "maintain", "add_reps"]),
  amountKg: z.coerce.number().min(0).max(500).optional(),
  reps: z.coerce.number().int().min(1).max(100).optional(),
  reason: z.string().min(3).max(300),
});

export function executeTool(
  name: string,
  rawArgs: string,
  context: ToolContext
): { result: unknown; tool: string } {
  const args = rawArgs.trim() ? JSON.parse(rawArgs) : {};

  switch (name) {
    case "get_history": {
      const query = historyQuerySchema.parse(args);
      return {
        result: getHistory(context.workouts, query),
        tool: name,
      };
    }

    case "get_progress": {
      const query = progressQuerySchema.parse(args);
      if (query.exercise) {
        const stat = findExerciseStat(context.workouts, query.exercise);
        if (!stat) {
          return {
            result: {
              error: `No workout history found for "${query.exercise}".`,
            },
            tool: name,
          };
        }
        return {
          result: {
            exercise: stat.exercise,
            sessions: stat.sessions,
            lastDate: stat.lastDate,
            bestE1rm: stat.bestE1rm,
            bestWeight: stat.bestWeight,
            trendPct: stat.trendPct,
            plateau: stat.plateau,
            recentPoints: stat.points.slice(-8),
          },
          tool: name,
        };
      }

      const summary = buildSummary(context.workouts);
      return {
        result: {
          totalWorkouts: summary.totalWorkouts,
          totalSets: summary.totalSets,
          totalVolume: summary.totalVolume,
          thisWeekSessions: summary.thisWeekSessions,
          thisWeekVolume: summary.thisWeekVolume,
          lastWeekSessions: summary.lastWeekSessions,
          lastWeekVolume: summary.lastWeekVolume,
          prs: summary.prs,
          plateaus: summary.plateaus,
          weeklyVolume: summary.weeklyVolume,
          exercises: summary.exercises.map((stat) => ({
            exercise: stat.exercise,
            sessions: stat.sessions,
            lastDate: stat.lastDate,
            bestE1rm: stat.bestE1rm,
            trendPct: stat.trendPct,
            plateau: stat.plateau,
          })),
        },
        tool: name,
      };
    }

    case "suggest_adjustment": {
      if (context.suggestions.length >= 2) {
        return {
          result: {
            error:
              "Suggestion limit reached for this reply. Do not propose more than two adjustments.",
          },
          tool: name,
        };
      }

      const input = suggestionInputSchema.parse(args);
      const suggestion: Suggestion = {
        id: uid(),
        exercise: input.exercise.trim(),
        action: input.action,
        ...(input.amountKg !== undefined ? { amountKg: input.amountKg } : {}),
        ...(input.reps !== undefined ? { reps: input.reps } : {}),
        reason: input.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
        source: "agent",
      };
      context.suggestions.push(suggestion);

      return {
        result: {
          queued: true,
          note: "Suggestion shown to the user for approval.",
          suggestion,
        },
        tool: name,
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` }, tool: name };
  }
}

function buildSystemPrompt({
  workouts,
  userName,
}: {
  workouts: Workout[];
  userName?: string;
}) {
  const summary = buildSummary(workouts);
  const overview = summary.exercises
    .slice(0, 20)
    .map(
      (stat) =>
        `${stat.exercise}: ${stat.sessions} sessions, best e1RM ${stat.bestE1rm}kg, 4wk trend ${stat.trendPct}%, ${stat.plateau ? "plateau" : "progressing"}`
    )
    .join("; ");

  return [
    "You are CoachApp, a concise strength-training coach embedded in a workout tracker.",
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    userName ? `The user's name is ${userName}.` : "",
    `Data snapshot: ${summary.totalWorkouts} workouts, ${summary.totalSets} sets logged.`,
    overview ? `Exercises: ${overview}.` : "The user has no logged workouts yet.",
    "",
    "Use the tools:",
    "- Call get_progress before answering any question about how the user is doing, progress, trends, PRs, or plateaus.",
    "- Call get_history when the user asks about specific sessions, dates, or recent workouts.",
    "- Call suggest_adjustment to propose a change. Suggestions are proposals; the user accepts or rejects them.",
    "",
    "Rules:",
    "- Reply in 2-5 short sentences or a few tight bullets. No filler or long lectures.",
    "- Base every claim on tool data. Never invent workouts, weights, or dates.",
    "- If data is missing, say so and ask the user to log a workout.",
    "- Propose at most two adjustments per reply, and only when the data supports it.",
    "- Keep weights in kg. Use estimated 1RM when comparing strength.",
    "- Do not mention tool names, JSON, or internal mechanics.",
    "- If the question is unrelated to training, steer back to the user's training data.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runAgent({
  messages,
  workouts,
  userName,
  apiKey,
  model,
}: RunAgentInput): Promise<CoachResponse> {
  const client = new OpenAI({ apiKey });
  const context: ToolContext = { workouts, suggestions: [] };
  const toolsUsed = new Set<string>();

  const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt({ workouts, userName }) },
    ...messages.slice(-12).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  for (let step = 0; step < 5; step += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages: conversation,
      tools: toolDefinitions,
      tool_choice: "auto",
    });

    const assistant = completion.choices[0]?.message;
    if (!assistant) break;

    if (assistant.tool_calls && assistant.tool_calls.length > 0) {
      conversation.push({
        role: "assistant",
        content: assistant.content ?? null,
        tool_calls: assistant.tool_calls,
      });

      for (const call of assistant.tool_calls) {
        if (call.type !== "function") continue;
        let payload: unknown;
        try {
          const executed = executeTool(
            call.function.name,
            call.function.arguments,
            context
          );
          toolsUsed.add(executed.tool);
          payload = executed.result;
        } catch (error) {
          payload = {
            error:
              error instanceof Error ? error.message : "Tool execution failed.",
          };
        }
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(payload),
        });
      }
      continue;
    }

    const text = assistant.content?.trim();
    if (text) {
      return {
        message: text,
        suggestions: context.suggestions,
        toolsUsed: Array.from(toolsUsed),
        fallback: false,
      };
    }
    break;
  }

  return {
    message:
      "I pulled your training data but could not finish that answer. Try asking a shorter question, like “How am I doing?” or “Am I plateauing on bench?”",
    suggestions: context.suggestions,
    toolsUsed: Array.from(toolsUsed),
    fallback: false,
  };
}
