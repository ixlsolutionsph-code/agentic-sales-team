# Build guide: 10 milestones

| | |
|---|---|
| **Status** | Build spec, matches `origin/main` at PR #163 (commit `d3c6ff6`) |
| **Last updated** | 2026-11-17 |
| **Read first** | `01-prd.md`, `04-erd.md` |

Build the product in these 10 milestones, **in order**. Each milestone has:

- **Goal:** what works at the end.
- **Features:** the PRD features it delivers ([F#], `01-prd.md` §6).
- **Build:** the files to make. Paths match the reference repo, so the two can be compared.
- **Rules:** the facts that are easy to get wrong.
- **Check:** the tests that must pass before the next milestone starts.

```
M1 Setup & landing ─> M2 Database, auth & workspaces ─> M3 App shell ─> M4 Agents ─> M5 Teams & dashboard
                                                                              │
M10 Meetings, alerts & deploy <─ M9 Team chat & chain <─ M8 Lead search <─ M7 Jobs & engines <─ M6 Catalog & leads
```

**Every milestone:**
- Real logic goes in `server-only` modules that take an explicit workspace id. Thin `"use server"` files read the session and call them. Client components import only the actions.
- Write Vitest tests next to the code (`*.test.ts`) for every pure function (parsers, limits, derivations). Run `pnpm test` and `pnpm lint` before you finish.
- No seed data. Every list must handle the empty state.

---

## M1. Project setup and landing page

**Goal:** a new Next.js app that shows the full landing page. No database yet.

**Features:** [F1] (the landing page part).

**Build**

- `package.json` with the exact versions in `01-prd.md` §8. `packageManager: "pnpm@11.3.0"`. Scripts: `dev`, `build`, `start`, `lint` (`next lint`), `test` (`vitest run`), `db:generate` (`drizzle-kit generate`), `db:migrate` (`node scripts/migrate.mjs`), `db:studio`.
- `tsconfig.json` with the `@/*` path alias. `.eslintrc.json` (`next/core-web-vitals`). `vitest.config.ts`.
- `.env.example` with the 6 variables in `01-prd.md` §8. `.gitignore` covers `.env.local`, `.next`, `node_modules`, `.claude/`.
- `app/layout.tsx` (title "Agentic Sales Team", description "An AI sales team that works for you in chat.", Inter, JetBrains Mono, General Sans), `app/globals.css` (tokens in `01-prd.md` §10, Lucide icon font at `/fonts/lucide.woff2`, keyframes, reduced motion, 767 px breakpoint).
- `public/`: `logo-mark.png`, `logo-a.png`, `agents/{theo,pat,maya,sam}.jpg`, `fonts/lucide.woff2`, `landing/face1-4.jpg`. Make your own art; keep the file names.
- `components/landing/*` and `components/Landing.tsx`:
  - the loader (≥ 3 s, 250 ms with reduced motion)
  - every section in `02-sitemap.md` §6, in order, with that exact copy
  - the scripted HeroDemo
  - GSAP + ScrollTrigger reveals and the hero tilt
- `app/page.tsx` shows the landing page. "Log in", "Get started", the plan buttons and the hero email form open a placeholder auth screen for now. M2 makes it real. Keep the hero email in `sessionStorage`, so sign-up can fill it in later.

**Rules**
- The landing page copy, the mock agents (Theo, Pat, Maya, Sam) and the plans with no prices are part of the scope as-is (`01-prd.md` §11).
- GSAP is used on the landing page only.

**Check**
- [ ] `pnpm dev` shows the loader, then the hero, then every section in order.
- [ ] Sections reveal on scroll; with reduced motion on, the loader is short and nothing moves.
- [ ] At 375 px wide there is no side scroll.
- [ ] Get started with an email in the hero opens the auth screen; the email is in `sessionStorage`.
- [ ] `pnpm build`, `pnpm lint` and `pnpm test` pass.

---

## M2. Database, auth and workspaces

**Goal:** the full database exists, and a user can sign up, log in, log out, and own up to 10 isolated workspaces.

**Features:** [F1] (sign-up and log in), [F2], [F15] (auth part).

**Build**
- `lib/db/schema.ts`: all 19 tables from `04-erd.md`, exact names, types and defaults.
- `lib/db/index.ts`: the Drizzle client on `@neondatabase/serverless`. If `DATABASE_URL` is not set, export a null client so the app still boots.
- `drizzle.config.ts`: reads `.env.local`, schema `./lib/db/schema.ts`, out `./lib/db/migrations`, dialect `postgresql`.
- `scripts/migrate.mjs`: the custom runner. Create `_migrations(name pk, applied_at)`; read `lib/db/migrations/*.sql` in name order; skip applied files; split on `--> statement-breakpoint`; run each file's statements **and** its `_migrations` insert in one `sql.transaction([...])`.
- One migration (or the reference `0000`–`0026`) that ends with: `CREATE EXTENSION IF NOT EXISTS vector`, the HNSW index `products_embedding_idx`, the partial unique index `outreach_drafts_live_lead_idx`, the unique index `proposals_lead_id_idx`, the index `workspaces_owner_id_idx`.
- `lib/auth/jwt.ts` (edge-safe): HS256 with `jose`, cookie name `session`, 30-day expiry, payload `{userId, email, name, sessionVersion}`. Secret `AUTH_SECRET`; dev fallback `dev-insecure-secret-change-me`; throw in production if missing.
- `lib/auth/session.ts`: `getSession()` returns `{userId: activeWorkspaceId, accountId, email, name}`. It checks the token's `sessionVersion` against `users.session_version`, and honours the `ws` cookie only if the account owns that workspace. `revokeSessions()` adds 1 to `session_version`. Cookies: httpOnly, `secure` in production, sameSite lax, path `/`, 30 days.
- `lib/auth/rateLimit.ts`: fixed windows in `auth_rate_limits` (atomic upsert). Limits in `01-prd.md` §7.8. Keys `"{action}:ip:{ip}"` and `"{action}:email:{sha256}"`. IP = first `x-forwarded-for` hop, else `x-real-ip`. **Fail open** on DB errors. Clear the email key after a good sign-in.
- `lib/auth/actions.ts`: `signUp`, `signIn`, `signOut`, `requestPasswordReset` (validates and rate-limits only; writes nothing), `validateResetToken`, `resetPassword` (SHA-256 token lookup, new hash, bump version, delete tokens), `currentUser`, `updateSettings`.
  - Sign-up: lower-case and trim the email, regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, password ≥ 8, bcrypt cost 10, insert with `ON CONFLICT DO NOTHING` (no lookup first, so it never reveals a registered email), then insert the workspace with **`id = user.id`**.
  - Sign-in: rate-limit **before** the lookup; one message for every failure; delete the `ws` cookie.
  - `currentUser` never throws, except it re-throws Next's `DYNAMIC_SERVER_USAGE`.
- `lib/auth/call-action.ts`: wraps a server action; on a throw shows "Couldn't reach the server. Check your connection and try again."
- `lib/workspaces/actions.ts` and `scope.ts`: `listWorkspaces` (oldest first), `createWorkspace` (≤ 10, name trimmed, ≤ 80), `switchWorkspace` (UUID check, ownership check, set `ws` cookie), `inAccountWorkspaces` (for account-wide quotas).
- `middleware.ts`: public `/` and `/reset`; cron paths pass through; others need a valid token or redirect to `/`.
- `components/Login.tsx`: replaces the M1 placeholder. The three modes, strength meter, texts in `02-sitemap.md` §6. Full reload to `/` 350 ms after success.
- `app/reset/page.tsx`: the 5 states.
- `app/settings/page.tsx`: Workspace name, Your name, save on blur.

**Rules**
- Do **not** use `drizzle-kit migrate` or `push`. The Neon HTTP driver runs one statement per call.
- Every data table's `user_id` references **`workspaces.id`**, not `users.id`.
- **The first workspace has the account's id.** Sign-in always lands in it.
- Middleware checks the signature only; the version check is in `getSession`.

**Check**
- [ ] `pnpm db:migrate` on an empty Neon database creates 19 tables plus `_migrations`, and a second run applies nothing.
- [ ] `\d outreach_drafts` shows the partial unique index; `\d products` shows the HNSW index.
- [ ] Sign up → logged in; log out → logged out; log back in works. Old cookies stop working after log out (session version).
- [ ] Signing up twice with one email shows the same neutral message.
- [ ] The 6th wrong password for one email in 15 min says "Too many attempts. Try again in N minutes."
- [ ] Create a second workspace, switch to it, switch back. The `ws` cookie of a workspace you don't own is ignored.
- [ ] An 11th workspace says "You can have up to 10 workspaces."
- [ ] `/dashboard` with no session redirects to `/`.

---

## M3. App shell and client store

**Goal:** every signed-in page exists inside the shell, with empty states.

**Features:** [F14] (shell parts), base for all pages.

**Build**
- `components/AppFrame.tsx`: signed out → Landing (from M1) or Login; `/reset` public; `/create` with no shell; else `<Shell>`. Mount the Create-a-team modal and the Toast globally.
- `components/Shell.tsx`: sidebar and header from `02-sitemap.md` §5 (rail, mobile drawer with focus trap, account menu, header titles).
- `components/WorkspaceSwitcher.tsx`: list, New workspace (inline input), Workspace settings; full reload after switch or create.
- `components/primitives.tsx` (`css()`, `Box`, `Btn`), `components/Modal.tsx` (Esc, overlay click, focus trap, focus return), `components/Toast.tsx` (success 2600 ms, error 4500 ms).
- `lib/store.tsx`: React Context `AppProvider` + `useApp()`. Hydrated in `app/layout.tsx` from `currentUser()` and `loadWorkspace()`. Holds auth flags, chats, agents, teams, config, states, team-member overrides, wizard and team-modal fields, toast. Optimistic actions use `persistOrRollback`.
- `lib/workspace/actions.ts`: `loadWorkspace()` returns agents, teams, agent config, agent states, team-member overrides and messages grouped by `agent_id`.
- Empty pages: `/dashboard`, `/agents`, `/leads`, `/emails`, `/products`, `/calendar`, `/chats`, and `app/error.tsx`, `app/global-error.tsx` ("This page didn't load").
- `lib/useConfirmClick.ts`: two-click delete that disarms after 3 s.

**Rules**
- No client storage except the unread map (M10). A workspace switch reloads the page.
- `lib/data.ts`: `AGENTS_BASE = []`, `TEAMS_BASE = []`. No seed data.

**Check**
- [ ] Every sidebar link opens its page with an empty state and the right header title.
- [ ] Collapse to the rail and back; at 375 px the sidebar is a drawer.
- [ ] Toasts show and hide on time; Esc closes a modal and focus returns.

---

## M4. Agents

**Goal:** create, view, configure, pause and delete agents.

**Features:** [F3].

**Build**
- `lib/agentTypes.ts`: the 10 capabilities, 16 agent types and 10 team templates in `01-prd.md` §7.1, `isEngineReady`, `parseMeetingMinutes` (5–480 min).
- `lib/visuals.ts`: `AGENT_CHARS`, `agentCharIndex` (explicit `char % 4`, else hash of id `% 4`), avatar style (colour + `26` alpha, image at 114%), `statusPill`, `chip`.
- `app/create/page.tsx`: the 5-step wizard and success screen (`02-sitemap.md` §6). `createAgent` in the store: id `"x" + Date.now().toString(36) + 3 random chars`, colour `#006AFF`, status `idle`, task "Ready for work", score 0, goal = first sentence. Save the agent row, then `agent_config.settings` if the Settings step set anything.
- `app/agents/page.tsx`: cards with two-click delete.
- `app/agents/[id]/page.tsx`: header, sticky section tabs (hidden by capability), Overview, Tasks, Performance, Configuration (role, goal, Autonomy Ask/Auto per capability saved at once, book-meeting settings). Run buttons come in M7–M8; show the sections now with empty states.
- `lib/agents/derive.ts` (`agentNow`, `liveAgentCount`, `teamKpis`, `teamSubtitle`), `lib/agents/stats.ts`.
- `lib/workspace/actions.ts`: `saveAgent`, `saveAgentConfig` (partial upsert), `setAgentPaused`, `removeAgent` (soft delete in `agent_states`).

**Rules**
- **Ask/Auto lives in `agent_config.settings[cap].mode`.** Only `"auto"` is Auto. Do not use the `permissions` column.
- Agent status on screen is derived from live jobs, never from `agents.status`.

**Check**
- [ ] Create one agent of each of 3 types; each shows the right capabilities; a Custom agent with Follow-ups shows "Coming soon".
- [ ] A meeting length of "1 hour" saves `duration: 60`; "3 min" shows the error.
- [ ] Set Research to Auto, reload: it is still Auto.
- [ ] Pause shows "Paused"; Delete removes it from every list but the row stays in `agents`.
- [ ] `/agents/unknown` shows "Agent not found".

---

## M5. Teams and dashboard

**Goal:** group agents into teams and see them on the dashboard.

**Features:** [F4], [F14] (dashboard).

**Build**
- `components/TeamModal.tsx`: name, 6 icons, 10 templates, members, coverage (✓ / ○), gap rows with quick-create (first non-custom type whose only capability is the gap), shared goal. `createTeam` id `"tx" + base36 time + 3 chars`; open `/teams/[id]`.
- `lib/teams/membership.ts`: `membersOfTeam` (override, else base, minus removed), `teammatesOf`, `leadPoolOf`.
- `app/teams/[id]/page.tsx`: everything in `02-sitemap.md` §6 except approvals (M9). KPIs from `teamKpis` over the members' accepted leads.
- Team edit, add members, remove member (upsert the full list into `team_members`), delete (removes `teams` and `team_members` rows; keeps chat messages).
- `app/dashboard/page.tsx` + `HomeClient.tsx`: greeting, hub card with ring and up to 8 agents, team filter, team cards. Stats from `lib/workspace/stats.ts` (`getWorkspaceStats`).

**Rules**
- Team KPIs are computed from leads. Do not use the `teams.meetings / pipeline / leads` columns.
- In pipeline = leads in `contacted`, `engaged` or `replied`.

**Check**
- [ ] A Full-Cycle team with only a Scout shows ✓ scrape, ○ outreach, ○ book-meeting; Create on a gap adds a Writer and ticks it.
- [ ] Add and remove members; the change survives a reload.
- [ ] The dashboard shows each team and each agent on the ring; "No teams yet" with none.

---

## M6. Catalog, leads and the AI transport

**Goal:** load products with embeddings, manage leads by hand and by CSV.

**Features:** [F10], [F13] (without run buttons), [F11] base.

**Build**
- `lib/ai/gemini.ts`: `isAIConfigured`, `aiGenerate` (0.7 / 400), `aiJSON` (0.6 / 700, `responseMimeType: "application/json"` + `responseSchema`, strip code fences), `aiEmbed`, `aiEmbedBatch` (never throws). Call `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header `x-goog-api-key: GEMINI_API_KEY`; system prompt in `systemInstruction`; temperature and max tokens in `generationConfig` (`maxOutputTokens`); `thinkingConfig: {thinkingBudget: 0}`; 30 s timeout; no retries; log ≤ 500 chars of an error body. A reply with no text, or with `finishReason` other than `STOP` or `MAX_TOKENS`, is an error.
- `lib/ai/untrusted.ts`: `<untrusted>` fence, `UNTRUSTED_RULE`, `sanitizeText`, `cleanField`, `LEAD_FIELD_LIMITS`.
- `lib/products/store.ts` + `actions.ts`: folders (ownership check), add, delete, move, CSV import (≤ 200 rows, aliases name/title, description/short description/desc/summary, price/cost, category/type; others → `attributes`), embedding text `name \n category \n description \n k: v…`, `searchProducts(k)` (cosine + keyword merge, see `01-prd.md` §7.6), `reembedProducts`.
- `app/products/*`: folders, Unfiled, table, modals.
- `lib/leads/types.ts` (`LEAD_STAGES`), `lib/leads/store.ts` + `actions.ts`: add (accepted, `manual`), CSV import (≤ 500, aliases, per-agent email dedupe, `import`), set stage, advance, accept, dismiss, bulk accept/dismiss, delete (hard), `listWorkbook`, `listLeadsForAgents`, `knownLeadKeys`, nav counts.
- `lib/url/safeUrl.ts`: http(s) only.
- `app/leads/*`: Active and Pending tabs, filters, modals, two-click deletes and bulk confirms.
- `lib/search/store.ts`: lead and product search (ILIKE, 5 each). Wire `components/GlobalSearch.tsx`.
- Activity rows `lead_added` for add, import.

**Rules**
- A product whose embedding fails is still saved with `embedding = null` and found by keyword.
- Embeddings: `gemini-embedding-001` via `:batchEmbedContents`, `outputDimensionality: 768`, `taskType` `RETRIEVAL_DOCUMENT` for products and `RETRIEVAL_QUERY` for queries, normalise to unit length (Gemini only normalises the full 3072-dim output).

**Check**
- [ ] A 20-row product CSV with a `location` column imports into a folder; `attributes.location` is set; every row has an embedding.
- [ ] `searchProducts("…")` returns the closest products; with the key removed it still returns keyword matches.
- [ ] A lead CSV with a duplicate email imports one row; leads show in Active.
- [ ] Global search finds a lead by company.

---

## M7. Jobs, engines and emails

**Goal:** agents run research, qualify, assess, match, outreach and proposal on real leads, from the agent page, with runners and cron.

**Features:** [F7] (assess engine), [F11], [F13] (run buttons), [F15] (run limits).

**Build**
- `lib/jobs/limits.ts`: every constant and message in `01-prd.md` §7.8.
- `lib/jobs/actions.ts`: `enqueueJob` with the checks in `01-prd.md` §7.5 (quota counted across the account's workspaces); `ask: true` → `needs_approval`. `enqueueOutreachJob` refuses leads that all have an open draft.
- `lib/jobs/runtime.ts`: `RUN_MAX_DURATION_S = 300`, `SCRAPE_MAX_DURATION_S = 60`, `STALE_GRACE_MS = 60 000`, `reapStaleJobs`, `withDeadline`.
- `lib/jobs/errors.ts`: `UserFacingError`; other errors → "{Kind label} failed. Please try again."
- `lib/jobs/drain.ts`: claim the oldest queued job atomically; re-check paused and AI at run time; per-lead loop with 75 s per lead, 180 s lead budget, 120 s claim budget; retrieval k = 3 (outreach), 5 (proposal), 8 (match); write the result counts and `steps` (`pick`, `work`).
- `lib/scrape/steps.ts`: the step log (`createStepLog`, serialised writes guarded by `status='running'`, `flush()`), used here for `pick` / `work` and in M8 for the search.
- Engines in `lib/ai/`: `research.ts`, `qualify.ts`, `assess.ts`, `match.ts`, `outreach.ts`, `proposal.ts` with the outputs, temperatures, rules and fallbacks in `01-prd.md` §7.6. Each one is pure; the store writes the results (`applyResearchResult`, `applyQualifyResult`, `applyAssessResult`, `applyOutreachResult` in one transaction with `ON CONFLICT DO NOTHING`, proposals `ON CONFLICT DO NOTHING`, matches + `matched_at`).
- `lib/leads/fit.ts`: `ensureFitReason` (one line, < 20 words, only where empty).
- `app/api/jobs/run/route.ts` (POST, session, `maxDuration = 300`, 5 jobs), `app/api/cron/jobs/route.ts` (GET, `force-dynamic`, 50 jobs), `lib/cron/auth.ts` (`timingSafeEqual` on `Bearer CRON_SECRET`; unset = refuse).
- Agent page run buttons: Qualify leads, Research leads, Run outreach, Generate proposals (busy labels, enqueue then `POST /api/jobs/run`). Tasks list.
- `app/emails/*`: To send / Sent / All, search, agent filter, Open in mail (mailto), Copy message, Open profile, Mark sent (transaction: draft sent + lead `new → contacted` + activity `email_sent`), Discard (`dismissed = true`), Clear sent.
- `vercel.json`: `regions: ["sin1"]`, crons `/api/cron/jobs` and `/api/cron/scrape` at `* * * * *`.

**Rules**
- Outreach **does not change** the lead stage. Only Mark sent and booking do.
- Assess **fails open** (accept at 50) without AI or on error, and does not overwrite `fit_reason` with an "Auto-accepted" reason.
- A stale running job is failed with "Timed out: the run was stopped before it finished." and never re-queued.

**Check**
- [ ] On 5 accepted leads, Research → Qualify → Run outreach → Generate proposals each fill their columns and rows.
- [ ] Running outreach twice at once leaves one live draft per lead.
- [ ] Mark sent moves the lead to `contacted`; Discard hides the draft but the dashboard count does not drop.
- [ ] The 101st run in 24 h is refused with the exact message.
- [ ] `GET /api/cron/jobs` without the header returns 401; with it, it drains the queue.
- [ ] With no AI key: AI runs are refused with the "AI isn't set up…" text.

---

## M8. Lead search

**Goal:** a Scout turns one request into pending leads, with a live timeline.

**Features:** [F6].

**Build**
- `lib/scrape/firecrawl.ts`: `planSearch` (LLM 0.15 / 400 → `{mode, queries[3], roles[], platform}`; linkedin forces fit; no-AI fallback), `buildSearches` (`01-prd.md` §7.3), Firecrawl `POST /v2/search` (`{query, limit}`, `tbs: "qdr:m"` in intent mode, 15 s), parallel `allSettled`, URL dedupe, extraction (0.3 / 4000, 40 000-char corpus, each source in its own untrusted block, asks for target + 5), `normalizeProspects`, `lacksEmployer`, `PLATFORM_EMPLOYERS`.
- `lib/scrape/gate.ts`: the gate (`gemini-2.5-flash-lite`, temp 0, ≤ 8 s each, 16 concurrent, 10 s budget, fail open).
- `lib/scrape/rules.ts`: `JOB_AD_RULE`, `AGENCY_RULE`.
- `lib/jobs/scrape.ts`: claim, run with the 45 s deadline, `addScrapedLeads` (team-pool dedupe by URL and email, stop at target, `pending`, `scrape`, activity `lead_added`), result `{leadsFound, leadIds, steps}`, save-step detail when short of target, `leadOwnerForTeam`, cron drain (1 job, up to 3 claim tries).
- `app/api/scrape/route.ts` (POST `{jobId}`, session, `maxDuration = 60`), `app/api/cron/scrape/route.ts` (GET, cron auth, `maxDuration = 60`).
- `getScrapeProgress` action (hides raw errors).
- Agent page Find leads button (browser prompt, target 10, runs at once).
- `app/chats/ScrapeProgress.tsx`: the timeline card (poll 1200 ms, stop at 3 min), usable from the agent page now and the chat in M9.

**Rules**
- Read only SERP title, description and URL. Never fetch the pages.
- A `profile_url` must be one of the URLs Firecrawl returned.
- Never invent an email. Never guess the buyer.

**Check**
- [ ] "HR managers at hospitals in Manila" (fit) and "people looking for a virtual assistant in Texas" (intent) each save leads to Pending with a one-line fit reason.
- [ ] Running the same search again saves no duplicates.
- [ ] The timeline shows plan, search, gate (with dropped sources), extract, save.
- [ ] With no Firecrawl key, the job fails with a clear message, not a crash.
- [ ] The 21st search in 24 h is refused.

---

## M9. Team chat and the chain

**Goal:** the owner runs the funnel by talking to a team. Steps hand off with Proceed / Cancel.

**Features:** [F5], [F7] (in chat), [F8], [F9], [F15] (chat limit).

**Build**
- `lib/chat/teamMessages.ts`: `postTeamMessage` (`agent_id = teamId`), `listTeamMessages(teamId, afterId)`, idempotent job posts with `⟦job:id⟧`, `chatUnread`.
- `lib/chat/thread.ts`: markers, `stripMarkers`, `mergeThread` (dedupe by id, local rows last, a stored "me" replaces the matching local one).
- `lib/ai/intent.ts` (LLM + keyword fallback), `lib/ai/resolveLeads.ts`.
- `lib/chat/orchestrate.ts`: `resolve()` routing and hand-off texts (`01-prd.md` §7.4), `describeWork` for status, mention parsing (`/@[\p{L}\p{N}_'-]+/gu`, first name or full name without spaces).
- `lib/chat/converse.ts` + `teamFacts.ts`: persona prompt, last 10 turns, facts ≤ 3000 chars.
- `lib/chat/clarify.ts`, `scrapeBrief.ts`, `outreachTarget.ts`, `yesNo.ts`: search brief (product, what, where, count; 2 asks then defaults; never guess what), "look for more", ask texts, offers, quick replies, lead pickers, yes/no reading (≤ 40 chars).
- `lib/chat/actions.ts`: `teamChat()` and `reply()` with the branch order in `01-prd.md` §7.4; 2000-char and 300-a-day limits.
- `lib/pod/types.ts` (`POD_ORDER`, `POD_BATCH = 20`), `lib/pod/autonomy.ts` (`capMode`, `autoCaps`), `lib/pod/orchestrate.ts` (`enqueuePodStage`: busy, paused, no-ai, dismiss older asks; `chainNext` with the stop rules, wider-search offer and texts in `01-prd.md` §7.2), `lib/pod/decisions.ts` (`approveStep`, `cancelStep`), `lib/pod/summary.ts` (ask, start and cancel-summary texts), `lib/pod/actions.ts` (`approveJob`, `rejectJob`, `listPendingApprovals`).
- Call `chainNext` from the drain and the scrape runner when `params.pod && params.teamId`.
- `lib/chat/pace.ts`: the timings in `01-prd.md` §7.4.
- `app/chats/page.tsx`: header, bubbles, pills, nav links, typing dots, composer with @ and /lead pickers, 4000 ms poll, autoscroll (stick only when new, just sent, or within 120 px of the bottom).
- Cards: `ScrapeQuestions.tsx`, `ScrapeResults.tsx` (+ Lead overview modal), `LeadPicker.tsx`, `QuickReplies.tsx`, Proceed / Cancel.
- Store: `sendTeamChat`, `pullThread`, `followJob` (scrape → `/api/scrape` then `/api/jobs/run`; others `/api/jobs/run`; 2.5 s × 40 then the "Still working…" line and 15 s × 40), `clearChat` (hard delete + dismiss the team's waiting jobs).
- `app/ChatHome.tsx`: H1, composer with agent picker, 4 starter cards, approvals carousel, "Hire your first agent".
- Team page: Pending approvals with Approve / Reject.

**Rules**
- **Cards are markers in the message text.** There are no extra columns.
- Every agent question in the chat has a card or quick replies. No open question with only free text.
- Cancel dismisses **every** waiting or queued job of the team, not only the one pressed.
- A running step finishes after Cancel but hands nothing on.

**Check**
- [ ] With a full 7-agent team on Ask: "find HR managers at hospitals in Manila" asks for the count, then Proceed, then each hand-off asks Proceed, and the chain ends with "@You, the proposals are ready for you to review and send." (or drafts, if no Closer).
- [ ] Set every capability to Auto: the same request runs to the end with no Proceed.
- [ ] Cancel at the research step posts the summary and nothing else runs.
- [ ] "@Maya find leads" where Maya has no `scrape` posts the hand-off line and the Scout acts.
- [ ] "any updates?" names the last real job; "how many hot leads?" answers from data.
- [ ] A search that saves 0 leads stops the chain and offers a wider search.
- [ ] The first agent reply never shows sooner than 2 s after send.
- [ ] Message 301 in 24 h is refused.

---

## M10. Meetings, alerts and deploy

**Goal:** the full product, live on Vercel.

**Features:** [F12], [F14] (alerts, unread, search).

**Build**
- `lib/ai/meetingTime.ts`: `parseMeetingTime` (LLM at temp 0 with the next 14 days and their UTC offsets; regex fallback where a bare 1–7 means PM), `inBookingWindow`, label "Tue, Jul 15 · 2:00–2:30 PM", `safeTimeZone` (fallback UTC).
- `lib/meetings/store.ts` + `actions.ts`: settings with defaults `{type: "Meeting", duration: 30, windowStart: 9, windowEnd: 17, weekdaysOnly: true}`, `bookMeeting` (ownership check, insert, lead → `meeting`), `listMeetings`, `bookMeetingForLead`.
- Chat meeting flow in `lib/chat/*`: who (picker), when (quick replies), time slots, ask text, `book-meeting` job that books on Proceed.
- `lib/calendar.ts` + `app/calendar/*`: summary cards, week and month views.
- `components/NotificationsBell.tsx` (activity, 30 s poll, Clear all, per-row dismiss), `components/unread.ts` (localStorage `ast.seen:<email>`, 10 s poll, "99+"), `components/faviconBadge.ts` (red dot on the favicon), `lib/useLiveWork.ts` (3.5 s).
- `README.md` with setup, env and scripts. `AGENTS.md` for project instructions.
- Deploy: Vercel project, env vars from `01-prd.md` §8, Pro plan for the per-minute cron, region `sin1`, pgvector on.

**Rules**
- The calendar reads only the `meetings` table.
- Booking refuses a time outside the window, on a weekend when weekdays only, or in the past.

**Check (the final acceptance)**
- [ ] "book a meeting with Ana tomorrow 2pm" asks Proceed, then books it, and it shows on the calendar week view; "tomorrow 8pm" is refused.
- [ ] A message in a team you are not viewing shows an unread badge and a red dot on the tab.
- [ ] The bell shows new activity and Clear all empties it.
- [ ] On the deployed site, the landing page loads and Get started opens sign-up with the email filled in.
- [ ] On the deployed site, a chat search started and then the tab closed still finishes (cron).
- [ ] Every "done when" in `01-prd.md` §6 passes, and every check in `01-prd.md` §13.
