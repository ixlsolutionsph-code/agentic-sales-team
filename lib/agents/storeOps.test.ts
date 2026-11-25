import { describe, expect, it } from "vitest";
import { mergeConfig, restoreKey, withState } from "./storeOps";

describe("store updates for agents", () => {
  it("merges config like the server: fields replace, settings merge per capability", () => {
    const prev = { role: "SDR", goal: "A.", permissions: null, settings: { research: { mode: "auto" }, "book-meeting": { duration: 60 } } };
    expect(mergeConfig(prev, { settings: { research: { mode: "ask" } } })).toEqual({
      role: "SDR",
      goal: "A.",
      permissions: null,
      settings: { research: { mode: "ask" }, "book-meeting": { duration: 60 } },
    });
    expect(mergeConfig(undefined, { goal: "New." })).toEqual({ role: null, goal: "New.", permissions: null, settings: null });
  });

  it("sets state flags without losing the other one", () => {
    expect(withState({ removed: false, paused: true }, { removed: true })).toEqual({ removed: true, paused: true });
    expect(withState(undefined, { paused: true })).toEqual({ removed: false, paused: true });
  });

  it("restores or removes a key", () => {
    expect(restoreKey({ a: 1, b: 2 }, "a", 5)).toEqual({ a: 5, b: 2 });
    expect(restoreKey({ a: 1, b: 2 }, "a", undefined)).toEqual({ b: 2 });
  });
});
