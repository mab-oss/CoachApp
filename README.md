# CoachApp

A workout tracker with a built-in AI agent. This is a **frontend-only** app: there is no
backend and no database. Everything runs in the browser and data is stored in `localStorage`
for the current browser.

## Features

- **Tracker** - log workouts (exercise, sets, reps, weight), review history, and see weekly
  volume plus estimated 1RM charts.
- **AI agent** - reads training history, calculates trends and plateaus, answers questions like
  "How am I doing?", and proposes training adjustments.
- **Approval workflow** - suggestions are proposals; accepting one updates the exercise's target
  weight. Nothing is applied automatically.
- **Sample data** - load eight weeks of realistic training from the dashboard empty state.
- **Local only** - no accounts, no server calls, no API keys. Each browser has its own data.

## Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | React 19 + TypeScript + Vite, React Router      |
| Charts     | Recharts                                        |
| Storage    | Browser `localStorage`                          |
| AI agent   | Built-in deterministic agent (ported to TypeScript) |

## Running locally

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Usage

1. Open the dashboard.
2. Either log your first workout or click **Load sample data** to seed eight weeks of training.
3. Visit **History**, **Dashboard**, and **AI coach** to explore progress and suggestions.
4. Use **Reset data** in the header to clear everything stored in this browser.

### Where data lives

All data is kept in one versioned `localStorage` key: `coachapp:data:v1`. It stays on the
device and is not synced anywhere. Clearing browser storage or using **Reset data** removes it.

## Deploying to Vercel

The repository includes a root `vercel.json` that installs and builds the `frontend/`
directory, publishes `frontend/dist`, and rewrites all routes to `index.html` for React Router.

```powershell
git push
```

Then import the repository in Vercel and deploy. No environment variables are required.

## Progress calculations

- **Weekly volume** = sum of `reps x weight` for sets in a Monday-starting week.
- **Estimated 1RM** uses the Epley formula: `weight x (1 + reps / 30)`, with `reps = 1`
  treated as the actual weight.
- **Change %** compares the average best e1RM of the first two weeks with the last two weeks.
- **Plateau** = the best e1RM in the last three tracked weeks has not exceeded the best e1RM of
  earlier weeks in the window (with a 0.1% tolerance).

## Verification

```powershell
cd frontend
npm run build
npm run lint
```

## Limitations

- Data is per-browser and per-device; there is no sync or backup.
- There is no real authentication or multi-user support.
- The optional Claude-backed agent from the previous backend version was removed because it
  requires a server-side API secret. The deterministic agent provides the same tools and
  approval workflow offline.
