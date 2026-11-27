// Pacing of agent replies in the team chat (01-prd.md §7.4). Pure.
//
// Replies show one at a time behind typing dots:
// - a short pause before the dots: 1000 ms for a new speaker, 400 ms for the same one;
// - then the dots: 2000 ms for a new speaker, 1000 ms for the same one;
// - the first reply after a send never shows sooner than 2000 ms after the send.
// History loads with no delay.

export const PACE = {
  firstReplyMinMs: 2000,
  typingSameMs: 1000,
  typingNewMs: 2000,
  pauseNewMs: 1000,
  pauseSameMs: 400,
} as const;

export type PaceStep = { pauseMs: number; typingMs: number };

// The pause and the typing time for one reply. `prevWho` is the speaker of the
// message shown just before it (null when none).
export function paceStep(prevWho: string | null, who: string): PaceStep {
  const same = prevWho === who;
  return same ? { pauseMs: PACE.pauseSameMs, typingMs: PACE.typingSameMs } : { pauseMs: PACE.pauseNewMs, typingMs: PACE.typingNewMs };
}

// The same step, with the dots held longer when the reply would otherwise show
// before `notBefore` (the send time + 2000 ms). Times are in ms.
export function revealStep(prevWho: string | null, who: string, now: number, notBefore = 0): PaceStep {
  const step = paceStep(prevWho, who);
  const showAt = now + step.pauseMs + step.typingMs;
  return showAt >= notBefore ? step : { pauseMs: step.pauseMs, typingMs: step.typingMs + (notBefore - showAt) };
}

export type PacedReply = { id: number; who: string; dotsAt: number; showAt: number };

// The whole timeline for a list of replies, in ms after `start`. The user's own
// rows ("me") are not paced and are left out.
export function paceReplies(
  replies: { id: number; who: string }[],
  opts: { prevWho: string | null; start?: number; sentAt?: number | null },
): PacedReply[] {
  const out: PacedReply[] = [];
  let t = opts.start ?? 0;
  let prev = opts.prevWho;
  const notBefore = opts.sentAt == null ? 0 : opts.sentAt + PACE.firstReplyMinMs;
  for (const r of replies) {
    if (r.who === "me") continue;
    const step = revealStep(prev, r.who, t, out.length ? 0 : notBefore);
    const dotsAt = t + step.pauseMs;
    const showAt = dotsAt + step.typingMs;
    out.push({ id: r.id, who: r.who, dotsAt, showAt });
    t = showAt;
    prev = r.who;
  }
  return out;
}
