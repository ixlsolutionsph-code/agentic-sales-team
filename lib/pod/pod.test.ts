import { describe, expect, it } from "vitest";
import { findMarker, readJsonMarker, stripMarkers, type Offer } from "@/lib/chat/markers";
import { MSG_RUN_FAILED, MSG_SEARCH_FAILED } from "@/lib/jobs/limits";
import { autoCaps, capMode, needsApproval } from "./autonomy";
import { decideChain, nextStage, stageOwner, type ChainJob, type ChainMember } from "./chain";
import {
  MSG_CANCEL_NOTHING,
  MSG_NO_FIT,
  MSG_NO_MATCHES,
  MSG_NO_NEW_LEADS,
  busyText,
  cancelSummary,
  firstName,
  leadList,
  scrapeAskText,
  stageAskText,
  startText,
  widenBrief,
  widerOfferText,
  withApprove,
} from "./summary";

const m = (id: string, name: string, capabilities: string[], paused = false): ChainMember => ({ id, name, capabilities, paused });
const FULL: ChainMember[] = [
  m("xs", "Sam Scout", ["scrape"]),
  m("xa", "Maya Reyes", ["assess"]),
  m("xr", "Rex", ["research"]),
  m("xq", "Quinn", ["qualify"]),
  m("xm", "Mia", ["match"]),
  m("xw", "Wes", ["outreach"]),
  m("xc", "Cleo", ["proposal"]),
];
const brief = { product: "HR software", what: "HR managers at hospitals", where: "Makati, Manila, Philippines", count: 10 };
const job = (over: Partial<ChainJob>): ChainJob => ({ kind: "research", agentId: "xr", status: "done", error: null, result: {}, ...over });

describe("autonomy", () => {
  it("treats only auto as Auto", () => {
    expect(capMode({ research: { mode: "auto" } }, "research")).toBe("auto");
    expect(capMode({ research: { mode: "ask" } }, "research")).toBe("ask");
    expect(capMode(null, "research")).toBe("ask");
    expect(needsApproval({ scrape: { mode: "AUTO" } }, "scrape")).toBe(true);
    expect(autoCaps({ scrape: { mode: "auto" }, research: {}, match: { mode: "auto" } })).toEqual(["scrape", "match"]);
    expect(autoCaps({ scrape: { mode: "auto" } }, ["research", "scrape"])).toEqual(["scrape"]);
  });
});

describe("picking the stage owner and the next stage", () => {
  it("picks the first live, not paused member in team order", () => {
    const team = [m("a", "Ann", ["research"], true), m("b", "Ben", ["research"]), m("c", "Cy", ["research"])];
    expect(stageOwner(team, "research")?.id).toBe("b");
    expect(stageOwner(team, "match")).toBeNull();
  });

  it("skips stages nobody covers", () => {
    const team = [m("a", "Ann", ["assess"]), m("w", "Wes", ["outreach"])];
    expect(nextStage("assess", team, false)).toEqual({ kind: "outreach", agent: team[1] });
    expect(nextStage("outreach", team, false)).toBeNull();
  });

  it("only hands a scrape to the Assessor", () => {
    expect(nextStage("scrape", FULL, false)).toMatchObject({ kind: "assess", agent: { id: "xa" } });
    expect(nextStage("scrape", FULL.filter((x) => x.id !== "xa"), false)).toBeNull();
  });

  it("skips match and stops before proposal with an empty catalog", () => {
    expect(nextStage("qualify", FULL, true)).toMatchObject({ kind: "outreach" });
    expect(nextStage("outreach", FULL, true)).toEqual({ stop: "no-products" });
    expect(nextStage("outreach", FULL.filter((x) => x.id !== "xc"), true)).toBeNull();
  });
});

