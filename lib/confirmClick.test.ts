import { describe, expect, it } from "vitest";
import { CONFIRM_WINDOW_MS, confirmClickStep, isArmed } from "./confirmClick";

describe("two-click delete", () => {
  it("arms on the first click", () => {
    expect(confirmClickStep(null, 1000)).toEqual({ armedAt: 1000, confirmed: false });
  });

  it("confirms on a second click within 3 seconds", () => {
    expect(confirmClickStep(1000, 1000 + CONFIRM_WINDOW_MS - 1)).toEqual({ armedAt: null, confirmed: true });
  });

  it("re-arms instead of confirming after 3 seconds", () => {
    expect(confirmClickStep(1000, 1000 + CONFIRM_WINDOW_MS)).toEqual({ armedAt: 4000, confirmed: false });
  });

  it("disarms after 3 seconds", () => {
    expect(CONFIRM_WINDOW_MS).toBe(3000);
    expect(isArmed(1000, 3999)).toBe(true);
    expect(isArmed(1000, 4000)).toBe(false);
    expect(isArmed(null, 0)).toBe(false);
  });
});
