import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FACTS_MAX, factualAnswer, formatTeamFacts, type TeamFacts } from "./teamFacts";

const facts: TeamFacts = {
  teamName: "Sales",
  teamGoal: "Fill night shifts",
  members: [{ name: "Maya", role: "Writer", capabilities: ["outreach"], paused: false }],
  leads: { accepted: 4, pending: 2, dismissed: 1, hot: 2, warm: 1, cold: 1, unscored: 0 },
  stages: { new: 3, contacted: 1 },
  drafts: { open: 3, sent: 1 },
  proposals: 1,
  meetings: { upcoming: 1, total: 2 },
  products: 5,
  top: Array.from({ length: 8 }, (_, i) => ({ name: `Lead ${i}`, title: "HR Manager", company: "Hospital", score: 90 - i, status: "new" })),
  named: [{ name: "Ana Cruz", title: "HR", company: "A", score: 80, status: "new", review: "accepted", fitReason: "Hires nurses", research: "x".repeat(5000) }],
};

describe("team facts", () => {
  it("formats the numbers within 3000 characters", () => {
    const t = formatTeamFacts(facts);
    expect(t).toContain("Leads in the book (accepted): 4 (2 hot, 1 warm, 1 cold, 0 not scored yet)");
    expect(t).toContain("Email drafts waiting to be sent: 3");
    expect(t).toContain("Ana Cruz");
    expect(t.length).toBeLessThanOrEqual(FACTS_MAX);
    const big = formatTeamFacts({ ...facts, top: Array.from({ length: 200 }, () => facts.top[0]) });
    expect(big.length).toBeLessThanOrEqual(FACTS_MAX);
  });
  it("answers from the facts with no AI", () => {
    expect(factualAnswer(facts)).toContain("4 leads in the book (2 hot, 1 warm, 1 cold) and 2 waiting for review");
  });
});
