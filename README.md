# Agentic Sales Team

An AI sales team that works for you in chat. Agents find leads on the public web, check the fit,
research and score them, match them to your products, draft emails and proposals, and book meetings.
Nothing is sent from the app: you review every draft and send it from your own mail.

The product plan is in `01-prd.md` to `06-milestone-prompts.md` and `DESIGN.md`. Build notes are in
`PROGRESS.md`. Instructions for AI helpers are in `AGENTS.md`.

## Stack

Next.js 14 (app router) · React 18 · TypeScript · Neon Postgres with pgvector · Drizzle ·
Google Gemini (raw fetch) · Firecrawl search · Vitest. Hosted on Vercel (region `sin1`).

## Setup

1. Install Node.js 20 or newer and pnpm.
2. `pnpm install`
3. Copy `.env.example` to `.env.local` and fill it in (see below). Never commit `.env.local`.
4. `pnpm db:migrate` creates the tables in the database (pgvector must be on in Neon).
5. `pnpm dev`, then open http://localhost:3000. On Windows PowerShell use `pnpm.cmd dev`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes in production | Signs session cookies (a long random string) |
| `GEMINI_API_KEY` | for AI | From Google AI Studio. Without it, AI steps are refused |
| `GEMINI_MODEL` | no | Overrides the writing model (now `gemini-3-flash-preview`) |
| `FIRECRAWL_API_KEY` | for lead search | Without it, lead search says it is not set up |
| `CRON_SECRET` | yes in production | Bearer token for `/api/cron/*`. Unset = the cron routes refuse every call |

The app starts and is usable with no Gemini and no Firecrawl key.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Runs the app locally |
| `pnpm build` / `pnpm start` | Production build and server (don't build while `dev` runs) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Applies database migrations |
| `pnpm db:generate` | Writes a new migration from `lib/db/schema.ts` |

## Deploying on Vercel

1. Import the GitHub repository as a Vercel project (framework: Next.js).
2. Add every variable above under Settings → Environment Variables (Production).
3. `vercel.json` sets the region `sin1` and two crons (`/api/cron/jobs`, `/api/cron/scrape`). The
   owner chose the free Hobby plan, which allows crons only once a day, so they run daily at 00:00 UTC.
   Searches and the chain move while a browser tab with the app is open. On the Pro plan, change both
   schedules to `* * * * *` so work also finishes with every tab closed.
4. Deploy. Vercel sends `Authorization: Bearer $CRON_SECRET` to the cron routes by itself.
