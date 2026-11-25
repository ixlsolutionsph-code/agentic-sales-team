import { describe, expect, it } from "vitest";
import { AGENT_ID_RE, agentInitials, buildAgent, checkNewAgent, firstSentence, newAgentId } from "./new";

describe("new agents", () => {
  it("makes ids as x + base-36 time + 3 random characters", () => {
    const id = newAgentId(1_700_000_000_000, () => 0.5);
    expect(id).toBe(`x${(1_700_000_000_000).toString(36)}iii`);
    expect(AGENT_ID_RE.test(id)).toBe(true);
    expect(AGENT_ID_RE.test(newAgentId())).toBe(true);
  });

  it("makes initials from the first two words", () => {
    expect(agentInitials("maya cruz santos")).toBe("MC");
    expect(agentInitials("Theo")).toBe("T");
  });

  it("keeps only the first sentence of the goal", () => {
    expect(firstSentence("Book 5 meetings a week. Then rest.")).toBe("Book 5 meetings a week.");
    expect(firstSentence("  No full stop here  ")).toBe("No full stop here");
    expect(firstSentence("")).toBe("");
  });

  it("builds the saved row with the fixed starting values", () => {
    const a = buildAgent(
      { id: "xabc1234", name: "  Sam Scout ", type: "scout", capabilities: ["research"], char: null, goal: "Find 10 leads. Daily." },
      "2026-01-01T00:00:00.000Z",
    );
    expect(a).toEqual({
      id: "xabc1234",
      name: "Sam Scout",
      initials: "SS",
      role: "Lead Scout",
      color: "#006AFF",
      status: "idle",
      task: "Ready for work",
      score: 0,
      goal: "Find 10 leads.",
      char: null,
      type: "scout",
      capabilities: ["scrape"],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("uses the picked capabilities for a Custom agent", () => {
    const a = buildAgent({ id: "xabc1234", name: "C", type: "custom", capabilities: ["follow-up", "scrape"], char: 1, goal: "" });
    expect(a.capabilities).toEqual(["scrape", "follow-up"]);
    expect(a.role).toBe("Custom");
  });

  it("checks what the browser sent", () => {
    const ok = { id: "xabc1234", name: "Sam", type: "scout", capabilities: ["scrape"], char: 2, goal: "" };
    expect(checkNewAgent(ok)).toBeNull();
    expect(checkNewAgent({ ...ok, name: "  " })).toBe("A name is required.");
    expect(checkNewAgent({ ...ok, type: "pirate" })).toBe("Pick a type for your agent.");
    expect(checkNewAgent({ ...ok, id: "bad id" })).not.toBeNull();
    expect(checkNewAgent({ ...ok, capabilities: ["fly"] })).not.toBeNull();
    expect(checkNewAgent({ ...ok, char: 7 })).not.toBeNull();
    expect(checkNewAgent(null)).not.toBeNull();
  });
});
