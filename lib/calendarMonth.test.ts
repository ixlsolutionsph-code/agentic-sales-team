import { describe, expect, it } from "vitest";
import { meetingCounts, monthLabel, monthWeeks, rowHour, shiftAnchor } from "./calendar";

describe("month view", () => {
  it("covers the month in Monday-first weeks", () => {
    const weeks = monthWeeks(new Date(2026, 10, 15)); // November 2026
    expect(weeks[0][0].getDate()).toBe(26); // Mon Oct 26
    expect(weeks[weeks.length - 1].some((d) => d.getMonth() === 10 && d.getDate() === 30)).toBe(true);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthLabel(new Date(2026, 10, 1))).toBe("November 2026");
  });
  it("moves by a week or a month", () => {
    expect(shiftAnchor(new Date(2026, 10, 27), "week", 1).getDate()).toBe(4);
    expect(shiftAnchor(new Date(2026, 10, 27), "month", -1).getMonth()).toBe(9);
  });
  it("counts meetings, upcoming, this week and leads", () => {
    const now = new Date(2026, 10, 26, 10); // Thu
    const list = [
      { whenAt: new Date(2026, 10, 27, 14).toISOString(), leadId: "a" },
      { whenAt: new Date(2026, 10, 24, 9).toISOString(), leadId: "a" },
      { whenAt: new Date(2026, 11, 3, 9).toISOString(), leadId: "b" },
    ];
    expect(meetingCounts(list, now)).toEqual({ meetings: 3, upcoming: 2, thisWeek: 2, leads: 2 });
    expect(rowHour(new Date(2026, 10, 27, 22))).toBe(18);
  });
});
