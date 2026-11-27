import { describe, expect, it, vi } from "vitest";
import type { AIJson } from "./engine";
import { detectIntent, keywordIntent, searchParts } from "./intent";
import { matchLeadNames, resolveLeads } from "./resolveLeads";

vi.mock("server-only", () => ({}));

describe("keyword intent (no AI)", () => {
  it("follows the spec's order", () => {
    expect(keywordIntent("any updates?").intent).toBe("status");
    expect(keywordIntent("how many hot leads do we have?").intent).toBe("chat");
    expect(keywordIntent("find HR managers at hospitals in Manila")).toMatchObject({ intent: "scrape", what: "HR managers at hospitals", geo: "Manila" });
    expect(keywordIntent("@Maya find leads")).toMatchObject({ intent: "scrape", what: "" });
    expect(keywordIntent("book meetings with my hot leads").intent).toBe("book-meeting");
    expect(keywordIntent("follow up with Ana").intent).toBe("follow-up");
    expect(keywordIntent("write proposals for the warm leads").intent).toBe("proposal");
    expect(keywordIntent("qualify the new ones").intent).toBe("qualify");
    expect(keywordIntent("enrich the contacts").intent).toBe("enrich");
    expect(keywordIntent("match leads to products").intent).toBe("match");
    expect(keywordIntent("assess the pending leads").intent).toBe("assess");
    expect(keywordIntent("research Ana Cruz").intent).toBe("research");
    expect(keywordIntent("draft emails").intent).toBe("outreach");
    expect(keywordIntent("hello there").intent).toBe("chat");
  });
  it("reads the count from a search", () => {
    expect(searchParts("find 10 nurses in Cebu")).toEqual({ what: "nurses", geo: "Cebu", target: 10 });
  });
});

describe("detectIntent", () => {
  it("uses the LLM at temperature 0.2 with the message fenced", async () => {
    let seen: { prompt: string; t: number } | null = null;
    const ai: AIJson = async (_s, prompt, _schema, opts) => {
      seen = { prompt, t: opts.temperature };
      return { intent: "scrape", what: "HR managers", industry: "hospitals", titles: ["HR manager"], geo: "Manila", target: 40 } as never;
    };
    const r = await detectIntent("find HR managers in Manila", ai);
    expect(r).toMatchObject({ intent: "scrape", geo: "Manila", target: 25 });
    expect(seen!.t).toBe(0.2);
    expect(seen!.prompt).toContain("<untrusted>");
  });
  it("falls back to keywords on errors or bad answers", async () => {
    const bad: AIJson = async () => {
      throw new Error("503");
    };
    expect((await detectIntent("draft emails", bad)).intent).toBe("outreach");
    const odd: AIJson = async () => ({ intent: "dance" }) as never;
    expect((await detectIntent("any updates?", odd)).intent).toBe("status");
  });
});

describe("resolveLeads", () => {
  const leads = [
    { id: "1", name: "Ana Cruz", company: "A" },
    { id: "2", name: "Ben Lee", company: "B" },
    { id: "3", name: "Ben Ong", company: "C" },
  ];
  it("matches full names, pills and unique first names", () => {
    expect(matchLeadNames("write to «Ben Ong» and ana", leads)).toEqual(["3", "1"]);
    expect(matchLeadNames("write to Ben", leads)).toEqual([]);
  });
  it("reads all, some and none", async () => {
    expect(await resolveLeads("write to everyone", leads, null)).toEqual({ mode: "all", leadIds: [] });
    expect(await resolveLeads("email Ana Cruz", leads, null)).toEqual({ mode: "some", leadIds: ["1"] });
    expect(await resolveLeads("draft emails", leads, null)).toEqual({ mode: "none", leadIds: [] });
  });
  it("asks the LLM only when a name seems meant, and keeps only real ids", async () => {
    const ai: AIJson = async () => ({ mode: "some", leadIds: ["2", "zz"] }) as never;
    expect(await resolveLeads("write to Mr. Lee", leads, ai)).toEqual({ mode: "some", leadIds: ["2"] });
    const never: AIJson = async () => {
      throw new Error("should not be called");
    };
    expect(await resolveLeads("draft emails", leads, never)).toEqual({ mode: "none", leadIds: [] });
  });
});
