import { describe, expect, it } from "vitest";
import { MSG } from "@/lib/auth/rules";
import { persistOrRollback } from "./persist";

describe("persistOrRollback", () => {
  it("keeps the change when the save works", async () => {
    let value = "old";
    const errors: string[] = [];
    const res = await persistOrRollback({
      apply: () => (value = "new"),
      rollback: () => (value = "old"),
      save: async () => ({ ok: true }),
      onError: (m) => errors.push(m),
    });
    expect(res.ok).toBe(true);
    expect(value).toBe("new");
    expect(errors).toEqual([]);
  });

  it("puts the old value back and reports the error when the save fails", async () => {
    let value = "old";
    const errors: string[] = [];
    await persistOrRollback({
      apply: () => (value = "new"),
      rollback: () => (value = "old"),
      save: async () => ({ ok: false, error: "Nope." }),
      onError: (m) => errors.push(m),
    });
    expect(value).toBe("old");
    expect(errors).toEqual(["Nope."]);
  });

  it("treats a thrown save as the server-down message and rolls back", async () => {
    let value = "old";
    const errors: string[] = [];
    await persistOrRollback({
      apply: () => (value = "new"),
      rollback: () => (value = "old"),
      save: async () => {
        throw new Error("network");
      },
      onError: (m) => errors.push(m),
    });
    expect(value).toBe("old");
    expect(errors).toEqual([MSG.serverDown]);
  });
});
