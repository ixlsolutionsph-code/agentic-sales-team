import { describe, expect, it } from "vitest";
import { PACE, paceReplies, paceStep, revealStep } from "./pace";

describe("chat pacing", () => {
  it("uses the 01-prd.md numbers", () => {
    expect(PACE).toEqual({ firstReplyMinMs: 2000, typingSameMs: 1000, typingNewMs: 2000, pauseNewMs: 1000, pauseSameMs: 400 });
  });

  it("types longer and pauses longer for a new speaker", () => {
    expect(paceStep("a1", "a2")).toEqual({ pauseMs: 1000, typingMs: 2000 });
    expect(paceStep(null, "a2")).toEqual({ pauseMs: 1000, typingMs: 2000 });
    expect(paceStep("a2", "a2")).toEqual({ pauseMs: 400, typingMs: 1000 });
  });

  it("holds the dots so the first reply is at least 2 s after the send", () => {
    // Same speaker would show after 1400 ms; it must wait until 2000 ms.
    expect(revealStep("a1", "a1", 0, 2000)).toEqual({ pauseMs: 400, typingMs: 1600 });
    // Already late enough: unchanged.
    expect(revealStep("a1", "a2", 0, 2000)).toEqual({ pauseMs: 1000, typingMs: 2000 });
    // The server took 1.5 s: the reply still shows no sooner than 2 s after the send.
    const s = revealStep("a1", "a1", 1500, 2000);
    expect(1500 + s.pauseMs + s.typingMs).toBe(2900);
  });

  it("lays out several replies one at a time and skips my rows", () => {
    const out = paceReplies(
      [
        { id: 1, who: "me" },
        { id: 2, who: "a1" },
        { id: 3, who: "a1" },
        { id: 4, who: "a2" },
      ],
      { prevWho: "me", start: 0, sentAt: 0 },
    );
    expect(out).toEqual([
      { id: 2, who: "a1", dotsAt: 1000, showAt: 3000 },
      { id: 3, who: "a1", dotsAt: 3400, showAt: 4400 },
      { id: 4, who: "a2", dotsAt: 5400, showAt: 7400 },
    ]);
    expect(out[0].showAt).toBeGreaterThanOrEqual(PACE.firstReplyMinMs);
  });

  it("enforces the 2 s minimum even for a same-speaker first reply", () => {
    const out = paceReplies([{ id: 9, who: "a1" }], { prevWho: "a1", start: 100, sentAt: 0 });
    expect(out[0].showAt).toBe(2000);
  });
});
