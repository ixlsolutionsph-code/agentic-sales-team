import { describe, expect, it } from "vitest";
import { clearIfCurrent, toastDuration, TOAST_MS } from "./toast";

describe("toast timing", () => {
  it("shows success for 2600 ms and errors for 4500 ms", () => {
    expect(TOAST_MS).toEqual({ success: 2600, error: 4500 });
    expect(toastDuration(false)).toBe(2600);
    expect(toastDuration(true)).toBe(4500);
  });

  it("only clears the toast a timer belongs to", () => {
    const newer = { id: 2, text: "Saved", error: false };
    expect(clearIfCurrent(newer, 1)).toBe(newer);
    expect(clearIfCurrent(newer, 2)).toBeNull();
    expect(clearIfCurrent(null, 1)).toBeNull();
  });
});
