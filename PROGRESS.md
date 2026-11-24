# Progress

Where the build is, so a new session can pick up. Talk to the owner as `AGENTS.md` says.

## Done

- **Milestone 1: landing page.** Uses the Spectrum look in `DESIGN.md` (not the blue in `01-prd.md` §10).
  The "Trusted by 1,200+ sales teams" badge was removed at the owner's request.
- **Milestone 2: done on Neon.** Tables made with `pnpm db:migrate` (second run applied nothing).
  All `05-build-guide.md` M2 checks passed in a browser against Neon on 2026-11-24, then the test
  account and its rate-limit rows were deleted (the database has 0 users now).
  The guide says "19 tables", but `04-erd.md` lists 20; the database has all 20 plus `_migrations`.

## Next

- Milestone 3, once the owner says go.

## Working in the cloud session

- Use the cloud environment **agentic-sales-team**. It holds `DATABASE_URL` (never print it) and allows
  `api.c-5.ap-southeast-1.aws.neon.tech`, the address the Neon driver really calls.
- In this sandbox, Node needs `NODE_USE_ENV_PROXY=1` to reach Neon (for `pnpm db:migrate`, `pnpm dev`,
  `pnpm start`). This is only for the sandbox, not for Vercel.
- `.env.local` is not in git. If it is missing, make it with a fresh `AUTH_SECRET`:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Notes

- The private preview link (claude.ai artifact) shows only the landing page; it cannot run sign-up.
- Accounts: Neon made in M2. Gemini (M6), Firecrawl (M8), Vercel Pro (M10) are made when needed,
  with the cost told first.
- Messenger/Facebook DMs and email lookup are out of scope; the app never sends anything.
