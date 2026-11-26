import { describe, expect, it } from "vitest";
import { capItems, createStepLog, type Step } from "@/lib/scrape/steps";
import { UserFacingError, userMessage } from "./errors";
import { MSG_RUNS_LIMIT, MSG_TOO_MANY_LEADS, msgCantRun, msgKindFailed } from "./limits";
import { DeadlineError, STALE_AFTER_MS, STALE_SCRAPE_AFTER_MS, budget, withDeadline } from "./runtime";

describe("limits and messages", () => {
  it("uses the exact texts", () => {
    expect(MSG_RUNS_LIMIT).toBe("You've reached today's limit of 100 runs. Try again tomorrow.");
    expect(MSG_TOO_MANY_LEADS).toBe("Pick at most 25 leads at a time.");
    expect(msgCantRun("outreach")).toBe("This agent can't run outreach.");
    expect(msgKindFailed("research")).toBe("Lead research failed. Please try again.");
  });

  it("shows user-facing errors and hides others", () => {
    expect(userMessage(new UserFacingError("Add products first."), "proposal")).toBe("Add products first.");
    expect(userMessage(new Error("SQL boom"), "outreach")).toBe("Email drafting failed. Please try again.");
  });
});

describe("run timing", () => {
  it("treats a run as stale after 360 s (120 s for a scrape)", () => {
    expect(STALE_AFTER_MS).toBe(360_000);
    expect(STALE_SCRAPE_AFTER_MS).toBe(120_000);
  });

  it("rejects work that takes too long", async () => {
    await expect(withDeadline(new Promise((r) => setTimeout(() => r(1), 50)), 5)).rejects.toBeInstanceOf(DeadlineError);
    await expect(withDeadline(Promise.resolve(2), 50)).resolves.toBe(2);
  });

  it("measures budgets", () => {
    let t = 1000;
    const b = budget(1000, () => t);
    expect(b.over(100)).toBe(false);
    t = 1100;
    expect(b.over(100)).toBe(true);
    expect(b.elapsed()).toBe(100);
  });
});

describe("step log", () => {
  it("caps items: 6 sources, 3 dropped, 8 in all", () => {
    const src = Array.from({ length: 9 }, (_, i) => ({ title: `s${i}`, kind: "source" as const }));
    const drop = Array.from({ length: 5 }, (_, i) => ({ title: `d${i}`, kind: "dropped" as const }));
    const out = capItems([...src, ...drop]);
    expect(out.items.filter((i) => i.kind === "source")).toHaveLength(6);
    expect(out.items.filter((i) => i.kind === "dropped")).toHaveLength(2);
    expect(out.items).toHaveLength(8);
    expect(out.more).toBe(6);
  });

  it("writes in order and replaces a step with the same id", async () => {
    const writes: Step[][] = [];
    const log = createStepLog(async (s) => {
      await new Promise((r) => setTimeout(r, 2));
      writes.push(s);
    });
    log.set({ id: "pick", status: "active", label: "Picking leads" });
    log.set({ id: "pick", status: "done", label: "Picked 3 leads" });
    log.set({ id: "work", status: "active", label: "Working" });
    await log.flush();
    expect(writes).toHaveLength(3);
    expect(writes[2].map((s) => [s.id, s.status])).toEqual([
      ["pick", "done"],
      ["work", "active"],
    ]);
  });
});
