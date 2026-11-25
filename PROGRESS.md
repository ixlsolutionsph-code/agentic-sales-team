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

## Next

- **Milestone 6: products and leads.** Wait for the owner to say go.

## Running it on the owner's Windows computer

- The app runs locally from a folder outside OneDrive. `.env.local` there has `AUTH_SECRET` and
  `DATABASE_URL` (never print or commit it).
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
- Accounts: Neon made in M2. Gemini (M6), Firecrawl (M8), Vercel Pro (M10) are made when needed,
  with the cost told first.
- Messenger/Facebook DMs and email lookup are out of scope; the app never sends anything.
