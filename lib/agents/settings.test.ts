import { describe, expect, it } from "vitest";
import { capMode, cleanSettingsPatch, effectiveRoleGoal, meetingSettings, withMode } from "./settings";

describe("Ask / Auto", () => {
  it("is Auto only for the exact value auto", () => {
    expect(capMode({ research: { mode: "auto" } }, "research")).toBe("auto");
    expect(capMode({ research: { mode: "ask" } }, "research")).toBe("ask");
    expect(capMode({ research: { mode: "AUTO" } }, "research")).toBe("ask");
    expect(capMode({}, "research")).toBe("ask");
    expect(capMode(null, "research")).toBe("ask");
  });

  it("keeps a capability's other settings when its mode changes", () => {
    expect(withMode({ "book-meeting": { duration: 60 } }, "book-meeting", "auto")).toEqual({
      "book-meeting": { duration: 60, mode: "auto" },
    });
  });
});

describe("meeting settings", () => {
  it("fills defaults", () => {
    expect(meetingSettings(null)).toEqual({ type: "Meeting", duration: 30, windowStart: 9, windowEnd: 17, weekdaysOnly: true });
  });

  it("only an explicit false turns off weekdays-only", () => {
    expect(meetingSettings({ "book-meeting": { weekdaysOnly: false } }).weekdaysOnly).toBe(false);
    expect(meetingSettings({ "book-meeting": { weekdaysOnly: "no" } }).weekdaysOnly).toBe(true);
  });

  it("reads saved values", () => {
    expect(meetingSettings({ "book-meeting": { type: "Demo", duration: 60, windowStart: 8, windowEnd: 18 } })).toMatchObject({
      type: "Demo",
      duration: 60,
      windowStart: 8,
      windowEnd: 18,
    });
  });
});

describe("edits over base values", () => {
  it("lets saved edits win", () => {
    expect(effectiveRoleGoal({ role: "SDR", goal: "A." }, undefined)).toEqual({ role: "SDR", goal: "A." });
    expect(effectiveRoleGoal({ role: "SDR", goal: "A." }, { role: "Closer", goal: null, permissions: null, settings: null })).toEqual({
      role: "Closer",
      goal: "A.",
    });
  });
});

describe("settings patch check", () => {
  it("accepts the known shape", () => {
    expect(cleanSettingsPatch({ research: { mode: "auto" } })).toEqual({ research: { mode: "auto" } });
    expect(cleanSettingsPatch({ "book-meeting": { duration: 60, length: "1 hour", weekdaysOnly: false } })).toEqual({
      "book-meeting": { duration: 60, length: "1 hour", weekdaysOnly: false },
    });
  });

  it("refuses bad values", () => {
    expect(cleanSettingsPatch({ research: { mode: "maybe" } })).toBeNull();
    expect(cleanSettingsPatch({ "book-meeting": { duration: 3 } })).toBeNull();
    expect(cleanSettingsPatch({ "book-meeting": { windowStart: 25 } })).toBeNull();
    expect(cleanSettingsPatch([])).toBeNull();
    expect(cleanSettingsPatch({ research: "auto" })).toBeNull();
  });
});
