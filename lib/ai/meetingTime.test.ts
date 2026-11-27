import { describe, expect, it } from "vitest";
import type { AIJson } from "./engine";
import { bookingProblem, daySlots, meetingLabel, parseMeetingTime, parseMeetingTimeRule, safeTimeZone, zonedTime } from "./meetingTime";

const TZ = "Asia/Manila"; // UTC+8, no daylight saving
// Thursday 2026-11-26 10:00 in Manila.
const NOW = zonedTime(2026, 11, 26, 10, 0, TZ);
const RULES = { type: "Discovery call", duration: 30, windowStart: 9, windowEnd: 17, weekdaysOnly: true };

describe("time zone", () => {
  it("falls back to UTC for an unknown zone", () => {
    expect(safeTimeZone("Mars/Base")).toBe("UTC");
    expect(safeTimeZone(TZ)).toBe(TZ);
  });
  it("turns a Manila wall time into UTC", () => {
    expect(zonedTime(2026, 11, 27, 14, 0, TZ).toISOString()).toBe("2026-11-27T06:00:00.000Z");
    expect(zonedTime(2026, 7, 15, 14, 0, "America/New_York").toISOString()).toBe("2026-07-15T18:00:00.000Z");
  });
});

describe("simple reader", () => {
  it("reads tomorrow 2pm", () => {
    expect(parseMeetingTimeRule("book a meeting with Ana tomorrow 2pm", NOW, TZ)).toEqual({ iso: "2026-11-27T06:00:00.000Z", hasTime: true, date: "2026-11-27" });
  });
  it("a bare 1–7 means PM, and a day with no time has no time", () => {
    expect(parseMeetingTimeRule("tomorrow at 3", NOW, TZ)?.iso).toBe("2026-11-27T07:00:00.000Z");
    expect(parseMeetingTimeRule("next monday", NOW, TZ)).toMatchObject({ hasTime: false, date: "2026-11-30" });
    expect(parseMeetingTimeRule("Dec 3 at 10:30am", NOW, TZ)?.iso).toBe("2026-12-03T02:30:00.000Z");
  });
  it("returns null with no day and no time", () => {
    expect(parseMeetingTimeRule("book a meeting with Ana", NOW, TZ)).toBeNull();
  });
});

describe("AI reader", () => {
  it("uses the AI's date and time at temperature 0", async () => {
    const calls: { opts: unknown; prompt: string }[] = [];
    const ai: AIJson = async (_s, prompt, _x, opts) => {
      calls.push({ opts, prompt });
      return { date: "2026-12-01", time: "14:00" } as never;
    };
    expect(await parseMeetingTime("next Tue 2pm", NOW, TZ, ai)).toEqual({ iso: "2026-12-01T06:00:00.000Z", hasTime: true, date: "2026-12-01" });
    expect(calls[0].opts).toEqual({ temperature: 0, maxTokens: 120 });
    expect(calls[0].prompt).toContain("2026-11-27 friday (tomorrow) UTC+08:00");
  });
  it("falls back to the simple reader on an error", async () => {
    const broken: AIJson = async () => {
      throw new Error("503");
    };
    expect((await parseMeetingTime("tomorrow 2pm", NOW, TZ, broken))?.iso).toBe("2026-11-27T06:00:00.000Z");
  });
});

describe("booking window", () => {
  it("books tomorrow 2pm and refuses 8pm, weekends and the past", () => {
    expect(bookingProblem("2026-11-27T06:00:00.000Z", RULES, TZ, NOW)).toBeNull();
    expect(bookingProblem(zonedTime(2026, 11, 27, 20, 0, TZ).toISOString(), RULES, TZ, NOW)).toContain("outside my booking hours (9 AM to 5 PM)");
    expect(bookingProblem(zonedTime(2026, 11, 28, 10, 0, TZ).toISOString(), RULES, TZ, NOW)).toContain("weekdays");
    expect(bookingProblem(zonedTime(2026, 11, 26, 9, 0, TZ).toISOString(), RULES, TZ, NOW)).toContain("already passed");
    expect(bookingProblem(zonedTime(2026, 11, 27, 16, 45, TZ).toISOString(), RULES, TZ, NOW)).not.toBeNull();
  });
  it("labels the meeting in the zone", () => {
    expect(meetingLabel("2026-11-27T06:00:00.000Z", 30, TZ)).toBe("Fri, Nov 27 · 2:00–2:30 PM");
    expect(meetingLabel(zonedTime(2026, 11, 27, 11, 30, TZ).toISOString(), 60, TZ)).toBe("Fri, Nov 27 · 11:30 AM–12:30 PM");
  });
  it("offers up to 6 hourly slots, skipping 12", () => {
    const s = daySlots("2026-11-27", RULES, TZ, NOW).map((x) => x.label);
    expect(s).toEqual(["9 AM", "10 AM", "11 AM", "1 PM", "2 PM", "3 PM"]);
  });
});

import { whenChoices } from "./meetingTime";
describe("when choices", () => {
  it("names the next working day when tomorrow is a weekend", () => {
    expect(whenChoices(RULES, TZ, NOW)).toEqual(["Tomorrow 10 AM", "Tomorrow 2 PM", "Next Monday 10 AM"]);
    const friday = zonedTime(2026, 11, 27, 10, 0, TZ);
    expect(whenChoices(RULES, TZ, friday)).toEqual(["Monday 10 AM", "Monday 2 PM", "Tuesday 10 AM"]);
  });
});
