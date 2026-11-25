import { describe, expect, it } from "vitest";
import {
  AGENT_TYPES,
  CAPABILITIES,
  TEAM_TEMPLATES,
  agentType,
  capabilitiesFor,
  capabilityLabel,
  isEngineReady,
  parseMeetingMinutes,
} from "./agentTypes";

describe("capabilities, types and templates", () => {
  it("has 10 capabilities, 2 of them soon", () => {
    expect(CAPABILITIES).toHaveLength(10);
    expect(CAPABILITIES.filter((c) => !c.runs).map((c) => c.id)).toEqual(["follow-up", "enrich"]);
    expect(isEngineReady("scrape")).toBe(true);
    expect(isEngineReady("follow-up")).toBe(false);
    expect(isEngineReady("enrich")).toBe(false);
    expect(isEngineReady("nope")).toBe(false);
  });

  it("has 16 agent types and 10 team templates", () => {
    expect(AGENT_TYPES).toHaveLength(16);
    expect(TEAM_TEMPLATES).toHaveLength(10);
    const caps = new Set(CAPABILITIES.map((c) => c.id));
    for (const t of AGENT_TYPES) for (const c of t.capabilities) expect(caps.has(c)).toBe(true);
    for (const t of TEAM_TEMPLATES) for (const c of [...t.required, ...t.soon]) expect(caps.has(c)).toBe(true);
  });

  it("gives each type its preset capabilities", () => {
    expect(capabilitiesFor("scout")).toEqual(["scrape"]);
    expect(capabilitiesFor("closer")).toEqual(["research", "qualify", "proposal", "match"]);
    expect(capabilitiesFor("manager")).toEqual([]);
    expect(agentType("scout").label).toBe("Lead Scout");
    expect(agentType("unknown").id).toBe("custom");
    expect(capabilityLabel("book-meeting")).toBe("Meeting booking");
  });

  it("lets Custom pick any capabilities, in the standard order, ignoring unknown ones", () => {
    expect(capabilitiesFor("custom", ["follow-up", "scrape", "bogus", "scrape"])).toEqual(["scrape", "follow-up"]);
  });
});

describe("meeting length", () => {
  it("reads plain words", () => {
    expect(parseMeetingMinutes("1 hour")).toBe(60);
    expect(parseMeetingMinutes("30")).toBe(30);
    expect(parseMeetingMinutes("45 min")).toBe(45);
    expect(parseMeetingMinutes("90 minutes")).toBe(90);
    expect(parseMeetingMinutes("1.5 hours")).toBe(90);
    expect(parseMeetingMinutes("1h 30m")).toBe(90);
    expect(parseMeetingMinutes("1 hour and 15 minutes")).toBe(75);
    expect(parseMeetingMinutes("an hour")).toBe(60);
    expect(parseMeetingMinutes("half an hour")).toBe(30);
    expect(parseMeetingMinutes("8 hours")).toBe(480);
    expect(parseMeetingMinutes("5 mins")).toBe(5);
  });

  it("refuses lengths outside 5 minutes to 8 hours, and nonsense", () => {
    expect(parseMeetingMinutes("3 min")).toBeNull();
    expect(parseMeetingMinutes("9 hours")).toBeNull();
    expect(parseMeetingMinutes("")).toBeNull();
    expect(parseMeetingMinutes("soon")).toBeNull();
    expect(parseMeetingMinutes("30 bananas")).toBeNull();
  });
});
