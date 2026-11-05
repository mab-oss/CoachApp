# CoachApp

A workout tracker with a built-in AI agent, built from the project proposal in
`Workout_Tracker-1.pdf`.

CoachApp has two parts:

- **Tracker** - log workouts (exercise, sets, reps, weight), review history, and see weekly
  volume plus estimated 1RM charts.
- **AI agent** - reads training history, calculates trends and plateaus, answers questions like
  "How am I doing?", and proposes training adjustments. Suggestions are proposals: the user
  accepts or rejects them.

## Stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 19 + TypeScript + Vite, React Router, Recharts              |
| Backend   | Python 3.12 + FastAPI, SQLAlchemy 2                                 |
| Database  | SQLite (`backend/coachapp.db`)                                     |
| Auth      | Email/password, bcrypt hashing, JWT bearer tokens                  |
| AI agent  | Built-in deterministic agent, optional Claude API tool-calling     |

```
React UI (logs, charts, chat)
        |
        v
FastAPI API  --->  AI Agent (tools)  --->  optional Claude API
        |
        v
SQLite (users, exercises, workouts, sets, suggestions, chat)
```

## Features (MVP)

- User registration and login with per-user data isolation
- Workout logging form with multiple exercises and sets
- History page with filters and delete
- Progress dashboard: weekly volume bars, best e1RM line, PRs, trend and plateau detection
- Agent chat with three real tools:
  - `get_history` - read past workouts by date range or exercise
  - `get_progress` - weekly volume, PRs, percent change, plateau detection
  - `suggest_adjustment` - create a pending proposal (never applies it directly)
- Accept/reject workflow that updates the exercise's target weight on acceptance
- Demo seed data: eight weeks of training across four lifts

## Running locally

### 1. Backend

Python 3.12 is required. On this machine it was installed with:

```powershell
winget install -e --id Python.Python.3.12
```

Then from the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe seed.py   # optional: creates the fixed demo account
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API docs are available at http://127.0.0.1:8000/docs.

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend on port 8000.

### Demo account

On the login page, choose **Try the demo**. Each demo visit creates an isolated demo user with
eight weeks of seeded training, so other demo visitors cannot see or change your data. Sessions
last seven days; expired demo users are cleaned up on the next demo login.

The fixed seed account is still available for manual login:

```
Email:    demo@coachapp.dev
Password: demo1234
```

Re-run `python seed.py --force` to reset the fixed demo account and data.

## Agent modes

By default the agent runs **deterministically and offline**: it detects intent, calls
`get_history`, calls `get_progress`, writes a short summary, and calls `suggest_adjustment`
based on plateau/trend rules. No API key is needed.

To use Claude tool-calling instead, copy `backend/.env.example` to `backend/.env` and set:

```
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-sonnet-4-5
```

The Claude adapter uses the same three tools and the same approval workflow. If the API call
fails, the backend falls back to the built-in agent automatically.

## API overview

| Method | Endpoint                              | Purpose                              |
| ------ | ------------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`                  | Create account, returns JWT          |
| POST   | `/api/auth/login`                     | Log in, returns JWT                  |
| POST   | `/api/auth/demo`                      | Create isolated demo user, returns JWT |
| GET    | `/api/auth/me`                        | Current user                         |
| GET    | `/api/exercises`                      | Exercises for the current user       |
| GET    | `/api/workouts`                       | List workouts (`exercise`, `limit`)  |
| POST   | `/api/workouts`                       | Create a workout with sets           |
| DELETE | `/api/workouts/{id}`                  | Delete a workout                     |
| GET    | `/api/progress/summary`               | Progress for every exercise          |
| GET    | `/api/progress?exercise=...`          | Progress for one exercise            |
| POST   | `/api/agent/chat`                     | Run the agent, returns reply + tools |
| GET    | `/api/agent/messages`                 | Chat history                         |
| GET    | `/api/suggestions`                    | List suggestions (`status`)          |
| POST   | `/api/suggestions/{id}/accept`        | Apply a proposal                     |
| POST   | `/api/suggestions/{id}/reject`        | Reject a proposal                    |

## Progress calculations

- **Weekly volume** = sum of `reps x weight` for sets in a Monday-starting week.
- **Estimated 1RM** uses the Epley formula: `weight x (1 + reps / 30)`, with `reps = 1`
  treated as the actual weight.
- **Change %** compares the average best e1RM of the first two weeks with the last two weeks.
- **Plateau** = the best e1RM in the last three tracked weeks has not exceeded the best e1RM of
  earlier weeks in the window (with a 0.1% tolerance).

## Tests and verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm run build
npm run lint
```

Backend tests cover auth, workout CRUD, progress math, plateau detection, agent tool order,
suggestion acceptance/rejection, and the no-data case.

## Out of scope

CSV export, natural-language workout entry, generated weekly plans, and weekly summary
messages are listed as possible later additions in the proposal and are not implemented.
