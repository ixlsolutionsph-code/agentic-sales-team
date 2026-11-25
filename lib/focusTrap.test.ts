import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./focusTrap";

describe("focus trap", () => {
  it("wraps from the last item to the first on Tab", () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it("wraps from the first item to the last on Shift+Tab", () => {
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it("lets the browser move focus in the middle", () => {
    expect(nextFocusIndex(1, 3, false)).toBe(-1);
    expect(nextFocusIndex(1, 3, true)).toBe(-1);
  });

  it("pulls focus back in when it is outside", () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });

  it("does nothing with no items", () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});
