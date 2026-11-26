// Time limits for runs (01-prd.md §7.5). Pure helpers, so they can be unit tested.

export const RUN_MAX_DURATION_S = 300;
export const SCRAPE_MAX_DURATION_S = 60;
export const STALE_GRACE_MS = 60_000;
// A running job older than this is treated as dead: 300 s + 60 s grace = 360 s,
// and 60 s + 60 s = 120 s for a scrape.
export const STALE_AFTER_MS = RUN_MAX_DURATION_S * 1000 + STALE_GRACE_MS;
export const STALE_SCRAPE_AFTER_MS = SCRAPE_MAX_DURATION_S * 1000 + STALE_GRACE_MS;

export const CLAIM_BUDGET_MS = 120_000; // stop claiming new jobs after this
export const LEAD_BUDGET_MS = 180_000; // stop starting new leads after this
export const PER_LEAD_MS = 75_000; // each lead gets this long

export class DeadlineError extends Error {
  constructor(ms: number) {
    super(`Took longer than ${Math.round(ms / 1000)} s`);
    this.name = "DeadlineError";
  }
}

// Resolves with the promise, or rejects with DeadlineError after `ms`.
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(ms)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

// A clock for one run: how long since it started, and whether a budget is spent.
export function budget(startMs: number, now: () => number = Date.now) {
  return {
    elapsed: () => now() - startMs,
    over: (ms: number) => now() - startMs >= ms,
  };
}
