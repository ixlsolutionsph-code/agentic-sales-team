# PRD: Agentic Sales Team

| | |
|---|---|
| **Status** | Build spec, matches `origin/main` at PR #163 (commit `d3c6ff6`) |
| **Last updated** | 2026-11-17 |
| **Source** | The code on `main`. Where this file and the code disagree, the code wins |

---

## 1. Overview

Agentic Sales Team is a command center for a team of AI sales agents. The user does not operate a CRM by hand. The user creates **agents**, puts them into **teams**, and gives them work in plain English in a **team chat**.

The agents find leads on the public web (Facebook, Reddit, X and LinkedIn), check that each lead fits, research and score them, match them to the business's own product catalog, draft personal outreach emails and proposals, and book meetings. Work moves from one agent to the next on its own (**the chain**). Before each step the agent asks **Proceed or Cancel**, unless the user set that step to **Auto**.

**The product sends nothing.** Every email is a draft. The user opens it in their own mail app, sends it, and presses Mark sent.

There is **no seed or demo data** in the app. Every agent, team, lead and product is made by the user or by an agent.

---

## 2. Problem

- A small business owner or a solo seller has no time to find and write to new prospects. Finding leads, checking them, researching them and writing a first email are slow, repeated tasks.
- People pay for this work today: appointment setters and lead generation freelancers, or AI SDR tools priced for funded sales teams (hundreds to thousands of dollars a month).
- The product gives a small business a team of named agents in one chat, with a person approving each step.

---

## 3. Users

| Who | Role |
|---|---|
| **Business owner** (the only user) | Signs up, creates agents and teams, loads the catalog, talks to the team, approves steps, sends the emails |
| **Lead** | A prospect found on the web or imported. Never uses the product |

**One user per workspace.** There are no seats, roles or invites.

---

## 4. Goals and non-goals

**Goals**
- Run a whole sales funnel by talking to a team of agents in one chat.
- Find leads on the public web from one plain-English request, and show each step of the search live.
- Keep a person in control: each step asks Proceed or Cancel by default, and the product sends nothing.
- Ground every email, match and proposal in the business's real catalog.
- Show only real numbers.
- One pattern repeated: **a capability → one AI engine → one job kind → one step in the chain.**

**Non-goals** (see §12 for the full out-of-scope list)
- Sending email, DMs or follow-ups from the product.
- A mailbox, replies, bounces or sequences.
- CRM sync, payments or billing.
- More than one user in a workspace.

---

## 5. User stories

- As an owner, I sign up and get a first workspace, so my agents work only on my leads.
- As an owner with several businesses, I keep one workspace for each and switch between them.
- As an owner, I create an agent, pick its type and give it a goal.
- As an owner, I make a team from a template, and the product shows which required capability the team is missing and lets me create that agent in place.
- As an owner, I load my products from a CSV, so the agents write about what I really sell.
- As an owner, I type "find HR managers at hospitals in Manila" in the team chat. An agent asks for any missing detail, then searches.
- As an owner, I watch the search live and see which sources it dropped.
- As an owner, I let an Assessor accept the leads that fit, or I accept and dismiss them myself.
- As an owner, I see why each lead fits, in one line.
- As an owner, I approve each step with Proceed, or I set a step to Auto.
- As an owner, I press Cancel and get a summary of what the team did.
- As an owner, I review each drafted email, open it in my mail app, send it, and mark it sent.
- As an owner, I ask an agent to book a meeting "tomorrow 2pm", and it shows on my calendar.
- As an owner, I ask "any updates?" and the agent tells me what it really did.

---

## 6. Features (the closed scope)

Build all of these. Build nothing else.

