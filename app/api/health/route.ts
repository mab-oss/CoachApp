import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    ai: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  });
}
