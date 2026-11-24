import { describe, expect, it } from "vitest";
import {
  cleanEmail,
  cleanWorkspaceName,
  clientIp,
  isEmail,
  minutesLeft,
  passwordStrength,
  tooManyAttempts,
  UUID_RE,
} from "./rules";

const headers = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("email", () => {
  it("cleans", () => expect(cleanEmail("  Ana@X.COM ")).toBe("ana@x.com"));
  it("validates", () => {
    expect(isEmail("ana@x.com")).toBe(true);
    expect(isEmail("ana@x")).toBe(false);
    expect(isEmail("a na@x.com")).toBe(false);
  });
});

describe("passwordStrength", () => {
  it("rates", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("short")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefg1")).toBe(2);
    expect(passwordStrength("Abcdefgh12")).toBe(3);
    expect(passwordStrength("Abcdefgh12!xyz")).toBe(4);
  });
});

describe("limits", () => {
  it("says minutes", () => {
    expect(tooManyAttempts(1)).toBe("Too many attempts. Try again in 1 minute.");
    expect(tooManyAttempts(14.2)).toBe("Too many attempts. Try again in 15 minutes.");
  });
  it("counts minutes left", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    expect(minutesLeft(new Date("2026-01-01T00:00:00Z"), 15, now)).toBe(5);
    expect(minutesLeft(new Date("2025-01-01T00:00:00Z"), 15, now)).toBe(1);
  });
});

describe("misc", () => {
  it("workspace name trimmed to 80", () => expect(cleanWorkspaceName(" " + "a".repeat(100))).toHaveLength(80));
  it("uuid", () => expect(UUID_RE.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true));
  it("ip", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(headers({}))).toBe("unknown");
  });
});
