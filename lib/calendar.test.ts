import { describe, expect, it } from "vitest";
import { hourLabel, hourRows, sameDay, weekDays, weekLabel } from "./calendar";

describe("calendar grid", () => {
  it("starts the week on Monday", () => {
    const days = weekDays(new Date(2026, 10, 25)); // Wed 25 Nov 2026
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[0].getDate()).toBe(23);
    expect(days[6].getDate()).toBe(29);
  });

  it("puts a Sunday at the end of its week", () => {
    const days = weekDays(new Date(2026, 10, 29)); // Sun 29 Nov 2026
    expect(days[0].getDate()).toBe(23);
    expect(sameDay(days[6], new Date(2026, 10, 29, 15))).toBe(true);
  });

  it("labels weeks, including across months and years", () => {
    expect(weekLabel(weekDays(new Date(2026, 10, 25)))).toBe("Nov 23 – 29, 2026");
    expect(weekLabel(weekDays(new Date(2026, 11, 2)))).toBe("Nov 30 – Dec 6, 2026");
    expect(weekLabel(weekDays(new Date(2026, 11, 31)))).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("lists hour rows from 8 AM to 6 PM", () => {
    expect(hourRows()).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(hourLabel(8)).toBe("8 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(18)).toBe("6 PM");
  });
});
