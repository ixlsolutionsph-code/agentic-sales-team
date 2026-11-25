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

## Next

- **Milestone 3: app shell and client store.** Wait for the owner to say go.

## Running it on the owner's Windows computer

- The app runs locally from a folder outside OneDrive. `.env.local` there has `AUTH_SECRET` and
  `DATABASE_URL` (never print or commit it).
- Start it with `pnpm.cmd dev` (PowerShell blocks the plain `pnpm` script), then open
  http://localhost:3000.
- Node.js is v26, which has no `corepack`. pnpm 11.3.0 was installed with `npm.cmd install -g`.

## Notes

- `04-erd.md` says "19 tables" but lists 20. The database has the 20 listed, which matches the code.
- Small, not urgent: on Settings, if both fields are saved quickly one after the other, the second
  "Saved" message can vanish early (the first message's timer clears it). The save itself works.
- Self-serve password reset is off on purpose: "Forgot password?" shows the "isn't available yet"
  message and sends nothing.
- The cloud environment **agentic-sales-team** also holds `DATABASE_URL` as an environment
  variable, and allows `api.ap-southeast-1.aws.neon.tech`.
- The private preview link (claude.ai artifact) shows only the landing page; it cannot run sign-up.
- Accounts: Neon made in M2. Gemini (M6), Firecrawl (M8), Vercel Pro (M10) are made when needed,
  with the cost told first.
- Messenger/Facebook DMs and email lookup are out of scope; the app never sends anything.
