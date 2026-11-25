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

## Next

- **Milestone 4: agents.** Started on 2026-11-25. Also fix: the sidebar "Recent chats" links use
  `/chats?team=…`, but `01-prd.md` §12 says a chat has no bookmarkable link.

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
