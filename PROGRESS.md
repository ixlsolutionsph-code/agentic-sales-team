# Progress

Where the build is, so a new session can pick up. Talk to the owner as `AGENTS.md` says.

## Done

- **Milestone 1: landing page.** Uses the Spectrum look in `DESIGN.md` (not the blue in `01-prd.md` §10).
  The "Trusted by 1,200+ sales teams" badge was removed at the owner's request.
- **Milestone 2: code is written and tested on a local Postgres stand-in.** All checks in
  `05-build-guide.md` M2 passed locally.

## Milestone 2: what is left

1. Connect to the owner's Neon database (Singapore, `ap-southeast-1`).
   - Use the cloud environment **agentic-sales-team**. It allows `api.ap-southeast-1.aws.neon.tech`
     and holds `DATABASE_URL` as an environment variable (the owner entered it; never print it).
2. Make `.env.local` (it is not in git) with a fresh `AUTH_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   Do not put `DATABASE_URL` in it; it comes from the environment.
3. Run `pnpm db:migrate` against Neon, then run it again (second run must apply nothing).
4. Run the M2 checks against Neon (sign up, log out, log in, old cookie rejected, duplicate
   sign-up message, 6th wrong password blocked, 10-workspace limit, forged `ws` cookie ignored,
   `/dashboard` redirects when signed out). Then delete the test account rows.
5. Report to the owner in the `AGENTS.md` format, then wait before Milestone 3.

## Notes

- The private preview link (claude.ai artifact) shows only the landing page; it cannot run sign-up.
- Accounts: Neon made in M2. Gemini (M6), Firecrawl (M8), Vercel Pro (M10) are made when needed,
  with the cost told first.
- Messenger/Facebook DMs and email lookup are out of scope; the app never sends anything.
