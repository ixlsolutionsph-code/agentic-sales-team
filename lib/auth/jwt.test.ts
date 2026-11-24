import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./jwt";

describe("session token", () => {
  it("round-trips", async () => {
    const t = await signSession({ userId: "u1", email: "a@b.co", name: "Ana", sessionVersion: 2 });
    expect(await verifySession(t)).toEqual({ userId: "u1", email: "a@b.co", name: "Ana", sessionVersion: 2 });
  });
  it("rejects a tampered token", async () => {
    const t = await signSession({ userId: "u1", email: "a@b.co", name: "Ana", sessionVersion: 0 });
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
