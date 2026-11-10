import { NextResponse } from "next/server";
import { coachRequestSchema, runAgent } from "@/lib/agent";
import { fallbackCoach } from "@/lib/fallback-coach";

export const runtime = "nodejs";
export const maxDuration = 60;

const buckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 30;
}

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  if (isRateLimited(`chat:${ip}`)) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const { messages, workouts, userName } = parsed.data;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      fallbackCoach({ messages, workouts, userName })
    );
  }

  try {
    const result = await runAgent({
      messages,
      workouts,
      userName,
      apiKey,
      model,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Coach agent error:", error);
    const fallback = fallbackCoach({ messages, workouts, userName });
    return NextResponse.json({
      ...fallback,
      message: `${fallback.message}\n\n(The live AI model could not be reached, so this answer came from the built-in rules coach.)`,
    });
  }
}