describe("chain decisions", () => {
  it("hands new leads to the Assessor with exactly their ids", () => {
    const out = decideChain(job({ kind: "scrape", agentId: "xs", result: { leadsFound: 2, leadIds: ["l1", "l2"] } }), FULL, false);
    expect(stripMarkers(out.text)).toBe("I found 2 new leads. @Maya, please review them.");
    expect(findMarker(out.text, "leads")).toBe("l1,l2");
    expect(out.next).toEqual({ kind: "assess", agentId: "xa", leadIds: ["l1", "l2"] });
  });

  it("asks the user to review when there is no Assessor", () => {
    const out = decideChain(job({ kind: "scrape", agentId: "xs", result: { leadsFound: 1, leadIds: ["l1"] } }), [FULL[0]], false);
    expect(stripMarkers(out.text)).toBe("I found 1 new lead. @You, they are ready for you to review and accept.");
    expect(out.next).toBeNull();
  });

  it("stops a search with no new leads and offers a wider one", () => {
    const out = decideChain(job({ kind: "scrape", agentId: "xs", result: { leadsFound: 0, leadIds: [] }, brief }), FULL, false);
    expect(out.next).toBeNull();
    expect(stripMarkers(out.text)).toBe(`${MSG_NO_NEW_LEADS}\n\nWant me to look again with a wider scope? I'll search for 10 leads in Philippines.`);
    const offer = readJsonMarker<Offer>(out.text, "offer");
    expect(offer).toEqual({ kind: "wider-search", brief: { ...brief, where: "Philippines", asks: undefined }, agentId: "xs" });
    expect(readJsonMarker<string[]>(out.text, "replies")).toEqual(["Yes, go ahead", "No, thanks"]);
  });

  it("stops when the Assessor accepts none, with the wider offer from the Scout", () => {
    const out = decideChain(job({ kind: "assess", agentId: "xa", result: { picked: 3, accepted: 0, dismissed: 3 }, brief }), FULL, false);
    expect(stripMarkers(out.text).startsWith(MSG_NO_FIT)).toBe(true);
    expect(readJsonMarker<Offer>(out.text, "offer")?.agentId).toBe("xs");
    expect(out.next).toBeNull();
  });

  it("hands on after assess and names the next agent", () => {
    const out = decideChain(job({ kind: "assess", agentId: "xa", result: { picked: 8, accepted: 6, dismissed: 2 } }), FULL, false);
    expect(out.text).toBe("I accepted 6 of 8 leads. @Rex, please do the research.");
    expect(out.next).toEqual({ kind: "research", agentId: "xr" });
  });

  it("says Next when the same agent does the next stage", () => {
    const team = [m("xr", "Rex", ["research", "qualify"])];
    const out = decideChain(job({ result: { picked: 3, researched: 3 } }), team, false);
    expect(out.text).toBe("I researched 3 leads. Next, I'll do the scoring.");
    expect(out.next).toEqual({ kind: "qualify", agentId: "xr" });
  });

  it("stops with the fixed text when nothing moved", () => {
    const out = decideChain(job({ result: { picked: 0, researched: 0 } }), FULL, false);
    expect(out).toEqual({ text: "None of the team's leads need research right now, so I stopped here.", next: null });
  });

  it("stops on failed leads with Try again", () => {
    const out = decideChain(job({ result: { picked: 5, researched: 3, failed: 2 } }), FULL, false);
    expect(stripMarkers(out.text)).toBe("I researched 3 leads. @You, I couldn't finish 2 leads because of an error. I stopped the chain here.");
    expect(readJsonMarker<string[]>(out.text, "replies")).toEqual(["Try again"]);
    expect(readJsonMarker<Offer>(out.text, "offer")).toEqual({ kind: "action", cap: "research", agentId: "xr" });
    expect(out.next).toBeNull();
  });

  it("passes on a match with no matches", () => {
    const out = decideChain(job({ kind: "match", agentId: "xm", result: { picked: 4, matched: 4, matches: 0 } }), FULL, false);
    expect(out.text).toBe(`${MSG_NO_MATCHES} @Wes, please do the email drafts.`);
    expect(out.next).toEqual({ kind: "outreach", agentId: "xw" });
  });

  it("stops before proposals with an empty catalog", () => {
    const out = decideChain(job({ kind: "outreach", agentId: "xw", result: { picked: 2, draftsCreated: 2 } }), FULL, true);
    expect(out.text).toBe(
      "I drafted 2 emails. @You, there are no products in the catalog yet, so I stopped before the proposals. Add products on the Products page.",
    );
    expect(out.next).toBeNull();
  });

  it("ends with the final line to the user", () => {
    const p = decideChain(job({ kind: "proposal", agentId: "xc", result: { picked: 2, proposalsCreated: 2 } }), FULL, false);
    expect(p.text).toBe("I wrote 2 proposals. @You, the proposals are ready for you to review and send.");
    const o = decideChain(job({ kind: "outreach", agentId: "xw", result: { picked: 2, draftsCreated: 2 } }), FULL.slice(0, 6), false);
    expect(o.text).toBe("I drafted 2 emails. @You, the drafts are ready for you to review and send.");
  });

  it("hands nothing on after Cancel", () => {
    const out = decideChain(job({ result: { picked: 3, researched: 3 }, stopped: true }), FULL, false);
    expect(out).toEqual({ text: "I researched 3 leads, but you stopped the run, so I didn't pass it on.", next: null });
  });

  it("posts the error of a failed job", () => {
    expect(decideChain(job({ status: "failed", error: "AI isn't set up." }), FULL, false).text).toBe("AI isn't set up.");
    expect(decideChain(job({ status: "failed", error: null }), FULL, false).text).toBe(MSG_RUN_FAILED);
    expect(decideChain(job({ kind: "scrape", status: "failed", error: null }), FULL, false).text).toBe(MSG_SEARCH_FAILED);
  });
});