| # | Feature | Done when |
|---|---|---|
| **F1** | **Get in.** Landing page, then sign up (full name, work email, password ≥ 8) or log in, on `/`. The first workspace is made on sign-up. Log out revokes every session | A new user signs up, logs out, logs back in, and lands on "Hire your first agent" |
| **F2** | **Workspaces.** Up to 10 per account, one per business. Each has its own agents, teams, leads, catalog and chats. Switch from the sidebar menu | A user creates a second workspace, switches to it, and sees none of the first workspace's data |
| **F3** | **Create an agent.** A 5-step full-screen wizard: Identity, Type, Appearance, Settings, Goal. 16 types are presets of 10 capabilities. 8 capabilities run; 2 are "soon" | The agent appears in `/agents` with its type, and a "soon" capability is flagged |
| **F4** | **Teams.** Create from 10 templates, pick members, see coverage of required capabilities, create a missing agent in place. Edit, add and remove members, delete | A Full-Cycle team shows ✓ for each covered capability and offers to create an agent for each gap |
| **F5** | **Team chat.** Talk to a team. `@mention` an agent or just say what you want. The product reads the intent and routes it to the agent that can do it (this team first, then another team). `/lead` picks leads by name. Agents answer questions from real team data | "@Maya find leads" goes to the Scout when Maya can't scrape, with a hand-off line; "any updates?" names the last real run |
| **F6** | **Find leads (Scout).** From one request, the agent asks for what is missing (product, who, where, how many ≤ 25), then searches the public web, drops sellers, competitors and job seekers, picks out leads with a one-line fit reason, and saves them as **pending**. A live timeline shows each step | A search shows its steps live and ends with "N new leads saved", and the leads appear in Leads → Pending |
| **F7** | **Review leads (Assessor).** The Assessor checks new leads against the agent and team goal and accepts or dismisses each with a reason. The user can also accept or dismiss one at a time or all at once | Accepted leads move to the book with a score and reason; dismissed leads keep their reason |
| **F8** | **The chain.** After each step the next team member with the next capability takes over: scrape → assess → research → qualify → match → outreach → proposal. Steps nobody covers are skipped. A step that moves no leads stops the chain and says why | With one agent for each step, one search ends with "the drafts are ready for you to review and send" |
| **F9** | **Approval gate.** Each capability of each agent is **Ask** (default) or **Auto**. Ask shows Proceed and Cancel; a typed "yes"/"no" also works. Cancel stops every waiting step of the team and posts a summary | No Ask step runs until Proceed; Cancel posts "Here's a summary of what we did:" |
| **F10** | **Products catalog.** Products in folders, added by hand or from a CSV (≤ 200 rows; extra columns become attributes). Each product is embedded for meaning search | A 20-row CSV imports into a folder, and a proposal names products from it |
| **F11** | **Emails.** Every draft in one list with To send, Sent and All. Open in mail (mailto) or Copy message, then Mark sent. Discard hides a draft | No email leaves the product; Mark sent moves the lead from `new` to `contacted` |
| **F12** | **Meetings and calendar.** Book from a lead or from chat in plain words ("next Tue 10am"), inside the agent's booking hours. The calendar shows only booked meetings, by week or month | "tomorrow 2pm" books inside the window; a time outside it, or in the past, is refused |
| **F13** | **Leads.** Active book and Pending queue; filter by agent and stage; add by hand; CSV import (≤ 500 rows); advance stage; delete with a second click; lead detail with fit, research, matches, drafts and Book a meeting | A CSV import adds accepted leads and skips duplicate emails |
| **F14** | **Keeping up.** Dashboard of agents and teams, an agent page per agent, a notifications bell, unread badges on chats, a red dot on the browser tab, counts on Leads and Emails, global search | A new message in a closed chat shows an unread badge and a dot on the tab |
| **F15** | **Limits.** Per account per rolling 24 h: 100 runs, 20 searches, 300 chat messages. Auth is rate-limited | Run 101 says "You've reached today's limit of 100 runs. Try again tomorrow." |

---

## 7. Behaviour spec

### 7.1 Capabilities, agent types and team templates

**Capabilities** (`lib/agentTypes.ts`). `jobKind` = `id`.

| id | Label | Runs? |
|---|---|---|
| `scrape` | Lead scraping | yes |
| `research` | Lead research | yes |
| `outreach` | Email drafting | yes |
| `follow-up` | Follow-ups | **soon** |
| `book-meeting` | Meeting booking | yes |
| `qualify` | Lead qualification | yes |
| `proposal` | Proposal drafting | yes |
| `enrich` | Contact enrichment | **soon** |
| `match` | Matchmaking | yes |
| `assess` | Lead assessment | yes |

**Agent types** (16):

