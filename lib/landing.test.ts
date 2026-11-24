import { describe, expect, it } from "vitest";
import {
  HERO_SCRIPT,
  beatsVisibleAt,
  isValidEmail,
  loaderDuration,
  normaliseEmail,
  tiltProgress,
} from "./landing";

describe("loaderDuration", () => {
  it("is at least 3 seconds normally", () => expect(loaderDuration(false)).toBeGreaterThanOrEqual(3000));
  it("is 250 ms with reduced motion", () => expect(loaderDuration(true)).toBe(250));
});

describe("isValidEmail", () => {
  it.each(["you@company.com", "  ana.cruz@hospital.ph ", "a+b@x.co"])("accepts %s", (e) =>
    expect(isValidEmail(e)).toBe(true),
  );
  it.each(["", "you", "you@", "you@company", "you @company.com", "@company.com", "a@b.c"])(
    "rejects %s",
    (e) => expect(isValidEmail(e)).toBe(false),
  );
});

describe("normaliseEmail", () => {
  it("trims and lowercases", () => expect(normaliseEmail("  You@Company.COM ")).toBe("you@company.com"));
});

describe("beatsVisibleAt", () => {
  it("shows nothing at the start", () => expect(beatsVisibleAt(0)).toBe(0));
  it("shows every beat at the end", () => expect(beatsVisibleAt(1e9)).toBe(HERO_SCRIPT.length));
  it("beats are in time order", () => {
    const times = HERO_SCRIPT.map((b) => b.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("tiltProgress", () => {
  it("clamps to 0..1 over 520 px", () => {
    expect(tiltProgress(-10)).toBe(0);
    expect(tiltProgress(260)).toBe(0.5);
    expect(tiltProgress(9999)).toBe(1);
  });
});