describe("wider search", () => {
  it("widens the place, then anywhere, then doubles the count up to 25", () => {
    expect(widenBrief({ what: "x", where: "Makati, Manila, Philippines", count: 10 })?.where).toBe("Philippines");
    expect(widenBrief({ what: "x", where: "Philippines", count: 10 })?.where).toBe("anywhere");
    expect(widenBrief({ what: "x", where: "anywhere", count: 10 })).toMatchObject({ where: "anywhere", count: 20 });
    expect(widenBrief({ what: "x", where: "Anywhere", count: 15 })?.count).toBe(25);
    expect(widenBrief({ what: "x", where: "anywhere", count: 25 })).toBeNull();
  });

  it("offers nothing without a brief or a Scout", () => {
    expect(widerOfferText(undefined, "xs")).toBe("");
    expect(widerOfferText(brief, null)).toBe("");
    expect(stripMarkers(widerOfferText({ what: "x", where: "anywhere", count: 10 }, "xs"))).toBe(
      "Want me to look again with a wider scope? I'll search for 20 leads anywhere.",
    );
  });
});

describe("asks and starts", () => {
  it("writes the search ask from the brief", () => {
    expect(scrapeAskText(brief, 10)).toBe(
      "I'm ready to search:\n• For: HR software\n• Looking for: HR managers at hospitals\n• Where: Makati, Manila, Philippines\n• How many: 10 leads.\nProceed?",
    );
    expect(scrapeAskText({ what: "VA buyers", where: "anywhere" }, 1)).toContain("• For: Any product\n• Looking for: VA buyers\n• Where: Anywhere\n• How many: 1 lead.");
  });

  it("names the leads in the stage ask", () => {
    expect(stageAskText("research", 5, ["Ana Cruz", "Ben Li", "Joy Tan", "Kim", "Lee"])).toBe(
      "I'm ready to research 5 leads: «Ana Cruz», «Ben Li», «Joy Tan» and 2 more. Proceed?",
    );
    expect(stageAskText("outreach", 2, ["Ana", "Ben"])).toBe("I'm ready to write emails to 2 leads: «Ana» and «Ben». Proceed?");
    expect(leadList(["A"])).toBe("«A»");
  });

  it("adds the markers", () => {
    expect(withApprove("Proceed?", "j1")).toBe("Proceed?⟦approve:j1⟧");
    expect(startText("scrape", "j1")).toBe("Okay, starting the search now. I will post the results here.⟦run:j1⟧");
    expect(startText("research", "j1")).toBe("Okay, starting now.");
  });

  it("explains a busy stage", () => {
    expect(busyText("scrape", true)).toBe("There is already a lead search waiting for your go-ahead. Press Proceed or Cancel on it first.");
  });

  it("mentions by first name", () => {
    expect(firstName("  Maya Reyes ")).toBe("Maya");
  });
});

describe("cancel summary", () => {
  it("lists what the run did", () => {
    const text = cancelSummary([
      { kind: "scrape", status: "done", agentName: "Sam Scout", result: { leadsFound: 8 } },
      { kind: "assess", status: "failed", agentName: "Maya", result: {} },
      { kind: "research", status: "running", agentName: "Rex", result: null },
      { kind: "qualify", status: "dismissed", agentName: "Quinn", result: null },
    ]);
    expect(text).toBe(
      "Okay, stopping now. Here's a summary of what we did:\n• Sam found 8 leads\n• Maya's review didn't finish\n• Rex was still researching leads. That step will finish, but nothing runs after it",
    );
    expect(cancelSummary([{ kind: "scrape", status: "failed", agentName: "Sam", result: {} }])).toContain("• Sam's search didn't finish");
  });

  it("says nothing changed when nothing was done", () => {
    expect(cancelSummary([])).toBe(MSG_CANCEL_NOTHING);
    expect(cancelSummary([{ kind: "scrape", status: "dismissed", agentName: "Sam", result: null }])).toBe(MSG_CANCEL_NOTHING);
  });

  it("uses no exclamation marks", () => {
    const texts = [MSG_NO_NEW_LEADS, MSG_NO_FIT, MSG_NO_MATCHES, MSG_CANCEL_NOTHING, scrapeAskText(brief, 10), stageAskText("match", 0)];
    for (const t of texts) expect(t).not.toContain("!");
  });
});