| id | Label | Capabilities |
|---|---|---|
| `sdr` | SDR | research, scrape, outreach, follow-up, qualify |
| `bdr` | BDR | outreach, follow-up |
| `ae` | Account Executive | outreach, book-meeting, proposal |
| `csm` | Customer Success | follow-up |
| `recruiter` | Recruiter | scrape, outreach |
| `manager` | Sales Manager | (none) |
| `scout` | Lead Scout | scrape |
| `researcher` | Research Agent | research |
| `writer` | Outreach Writer | outreach |
| `followup` | Follow-up Agent | follow-up |
| `qualifier` | Lead Qualifier | qualify |
| `closer` | Closer | research, qualify, proposal, match |
| `matchmaker` | Matchmaker | match |
| `assessor` | Assessor | assess |
| `meeting` | Meeting Booker | book-meeting |
| `custom` | Custom | user picks any of the 10 |

**Team templates** (10). *Required* = the runnable capabilities of the template; "soon" ones are listed but not required.

| id | Label | Required | Soon |
|---|---|---|---|
| `outbound` | Outbound | scrape, outreach | follow-up |
| `leadgen` | Lead-Gen / Research | scrape | |
| `enterprise` | Enterprise / Named Accounts | outreach, book-meeting | |
| `fullcycle` | Full-Cycle Pod | scrape, outreach, book-meeting | follow-up |
| `nurture` | Nurture / Re-engagement | outreach | follow-up |
| `meetings` | Meeting-Booking / SDR→AE | outreach, book-meeting | |
| `recruitment` | Recruitment | scrape, outreach | |
| `success` | Customer Success | (none) | follow-up |
| `revenue` | Qualify → Propose | qualify, proposal | |
| `custom` | Custom | (none) | |

**Agent look:** 4 characters (0 Theo, 1 Pat, 2 Maya, 3 Sam), images `/agents/{theo,pat,maya,sam}.jpg`. Colour is always `#006AFF`. Initials = first letter of the first two words.

**Agent status is derived, not stored:** a live job → `working` with task "{capability label} · N leads"; paused → `waiting`, "Paused"; else `idle`, "Idle".

**Lead tier:** score ≥ 75 Hot, 50–74 Warm, 1–49 Cold, 0 = not scored.

### 7.2 The chain (pod)

```
scrape ──> assess ──> research ──> qualify ──> match ──> outreach ──> proposal
 Scout     Assessor   Researcher   Qualifier   Matchmaker  Writer      Closer
```

