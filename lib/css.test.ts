import { describe, expect, it } from "vitest";
import { css } from "./css";

describe("css()", () => {
  it("joins class names and drops empty values", () => {
    expect(css("btn", false, null, undefined, 0, "", "is-on")).toBe("btn is-on");
    expect(css()).toBe("");
  });
});
