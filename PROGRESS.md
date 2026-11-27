# Progress

Where the build is, so a new session can pick up. Talk to the owner as `AGENTS.md` says.

## Done

- **Milestone 1: landing page.** Uses the Spectrum look in `DESIGN.md` (not the blue in `01-prd.md` §10).
  The "Trusted by 1,200+ sales teams" badge was removed at the owner's request.
- **Milestone 2: database, accounts and workspaces.** Finished and checked against the owner's Neon
  database (Singapore, `ap-southeast-1`) on 2026-11-24.
  - `pnpm db:migrate` says "Nothing to apply. The database is up to date." All tables and the
    special indexes are there.
  - Every check in `05-build-guide.md` M2 passed: sign up, log out, log back in, old cookie rejected,
    duplicate sign-up message, 6th wrong password blocked, switch workspaces, forged `ws` cookie
    ignored, 11th workspace refused, `/dashboard` redirects when signed out.
  - Also checked: Settings (both fields save on blur; empty name refused) and `/reset` (bad link,
    short or mismatched password, good link changes the password and ends old sessions, link
    can't be reused). All 27 unit tests pass.
  - The test accounts were deleted afterwards. Only the owner's own account is in the database.
- **Milestone 3: app shell and client store.** Finished and checked on 2026-11-25; the owner approved it.
  - `AppFrame` (landing / `/reset` bare / `/create` bare / shell), `Shell` (272 px sidebar, 64 px
    rail, phone drawer with focus trap, 60 px header, account menu, bell with an empty panel,
    "+ Add agent"), `WorkspaceSwitcher`, `Modal`, `Toast`, `primitives`, `lib/store.tsx`
    (hydrated in `app/layout.tsx`), `lib/workspace/{load,shape,actions}.ts` (`loadWorkspace`),
    `useConfirmClick`, empty pages, `app/error.tsx`, `app/global-error.tsx`.
  - All three M3 checks passed in the browser, plus workspace isolation of the loader. 61 unit
    tests, lint and `pnpm build` pass. Test accounts deleted.
  - Signed-in pages call `requireUser()` (`lib/auth/guard.ts`); `AppFrame` also sends a signed-out
    visitor on any other path to `/` (an old cookie passes middleware).
  - The "Saved" toast bug is fixed: toasts now come from the store, one timer per toast.
  - Until M9, `/` shows the "Hire your first agent" state. The calendar shows an empty week grid
    until M10. The Create a team modal has only the name field until M5.
  - "+ Add agent" is Spectrum blue (DESIGN.md), not the black in `02-sitemap.md`.

- **Milestone 4: agents.** Finished and checked on 2026-11-25; the owner tried it and approved it.
  - `lib/agentTypes.ts` (10 capabilities, 16 types, 10 templates, `isEngineReady`,
    `parseMeetingMinutes` 5–480), `lib/visuals.ts`, `lib/agents/{new,settings,derive,stats,
    sections,storeOps,store}.ts`, actions `saveAgent`, `saveAgentConfig` (partial upsert,
    settings merge per capability), `setAgentPaused`, `removeAgent` (soft delete) in
    `lib/workspace/actions.ts`, and store actions `createAgent`, `setAgentPaused`, `removeAgent`,
    `saveAgentConfig`.
  - Pages: `/create` (5-step wizard + success screen), `/agents` (cards, two-click delete),
    `/agents/[id]` (header, sticky tabs by capability, empty sections, Configuration, Ask/Auto).
  - All five M4 checks passed in the browser and in the database. 97 unit tests, lint and
    `pnpm build` pass. Test account deleted.
  - Ask/Auto is in `agent_config.settings[cap].mode`; `permissions` stays unused (null).
  - Status shows Idle/Paused until jobs exist (M7). Sections have empty states; run buttons come
    in M7–M8. Wording written where the docs give none: section empty texts, the wizard's
    scrape and "Coming soon" notes, the meeting-length and end-time errors, "resumed" and
    "deleted" toasts.
  - Fixed: "Recent chats" no longer links to `/chats?team=…`; the team is held in the store
    (`activeChatTeam`), as `01-prd.md` §12 asks.
  - The owner's account has a real agent and a second workspace they made; keep them.

- **Milestone 5: teams and the dashboard.** Finished and checked on 2026-11-25; the owner tried it and approved it.
  - `lib/teams/{new,membership,store}.ts` (`newTeamId` "tx…", 6 icons with tints, `coverage`, `gaps`,
    `gapAgentType`, `checkNewTeam`, `membersOfTeam`, `teamsOfAgent`, `teammatesOf`, `leadPoolOf`),
    `lib/workspace/{stats,statsShape}.ts` (`getWorkspaceStats`, `getTeamLeads`), `lib/useWorkspaceStats.ts`.
  - Actions `saveTeam`, `editTeam`, `saveTeamMembers` (full list upserted into `team_members`),
    `deleteTeam` (removes `teams` + `team_members`, keeps messages), `loadStats`, `loadTeamLeads`;
    store actions `createTeam`, `editTeam`, `setTeamMembers`, `deleteTeam`.
  - `components/CreateTeamModal.tsx` (name, icon, template, members, ✓/○ coverage, gap quick-create,
    shared goal), `components/teams/TeamBits.tsx`, `/teams/[id]` (`TeamDetail.tsx`: KPIs, Working now,
    coverage, members with ×, first 12 leads, goal, recent activity, Edit / Add agents / Delete team),
    `/dashboard` (`HomeClient.tsx`: greeting, hub with team pills, ring of up to 8 agents, team cards).
  - `teamKpis` now works from the members' accepted leads (never the legacy `teams` counters);
    In pipeline = contacted, engaged or replied.
  - All three M5 checks passed in the browser and in the database (also with sample leads, a meeting
    and an activity row in a test account, since deleted). 115 unit tests, lint and `pnpm build` pass.
  - Choices where the docs are silent: a proposal gap creates a Custom agent named "Proposal Agent";
    "leads worked this month" counts accepted leads updated this month (browser's time zone);
    wording "Nobody is working right now.", "No activity yet.", "No agents yet. You can create the
    ones this team needs below."
  - Modals now keep their title and buttons in view; only the middle scrolls.
  - Pending approvals on the team page come in M9. `/chats` still shows "No conversations yet" until
    M9; the owner chose to leave it.
  - The owner's account now also has a real team and a second agent made from a gap; keep them.

- **Milestone 6: catalog, leads and the AI transport.** Finished and checked on 2026-11-26.
  - `lib/ai/{gemini,geminiShape,untrusted,vector}.ts` (raw fetch, no SDK, no retries; embeddings
    `gemini-embedding-001`, 768 dims, normalised; `aiEmbedBatch` never throws), `lib/csv.ts` (own CSV
    reader, no extra package), `lib/url/safeUrl.ts` (http(s) only, `platformOf`).
  - Products: `lib/products/{shape,store,actions}.ts` (folders with ownership check, add, CSV ≤ 200 with
    aliases and extra columns → `attributes`, move, delete, `searchProducts` = cosine + keyword merge,
    `reembedProducts`), `/products` (`ProductsClient.tsx`). Opening Products fills missing embeddings.
  - Leads: `lib/leads/{types,store,actions}.ts` (`LEAD_STAGES`, add, CSV ≤ 500 with per-agent email
    dedupe, advance, accept / dismiss / all, hard delete, `listWorkbook`, `listLeadsForAgents`,
    `knownLeadKeys`, nav counts, lead extras), `/leads` (`LeadsClient.tsx`: Active / Pending, filters,
    modals, lead details). Activity `lead_added` on add and import.
  - Search: `lib/search/{local,store,actions}.ts`, `components/GlobalSearch.tsx` (leads and products from
    the server, 2+ chars, 200 ms). Sidebar badges: `lib/useNavCounts.ts` (30 s, focus, page change).
  - All four M6 checks passed in the browser and the database with the owner's Gemini key (20-row CSV
    with `location` → all embedded; meaning search, and keyword search with the key hidden; duplicate
    email skipped; search finds a lead by company). 138 unit tests, lint and `pnpm build` pass. Test
    account deleted.
  - Choices where the docs are silent: keyword search skips common words and ranks by words matched;
    lead CSV rows with no valid email are skipped; extra wording ("Skipped N rows…", "No leads match
    these filters.", "Create an agent first…", the lead details window's empty texts).
  - Sample files for the owner are in `Downloads/MD Files - Building Your Agentic Sales Team/Sample files/`.

- **Milestone 7: jobs, engines and emails.** Finished and checked on 2026-11-26; all six checks pass
  and the owner approved it. 172 unit tests, lint and `pnpm build` pass.
  - Built: `lib/jobs/{limits,errors,runtime,store,context,enqueue,drain,tasks,actions}.ts`,
    `lib/scrape/steps.ts`, engines `lib/ai/{engine,research,qualify,assess,match,outreach,proposal}.ts`,
    `lib/leads/{apply,fit}.ts`, `lib/emails/{store,actions,mailto}.ts`, `lib/cron/auth.ts`,
    `app/api/jobs/run`, `app/api/cron/jobs`, `app/api/cron/scrape` (secret check only until M8),
    `vercel.json`, agent page run buttons + Tasks + Performance (`AgentWork.tsx`, `lib/useAgentWork.ts`),
    Run outreach on the Leads page, `/emails` (`EmailsClient.tsx`, `components/emails/DraftActions.tsx`).
  - `CRON_SECRET` was generated and added to `.env.local`.
  - Checks passed: 2 (6 simultaneous outreach saves → 1 open draft per lead), 3 (Mark sent → contacted;
    Discard hides, counts stay), 4 (101st run refused with the exact text), 5 (cron 401 without / with a
    wrong secret; with it, it drained a queued job), 6 (no key → "AI isn't set up…").
  - **Check 1 passed** (Research → Qualify → Run outreach → Generate proposals on 5 leads): 5 briefs,
    5 scores (85, 85, 85, 65, and 5 for the off-target software lead), 5 emails (120–135 words, "Dear …",
    real catalog products, no "!"), 5 proposals (144–196 words, 2–4 real products each, every price
    exactly as in the catalog). The test account was deleted afterwards; nothing was left behind.
  - Gemini's free tier allows only **20 requests a day** for `gemini-3-flash` per Google project, and
    some answers take 13 s or more (a few hit the 30 s limit and show "Failed"; a re-run picks them
    up). The owner has made three keys; the third (in `.env.local` now) finished the checks.
  - Changed after M7 at the owner's request (2026-11-26): the writing never mentions AI, bots or
    "agents" (`SYSTEM_BASE` now says "write as a member of the team"), and emails and proposals are
    laid out as letters ("Dear …," line, 3–4 short paragraphs, sign-off and name on their own lines)
    by a prompt rule plus `layoutLetter` / `toParagraphs` in `lib/ai/engine.ts`. Checked with real
    Gemini: 2 proposals (168 and 173 words) and 1 email (123 words), all laid out, real products and
    prices, no AI mention. 177 unit tests pass.
  - Fixed while finishing check 1: with Gemini 3 models, `thinkingBudget: 0` sometimes stalled past
    30 s; `thinkingOff(model)` now sends `thinkingLevel: "minimal"` for Gemini 3+ (about 1.3 s) and
    keeps `thinkingBudget: 0` for 2.5. Emails written as one block now get the greeting and sign-off
    on their own lines (prompt rule + `tidyBody`). 172 unit tests pass.
  - Fixed while testing: the stale-job reaper sent its time limit as text (Postgres error), and the
    cron GET answer was being cached by Next (now `revalidate = 0`, `fetchCache = "force-no-store"`).
    An open agent page re-nudges the runner every 15 s while a run waits.
  - Choices where the docs are silent: pressing a run button on the agent page is the go-ahead (the
    job is queued, not `needs_approval`; Ask/Proceed in chat is M9); a run picks from the agent's team
    pool, 5 leads by default; matches below 50 are dropped; the Leads page "Run outreach" uses the
    lead's own agent, else the first teammate that drafts emails; Discard and Clear sent ask for a
    second click; activity texts ("{agent} researched {lead}", "{agent} scored {lead} 85 (Hot)",
    "{agent} drafted an email to {lead}", "Email to {lead} marked as sent").

- **Milestone 8: lead search.** Built and checked on 2026-11-27; all five checks pass. 192 unit tests, lint
  and `pnpm build` pass.
  - Built: `lib/scrape/{firecrawl,gate,rules}.ts` (plan → Firecrawl `/v2/search` → gate → extract → normalise),
    `lib/jobs/scrape.ts` (runner with the 45 s deadline, `addScrapedLeads`, `runScrapeNow`, `drainScrape`),
    `claimJobById` / `getJob` in `lib/jobs/store.ts`, `app/api/scrape` and the real `app/api/cron/scrape`,
    actions `startSearch` and `getScrapeProgress`, `app/chats/ScrapeProgress.tsx` (live timeline, 1.2 s poll,
    stops at 3 min), `app/agents/[id]/FindLeads.tsx` (browser prompt, target 10, runs at once).
  - Gate model: **`gemini-3.5-flash-lite`** (`GATE_MODEL` in `lib/scrape/gate.ts`). `gemini-2.5-flash-lite`
    answers 404 "no longer available to new users" and Google points to 3.5 Flash-Lite (about 1.2 s).
  - `FIRECRAWL_API_KEY` is in `.env.local` (free plan: 1,000 credits a month; one search uses about 12).
    Each Firecrawl search took 9–12 s; a whole lead search took 20–25 s.
  - Checks (test account, since deleted): "HR managers at hospitals in Manila" (fit) saved 10 pending
    LinkedIn leads, each with a fit line; running it again saved 2 new ones and no duplicates; "people
    looking for a virtual assistant in Texas" (intent) saved 2 (most Facebook results are VA sellers, which
    the gate drops); the timeline shows plan, search, gate with dropped sources, extract, save; with no
    Firecrawl key the job fails with "Lead search isn't set up…"; the 21st search in 24 h is refused.
  - Choices where the docs are silent: the agent's goal is added to the request; sources the team already
    has are left out before extraction (so a repeat search finds new people); the gate also gets the job-post
    and agency rules, and is told a company of the kind we look for is never a competitor; extraction keeps
    a post that doesn't say where the person is; with no AI each search result becomes a pending lead; leads
    belong to the Scout (`leadOwnerForTeam`); activity text "{agent} found N new leads"; the messages "Tell
    me what leads to look for.", key refused, out of credits, and search down.
  - Only search result titles, descriptions and links are read; pages are never fetched. A lead's link is
    always one of Firecrawl's results, and an email is kept only when it is written in that result.

- **Milestone 9: team chat and the chain.** Built and checked on 2026-11-27 (built in parallel by three
  helpers: relay `lib/pod/*`, chat brain `lib/chat/*` + `lib/ai/{intent,resolveLeads}.ts`, screens
  `app/chats/*`, `app/ChatHome.tsx`, `lib/useTeamChat.ts`, team page approvals, sidebar unread). 290 unit
  tests, lint and `pnpm build` pass. The owner now has paid Gemini credits.
  - Shared pieces: `lib/chat/markers.ts` (⟦kind:payload⟧ cards), `lib/chat/teamMessages.ts`,
    `lib/chat/contract.ts`, `lib/pod/types.ts`. Runners call `chainAfterRun` after each pod job.
  - Checked live (7-agent test team, since deleted): search card → Proceed → live timeline → Assessor
    hand-off with Proceed → Cancel at research posts the summary; with every skill on Auto the chain ran
    research → scoring → matching → 5 emails → 5 proposals and ended "@You, the proposals are ready for you
    to review and send."; "@Maya find leads" handed to the Scout; "any updates?" and "how many hot leads?"
    answered from data; a search with no fit stopped and offered a wider search; message 301 refused.
  - Fixed while testing: a vague "find leads" no longer fills "who" with "leads" (`isVagueWhat`); chat
    searches no longer add the agent's goal to the request; a typed "stop" right after a step finished now
    stops the hand-off too (`flagRecentRunJobs` + a re-check in `chainNext`); hidden labels stretched the
    chat page (`.chat-scroll` is now `position: relative`).
  - Meetings in chat are answered as "not available yet" until Milestone 10. Run state: a run is the
    jobs sharing `params.runId`; Cancel flags running steps `stopped`, Clear chat flags them `cleared`.
  - Known small things: a refused message (daily limit) stays on screen until reload; a name pill's
    padding looks like a space before a following comma.

## Next

- **Milestone 10: meetings, notifications and going live.** Wait for the owner to say go. It needs a
  Vercel account (tell the owner the cost first).

## Running it on the owner's Windows computer

- The app runs locally from a folder outside OneDrive. `.env.local` there has `AUTH_SECRET`,
  `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CRON_SECRET` and `FIRECRAWL_API_KEY` (never print
  or commit it).
- Start it with `pnpm.cmd dev` (PowerShell blocks the plain `pnpm` script), then open
  http://localhost:3000.
- Node.js is v26, which has no `corepack`. pnpm 11.3.0 was installed with `npm.cmd install -g`.
- Do not run `pnpm build` while `pnpm dev` is running: stop dev, build, delete `.next`, then start
  dev again. Mixing the two left files that crashed dev with "Invalid hook call".

## Notes

- `04-erd.md` says "19 tables" but lists 20. The database has the 20 listed, which matches the code.
- Self-serve password reset is off on purpose: "Forgot password?" shows the "isn't available yet"
  message and sends nothing.
- The cloud environment **agentic-sales-team** also holds `DATABASE_URL` as an environment
  variable, and allows `api.ap-southeast-1.aws.neon.tech`.
- The private preview link (claude.ai artifact) shows only the landing page; it cannot run sign-up.
- Accounts: Neon made in M2. Gemini key made in M6 (free tier, no billing; Google may use free-tier
  data to improve its products). Firecrawl (M8) and Vercel Pro (M10) are made when needed, with the
  cost told first.
- **Gemini models (2026-11-26):** `gemini-2.5-flash` and `gemini-2.5-flash-lite` are closed to new
  users. 3.5, 3.6, 3.7 and 3.8 Flash and "flash-latest" were mostly 503 "high demand" or timed out
  on 2026-11-26. The owner chose **`GEMINI_MODEL=gemini-3-flash-preview`** (set in `.env.local`; the
  plan allows this override): it answers in 1–3 s but sometimes stalls past the 30 s timeout, and the
  free tier allows only **20 requests a day** for it. Billing (about $0.50 / $3.00 per 1M input /
  output tokens; under 1 US cent per lead for four skills) was offered; the owner chose to wait for
  now. Being a preview, re-check it before going online (M10). The M8 gate model was later replaced (see Milestone 8); before that it needed a replacement
  too (`gemini-3.5-flash-lite` refused the app's `thinkingBudget: 0` with a 400).
- Messenger/Facebook DMs and email lookup are out of scope; the app never sends anything.