- Order: `POD_ORDER = [scrape, assess, research, qualify, match, outreach, proposal]`. Batch: 20 leads per stage.
- After a stage ends, `chainNext` finds the **next stage that a team member covers** and queues it for that member. If the same agent covers it: "Next, I'll do the {noun}." Else: "{done} @{Next}, please do the {noun}."
- After a scrape, the Assessor gets exactly the new lead ids. If the team has no Assessor, the user is asked to review them by hand.
- How each stage picks leads (from the team's pool, oldest first, unless lead ids are given):

| Stage | Picks |
|---|---|
| assess | `review = 'pending'` |
| research | accepted, `research IS NULL` |
| qualify | accepted, `qualified_at IS NULL` |
| match | accepted, `matched_at IS NULL` |
| outreach | accepted, no draft row at all |
| proposal | accepted, no proposal |

- **Stop rules:**
  - A stage that moves 0 leads stops the chain with a fixed "nothing to do" text. After a scrape or assess with 0 leads, the agent offers a **wider search** (widen the place to its last part, then "anywhere"; if already anywhere, double the count, max 25).
  - A stage with failed leads stops: "@{user}, I couldn't finish N lead(s) because of an error… I stopped the chain here."
  - Match with 0 matches does **not** stop: "I found no listings that match these leads, so I'll pass them on without matches."
  - An empty catalog skips match and stops before proposal: "Add products on the Products page."
  - If the user cancelled since the job started: "…but you stopped the run, so I didn't pass it on."
  - Paused or deleted agents get no steps.
- At the end the last agent @mentions the user with the final action, for example "the drafts are ready for you to review and send".

### 7.3 Lead search (scrape) pipeline

```
instruction ──> PLAN (LLM: mode, 3 queries, roles, platform)
            ──> SEARCH (Firecrawl /v2/search, up to 6 searches in parallel)
            ──> GATE (Gemini Flash-Lite per result: drop sellers / job seekers / competitors)
            ──> EXTRACT (LLM: pick target+5 leads with one-line fit)
            ──> SAVE (dedupe against team pool, stop at target, review = pending)
```

- **Instruction** sent to the engine: `"{what}. Selling: {product (desc)}. Location: {where}."`
- **Modes:**
  - **fit** (LinkedIn): when the request describes a company type or job role, or names LinkedIn. Searches `site:linkedin.com/company <q>` and `site:linkedin.com/in "<role>" <q>`.
  - **intent** (default): people who need something now. Queries in the buyer's voice, past month only (`tbs: "qdr:m"`), `site:facebook.com` and `site:reddit.com` (or the one platform named).
  - No AI: intent mode, one query `"<goal> looking to buy recommendations"`.
- **Per-search limit:** `max(4, min(target, 8))`. Firecrawl timeout 15 s. Only SERP title, description and URL are read; pages are not fetched.
- **Gate:** model `gemini-2.5-flash-lite`, temperature 0, ≤ 8 s per call, 16 at a time, 10 s total budget. Intent mode drops `seller` and `job_seeker`; fit mode drops `competitor: true`. **Fails open** (an error keeps the result).
- **Extraction rules:** match the buyer direction; a business's own job post for the role the product replaces counts as a buyer; staffing / VA / BPO agencies are sellers when the user sells staff; skip posts older than about a month; never invent emails; a LinkedIn person needs a real employer (not Shopify, Amazon, Etsy, Self-employed, Freelance, Confidential…); exclude recruiters, directories, articles and job boards. Fit reason: one line under 20 words. Corpus cap 40 000 chars.
- **Save:** skip any lead whose profile URL or email is already in the team's pool; stop at the target; `status=new, score=0, source=scrape, review=pending`. `profile_url` must be one of the URLs Firecrawl returned and must be http(s).
- **Timeline:** stored in `jobs.result.steps` as `{id, status: active|done, label, detail?, items?[{title, meta, url?, kind: source|dropped|done|failed}], more?}`. Step ids: `plan, search, gate, extract, save` (scrape) and `pick, work` (other stages). Show at most 6 sources, 3 dropped, 8 items per step. Summary line: "N sources · N dropped · N leads".
- **Time limits:** scrape deadline 45 s; route `maxDuration = 60`.

### 7.4 Team chat

**Storage:** `messages` rows with `agent_id = teamId`; `who` = `me`, `system` or the speaking agent's id. Cards are hidden `⟦…⟧` markers in the text (see `04-erd.md` §3.3).

**Server entry** `teamChat(teamId, message, leadIds?, timeZone?)`:
1. Over 2000 chars → "That message is too long. Keep it under 2000 characters." (not stored).
2. Over 300 user messages in 24 h (account-wide) → "You've reached today's limit of 300 messages. Try again tomorrow."
3. If an `⟦approve⟧` ask is open and the reply is a short yes/no (≤ 40 chars) → Proceed or Cancel that step.
4. Else `reply()`:
   - A "no" to an agent's offer → "Okay. Just ask when you need me."
   - A question while the agent's own question is open → answer it (converse), then post the open question again so its card stays.
   - An answer to an open question (meeting time, meeting who, search brief, outreach who) → continue that flow.
   - Else detect intent and route.
5. An empty result → "No one picked that up. Try @mentioning an agent on this team."

**Intent** (`detectIntent`): one of `scrape, research, outreach, follow-up, book-meeting, qualify, proposal, enrich, match, assess, status, chat, unknown`, with `{industry, titles, geo, target}`. LLM at temperature 0.2. With no AI: a keyword fallback (status → question → search start → rules in order book-meeting, follow-up, proposal, qualify, enrich, match, assess, research, outreach, scrape).

**Routing:**

| Case | Reply |
|---|---|
| status | The agent describes its latest real job (running, waiting, failed, done) |
| chat / unknown | The mentioned agent, else the last speaker, else the first member answers in character from team data |
| Mentioned agent has the capability | It acts: "Understood. I'm {verb} now ({summary})." |
| Mentioned agent lacks it, a teammate has it | "This needs {cap}. That is the area of @{First}, not mine. I am sending this to them." |
| Nobody on the team has it, another team does | "No one on this team does {cap}. @{First} does. I am sending this to them." |
| Nobody has it | "No agent can {cap} yet. Create an agent with that capability, and I will send requests to it." |
| "soon" capability | "{Label} isn't available yet, so I'm unable to run it at the moment." |

**Search brief** (asked before every chat search):
- Fields in order: **product** (only if the catalog has more than one product), **what** (the buyer), **where**, **count** (≤ 25).
- After 2 asks: where = "anywhere", count = 10, product = "Any product". **"What" is never guessed.**
- No products → the agent asks the user to add some first. Exactly one product → chosen for them.
- "look for more" reuses the last what and where and asks only for the count.
- Then: "I'm ready to search: • For … • Looking for … • Where … • How many: N leads. Proceed?"

**Meetings in chat:** who? → a picker of the team's accepted leads with no meeting, best score first (≤ 10); when? → quick replies "Tomorrow 10 AM", "Tomorrow 2 PM", "Next Monday 10 AM"; day without a time → up to 6 hourly slots in the booking window (skip 12). Then "I'm ready to book a {type} with {names} on {label}. Proceed?"

**Outreach in chat:** "Who would you like me to write to? You can name the leads, or tell me to reach everyone in the book." with a picker of up to 50 open leads.

**Converse** (questions): last 10 messages, persona with name, role, goal, capabilities and teammates; team facts (counts by review and tier, drafts, proposals, meetings, top 8 leads, leads named in the question), capped at 3000 chars; 2–4 sentences, no emojis, ends with an offer when an action fits.

**Pacing** (client): first reply no sooner than **2000 ms** after send; same speaker typing 1000 ms; new speaker typing 2000 ms; pause before the dots 1000 ms (new speaker) or 400 ms (same). Replies show one at a time behind typing dots. History loads with no delay.

**Polling:** thread every **4000 ms** (by id cursor) plus pending approvals; search timeline every 1200 ms (stop after 3 min); live work 3500 ms; unread every 10 s; nav counts and bell every 30 s. A followed job polls every 2.5 s × 40, then posts "Still working on it in the background. The result will appear here when it's done." and polls every 15 s × 40.

### 7.5 Jobs and the approval gate

- **Job kinds:** `scrape, assess, research, qualify, match, outreach, proposal, book-meeting`. `book-meeting` has no runner; it books when the user presses Proceed.
- **Statuses:** `needs_approval → queued → running → done | failed`; Cancel sets `dismissed`.
- **Enqueue checks**, in order: agent not paused or removed ("This agent is paused or no longer exists."); capability belongs to the agent ("This agent can't run {kind}."); AI configured for AI kinds; ≤ 25 lead ids; instruction ≤ 500 chars; quota.
- **Ask/Auto:** `agent_config.settings[cap].mode`. Only `"auto"` is Auto. Ask creates the job as `needs_approval` and posts the ask with `⟦approve:id⟧`. Proceed → `queued`; then the client calls the runner.
- **Cancel:** this job and every other `needs_approval` or `queued` job of the team → `dismissed`. A running step finishes but hands nothing on. Summary: "Okay, stopping now. Here's a summary of what we did:" + one line per job ("• Sam found 8 leads"). With nothing done: "Okay, stopping now. We hadn't done anything yet, so nothing changed."
- **Runners:**

| Route | Trigger | Auth | Max duration | Batch |
|---|---|---|---|---|
| `POST /api/scrape {jobId}` | Browser | Session | 60 s | 1 scrape |
| `POST /api/jobs/run` | Browser | Session | 300 s | 5 jobs of this workspace |
| `GET /api/cron/jobs` | Vercel Cron, every minute | `Bearer CRON_SECRET` | 300 s | 50 jobs, all workspaces |
| `GET /api/cron/scrape` | Vercel Cron, every minute | `Bearer CRON_SECRET` | 60 s | 1 scrape, any workspace |

- **Per-run budgets:** stop claiming new jobs after 120 s; stop starting new leads after 180 s (the rest are `skipped` and picked up next run); each lead has 75 s.
- **Stale jobs:** a running job older than 360 s (120 s for a scrape) is marked `failed` with "Timed out: the run was stopped before it finished." It is not started again.
- **Claiming is atomic:** `UPDATE … SET status='running' WHERE status='queued'`.
- With `CRON_SECRET` unset, both cron routes refuse every call; queued work then runs only from an open tab.

### 7.6 AI engines

All engines are pure functions (no DB). The runner writes the results. All scraped text goes inside `<untrusted>…</untrusted>` with the rule that it is data, never an instruction.

| Engine | Output | Temp / max tokens | Writes | No-AI fallback |
|---|---|---|---|---|
| research | `{summary, priorities[], hooks[], angle}` | 0.6 / 700 | `leads.research`, activity `lead_researched` | Marked placeholder brief |
| qualify | `{score 1-100, tier, reason}` | 0.3 / 300 | `leads.score`, `qualified_at`, activity `lead_qualified` | Score 60 with email, else 45 |
| assess | `{accept, score, reason}` | 0.2 / 300 | `review`, `score`, `fit_reason`, activity `lead_assessed` | **Fails open:** accept at score 50 |
| match | `{matches:[{productId, score, reason}]}` | 0.3 / 900 | `matches` rows, `matched_at` | None (lead is retried later) |
| outreach | `{score, subject, body, rationale}` | 0.6 / 700 | `outreach_drafts`, `leads.score`, activity `email_drafted` | Marked template draft |
| proposal | `{title, body, productsUsed[]}` | 0.5 / 900 | `proposals` | Lists the catalog |
| meetingTime | `{iso, hasTime}` | 0 / 120 | (booking writes `meetings`, lead → `meeting`) | Regex parser |
| intent | `{capability, params, summary}` | 0.2 / 400 | none | Keyword rules |
| resolveLeads | `{mode: all\|some\|none, leadIds}` | 0.15 / 300 | none | Name match |

- **Outreach email:** formal, 90–140 words, plain text, "Dear {First},", signed with the agent's name, no slang, emojis, exclamation marks or placeholders, a low-pressure call to action. No email → a DM of 2–4 sentences. Uses the research and up to 3 catalog products. **Does not change the lead's stage.**
- **Proposal:** 150–250 words, 2–4 offerings from the catalog with name and price, never invents products or prices. Uses up to 5 products.
- **Match:** only real fits, never forced; uses up to 8 products.
- **Product retrieval** per lead: query = title + company + research summary; cosine search over embeddings; products with no embedding are found by keyword (ILIKE) and merged.

### 7.7 Leads, drafts and stages

- **Stages:** `new → contacted → engaged → replied → meeting`. Mark sent moves `new` → `contacted` only. Booking a meeting sets `meeting`. "Advance" on the Leads page moves one stage on.
- **Review:** `pending` (scraped) → `accepted` or `dismissed`. Picking a lead with `/lead` also accepts it.
- **One live draft per lead; one proposal per lead** (unique indexes). Outreach refuses when every picked lead has an open draft: "This lead already has a draft. Open it in Emails."
- **Lead CSV:** ≤ 500 rows; header aliases for name, email, title and company; no name → the email's local part; dedupe by lower-case email against **this agent's** leads; rows are `accepted`, `source=import`.
- **Activity types:** `lead_added`, `lead_assessed`, `lead_researched`, `lead_qualified`, `email_drafted`, `email_sent`.

### 7.8 Limits and errors

| Limit | Value | Message |
|---|---|---|
| Runs per account per 24 h | 100 | "You've reached today's limit of 100 runs. Try again tomorrow." |
| Searches per account per 24 h | 20 | "You've reached today's limit of 20 lead searches. Try again tomorrow." |
| Chat messages per account per 24 h | 300 | "You've reached today's limit of 300 messages. Try again tomorrow." |
| Leads per run | 25 (pod uses 20, default 5) | "Pick at most 25 leads at a time." |
| Search target | 1–25 (default 10) | |
| Search instruction | 500 chars | "Keep the search request under 500 characters." |
| Chat message | 2000 chars | "That message is too long. Keep it under 2000 characters." |
| Workspaces | 10, name ≤ 80 chars | "You can have up to 10 workspaces." |
| Product CSV | 200 rows | |
| Lead CSV | 500 rows | |
| Sign-in | 20 / 15 min per IP, 5 / 15 min per email | "Too many attempts. Try again in N minutes." |
| Sign-up | 5 / h per IP and per email | same |
| Reset request | 5 / h per IP, 3 / h per email | same |

| Situation | Message |
|---|---|
| Search failed | "That search didn't complete. Please try again." |
| Other run failed | "That run didn't complete. Please check the agent's page." |
| No AI key | "AI isn't set up on this server, so I can't do that. Ask your admin to add the Gemini API key." |
| Search not configured | "Lead search isn't set up on this server yet…" |
| Wrong sign-in | "Incorrect email or password." (never says which) |
| Sign-up refused | "We couldn't create an account with these details. If you already have one, sign in instead." |
| Server unreachable | "Couldn't reach the server. Check your connection and try again." |

The full server error goes only to the server log. Users see the fixed text.

---

## 8. Tech stack

Use these exact versions.

| Layer | Choice |
|---|---|
| Framework | **Next.js `14.2.35`** (App Router), **React `18.3.1`**, **TypeScript `5.5.3`** |
| Package manager | **pnpm `11.3.0`**, Node 18.17+ or 20+ |
| Database | **Neon Postgres** via `@neondatabase/serverless` `^1.1.0` (HTTP driver, pooled URL) |
| ORM | **Drizzle ORM** `^0.45.2`, **drizzle-kit** `^0.31.10`, custom migration runner `scripts/migrate.mjs` |
| Vector search | **pgvector**, `vector(768)`, HNSW cosine index |
| Auth | **jose** `^6.2.3` (HS256 JWT in cookie `session`, 30 days), **bcryptjs** `^3.0.3` (cost 10) |
| AI (text, JSON) | **Google Gemini API** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, header `x-goog-api-key`, raw `fetch`, no SDK. Model **`gemini-2.5-flash`** (override `GEMINI_MODEL`). Thinking off (`generationConfig.thinkingConfig.thinkingBudget: 0`). JSON via `generationConfig.responseMimeType: "application/json"` + `responseSchema`. System prompt in `systemInstruction`. 30 s timeout, no retries |
| AI (gate) | Gemini **`gemini-2.5-flash-lite`** |
| AI (embeddings) | Gemini **`gemini-embedding-001`** via `:batchEmbedContents`, `outputDimensionality: 768`, unit-normalised, batches of 100, 20 s timeout |
| Lead search | **Firecrawl** `POST https://api.firecrawl.dev/v2/search` |
| Animation | **GSAP** `^3.15.0` + ScrollTrigger (landing page only) |
| Server-only guard | `server-only` `^0.0.1` |
| Tests | **Vitest** `4.1.12` |
| Lint | ESLint `8.57.1`, `eslint-config-next` `14.2.35` |
| Hosting | **Vercel**, region **`sin1`**, Vercel Cron every minute (needs the Pro plan) |
| Fonts | Inter, JetBrains Mono (Google), General Sans (Fontshare, headings); app shell uses the system SF stack; Lucide icon font subset |

**No other runtime dependencies.** No UI kit, no Tailwind, no state library. Styles are inline style objects plus `app/globals.css`.

**Environment variables**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string |
| `AUTH_SECRET` | yes in production | Signs session cookies. Dev fallback `dev-insecure-secret-change-me` |
| `GEMINI_API_KEY` | for AI | From Google AI Studio. Without it, engines return fallbacks and AI job kinds are refused |
| `GEMINI_MODEL` | no | Override the chat model |
| `FIRECRAWL_API_KEY` | for search | Without it, chat search says it is not set up |
| `CRON_SECRET` | yes in production | Bearer token for `/api/cron/*`. Unset = refuse all |

The app boots and is usable with no AI key and no Firecrawl key.

**Code structure rule:** real logic lives in `server-only` modules that take an explicit workspace id. Thin `"use server"` action modules read the session and call them. Client components import only the actions. Server pages fetch initial data and pass it to a `*Client.tsx` component.

---

## 9. Non-functional requirements

- **Isolation:** every query filters on the active workspace id. The `ws` cookie is honoured only if the account owns that workspace.
- **Sessions:** `users.session_version` is in every token; log out and password reset add 1 and revoke every old session. Middleware checks the signature; `getSession` checks the version.
- **Untrusted content:** scraped and lead text is cleaned (control, zero-width and bidi characters removed) and fenced before any prompt. Field caps: name 120, title 300, company 160, email 254, fit 300.
- **URLs:** only http(s) profile URLs are stored; links open with `noopener`.
- **Transactions:** multi-step writes (Mark sent, outreach result) run in one transaction.
- **Rate limiting fails open** if the database errors.
- **Accessibility:** keyboard focus ring `2px #006AFF`, focus trap in modals and the mobile drawer, reduced motion honoured.
- **Mobile:** breakpoint 767 px; the sidebar becomes a drawer.

---

## 10. Design system

| Token | Value |
|---|---|
| Primary blue | `#006AFF` (hover `#0052CC`), tint `#EAF2FF` / `#E6F0FF` |
| Ink | `#18181B` / `#101418` (black primary buttons, hover `#2a313b`) |
| Page background | `#FAFAFB`; app content `#f9fafb`; chat and chat home white |
| Sidebar | 272 px, `#f6f7f9`, border `#eceef1`; collapses to a 64 px rail |
| Greys | `#71717A` (muted text), `#6b7686`, `#8a94a3`, `#e3e7ed`, `#f1f3f6` |
| Success / warning / error | `#1B7A3D` on `#E7F7EC` / `#B45309` on `#FEF6E8` / `#B91C1C` on `#FEECEC` |
| Accent | `#F43F7E` (bell badge) |
| Brand gradient | `#0047b3 → #0058e6 → #006aff → #4b92ff → #6ea8ff` (auth and landing) |
| Radius | pills 999, cards 16, modals 18, composer 24, chat bubbles 20 with a 6 px tail corner |
| Chat bubbles | mine `#006aff` white text; agent `#f1f3f6`; system centred grey line |
| Toast | bottom centre; success `#18181B` 2600 ms; error `#991B1B` 4500 ms |
| Header | 60 px, title in General Sans 20/500, right: bell + black "+ Add agent" pill |

---

## 11. Built as-is (copy these, do not "fix" them)

These are known facts of the current product. Build them the same way, so the rebuild matches.

- **Self-serve password reset is off.** "Forgot password?" always says "Self-serve password reset isn't available yet. If an account exists for that email, contact support and we'll reset it for you." `/reset` exists and works with a token, but nothing creates tokens.
- **The landing page is scripted marketing.** It shows "Trusted by 1,200+ sales teams", the mock agents Theo, Pat, Maya and Sam, replies, follow-ups and plans (Starter, Growth, Enterprise) with no prices. Every plan button opens sign-up. Footer links go nowhere.
- **Assessment fails open** without AI (accept at score 50).
- **Mark sent is manual.** The product cannot see the user's mailbox.
- **`agent_config.permissions` and `job_steps` exist but are unused.**
- **Agent delete on the agent page has no confirm;** on `/agents` it needs a second click.
- **Team chat history is kept when a team is deleted.**

---

## 12. Out of scope

Do not build any of these.

- Sending email, DMs or follow-ups; a mailbox; reply or bounce tracking; sequences.
- Follow-ups and Contact enrichment engines (they stay "soon").
- CRM sync, billing, payments, pricing on the plans.
- Multiple users per workspace, roles, invites.
- Self-serve password reset emails.
- `/privacy`, `/terms`, a `/teams` list page (teams are on the dashboard), an analytics page.
- A bookmarkable link to one chat (`/chats` opens the team held in memory).
- Seed or demo data inside the app.
- Browser-based scraping (the old `job_steps` worker).

---

## 13. Success checks for the rebuild

The rebuild is the same product when all of these pass:

1. Every F1–F15 "done when" in §6 passes.
2. The database matches `04-erd.md` exactly (names, types, defaults, indexes).
3. Every page and route in `02-sitemap.md` exists with the listed states.
4. Journeys J1–J10 in `03-user-journey.md` run with the listed messages.
5. With no `GEMINI_API_KEY` and no `FIRECRAWL_API_KEY`, the app still boots, signs up, creates agents and teams, and shows the "not set up" messages.
