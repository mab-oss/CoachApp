# CoachApp

A workout tracker with a built-in AI coach. Log lifts, see real progress trends, and get evidence-based training adjustments that can be accepted or rejected.

## Features

- Local email/password accounts stored in the browser
- Workout logging with exercises, sets, reps, weight, RPE, and notes
- History with edit and delete
- Progress charts for weekly volume and estimated 1RM
- Personal records and plateau detection across training weeks
- AI coach chat with `get_history`, `get_progress`, and `suggest_adjustment` tools
- Accept/reject workflow for every suggested adjustment
- Sample data loader, JSON export, and a rules-based coach fallback without an API key

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts, and the OpenAI API.

## Notes

- Accounts and workout data live in the browser's localStorage. There is no shared database, and data does not sync across devices.
- `OPENAI_API_KEY` is read only by the server-side chat route and is never exposed to the browser.
- Without a key, the agent uses deterministic progress rules instead of the language model.
