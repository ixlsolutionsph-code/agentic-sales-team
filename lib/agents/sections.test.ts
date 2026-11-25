import { describe, expect, it } from "vitest";
import { agentSections } from "./sections";

const ids = (caps: string[]) => agentSections(caps).map((s) => s.id);

describe("agent page sections", () => {
  it("always shows Overview, Tasks, Performance and Configuration", () => {
    expect(ids([])).toEqual(["overview", "tasks", "performance", "configuration"]);
  });

  it("shows a section only for the agent's capabilities", () => {
    expect(ids(["scrape"])).toEqual(["overview", "leads", "tasks", "performance", "configuration"]);
    expect(ids(["research", "qualify", "proposal", "match"])).toEqual([
      "overview",
      "leads",
      "research",
      "proposals",
      "tasks",
      "performance",
      "configuration",
    ]);
    expect(ids(["outreach", "follow-up", "book-meeting"])).toEqual([
      "overview",
      "emails",
      "reach-outs",
      "meetings",
      "tasks",
      "performance",
      "configuration",
    ]);
  });
});
