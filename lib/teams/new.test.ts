import { describe, expect, it } from "vitest";
import {
  TEAM_ICONS,
  TEAM_ID_RE,
  buildTeam,
  checkNewTeam,
  cleanMemberIds,
  coverage,
  gapAgentType,
  gaps,
  iconBg,
  newTeamId,
} from "./new";

describe("team ids", () => {
  it('is "tx" + base-36 time + 3 characters', () => {
    const id = newTeamId(1_700_000_000_000, () => 0.5);
    expect(id).toBe(`tx${(1_700_000_000_000).toString(36)}iii`);
    expect(TEAM_ID_RE.test(id)).toBe(true);
    expect(TEAM_ID_RE.test(newTeamId())).toBe(true);
    expect(TEAM_ID_RE.test("x123456789")).toBe(false);
  });
});

describe("icons", () => {
  it("has the 6 icons, each with a tint", () => {
    expect(TEAM_ICONS.map((i) => i.icon)).toEqual(["🚀", "🌎", "🏛", "📣", "🎯", "💎"]);
    expect(iconBg("🎯")).toBe("#fde7e4");
    expect(iconBg("nope")).toBe(TEAM_ICONS[0].bg);
  });
});

describe("coverage", () => {
  it("a Full-Cycle team with only a Scout covers scrape only", () => {
    expect(coverage("fullcycle", [["scrape"]])).toEqual([
      { cap: "scrape", covered: true },
      { cap: "outreach", covered: false },
      { cap: "book-meeting", covered: false },
    ]);
    expect(gaps("fullcycle", [["scrape"], ["outreach"]])).toEqual(["book-meeting"]);
  });

  it("soon capabilities are never gaps; Custom needs nothing", () => {
    expect(gaps("success", [])).toEqual([]);
    expect(gaps("custom", [])).toEqual([]);
    expect(gaps("outbound", [["scrape", "outreach"]])).toEqual([]);
  });

  it("picks the first non-custom type whose only capability is the gap", () => {
    expect(gapAgentType("outreach")).toEqual({ type: "writer", label: "Outreach Writer", name: "Outreach Writer", capabilities: ["outreach"] });
    expect(gapAgentType("scrape").type).toBe("scout");
    expect(gapAgentType("book-meeting").type).toBe("meeting");
    expect(gapAgentType("qualify").type).toBe("qualifier");
    // No single-capability type does proposals: a Custom agent with just that.
    expect(gapAgentType("proposal")).toEqual({ type: "custom", label: "Custom", name: "Proposal Agent", capabilities: ["proposal"] });
  });
});

describe("checking a new team", () => {
  const good = { id: newTeamId(), name: "EMEA", icon: "🚀", template: "outbound", members: ["xabc1234"], goal: "" };

  it("accepts a good team", () => {
    expect(checkNewTeam(good)).toBeNull();
  });

  it("refuses bad input", () => {
    expect(checkNewTeam({ ...good, name: "  " })).toBe("A team name is required.");
    expect(checkNewTeam({ ...good, icon: "x" })).not.toBeNull();
    expect(checkNewTeam({ ...good, template: "x" })).not.toBeNull();
    expect(checkNewTeam({ ...good, id: "bad" })).not.toBeNull();
    expect(checkNewTeam({ ...good, members: ["<script>"] })).not.toBeNull();
    expect(checkNewTeam(null)).not.toBeNull();
  });

  it("cleans member lists", () => {
    expect(cleanMemberIds(["xabc1234", "xabc1234", "xdef5678"])).toEqual(["xabc1234", "xdef5678"]);
    expect(cleanMemberIds("x")).toBeNull();
    expect(cleanMemberIds(Array.from({ length: 51 }, (_, i) => `xaaaaaa${i.toString(36).padStart(2, "0")}`))).toBeNull();
  });

  it("builds the row with trimmed fields and the icon tint", () => {
    const t = buildTeam({ ...good, name: "  EMEA  ", goal: " Win. " }, "2026-01-01T00:00:00.000Z");
    expect(t).toMatchObject({ name: "EMEA", goal: "Win.", iconBg: "#e5f0fe", template: "outbound", members: ["xabc1234"], meetings: 0, leads: 0 });
  });
});
