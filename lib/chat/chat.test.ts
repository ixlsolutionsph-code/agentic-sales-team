import { describe, expect, it } from "vitest";
import type { AIJson } from "@/lib/ai/engine";
import type { JobRow } from "@/lib/jobs/store";
import type { ChatMessage } from "@/lib/types";
import { latestQuestion, readScrapeAnswer, readWriteAnswer, scrapeAnswerMessage, writeAnswerMessage } from "./clarify";
import { OFFER_REPLIES, converse, tidyReply, type ConverseInput } from "./converse";
import { jsonMarker, marker, readJsonMarker, stripMarkers, type Offer, type ScrapeBriefCard, type WritePick } from "./markers";
import { MSG_NOBODY, ackText, describeWork, parseMentions, pickSpeaker, resolve, type ChatAgent, type ChatTeam } from "./orchestrate";
import { OUTREACH_ASK, isEveryone, namesSummary, outreachPickMessage } from "./outreachTarget";
import {
  ANYWHERE,
  ANY_PRODUCT,
  MSG_ASK_COUNT_MORE,
  MSG_ASK_ONE,
  MSG_NO_PRODUCTS_YET,
  briefFromInstruction,
  briefFromIntent,
  fillFromText,
  isLookForMore,
  moreBrief,
  nextBriefStep,
  searchInstruction,
} from "./scrapeBrief";
import { isStopWord, looksLikeQuestion, readYesNo } from "./yesNo";

const agent = (id: string, name: string, capabilities: string[], paused = false): ChatAgent => ({
  id, name, role: "Agent", goal: "", capabilities, paused, settings: null,
});
const maya = agent("xm", "Maya Santos", ["outreach"]);
const sam = agent("xs", "Sam Cruz", ["scrape"]);
const ava = agent("xa", "Ava Lim", ["assess"]);
const team: ChatTeam = { id: "t1", name: "Sales", goal: "", members: [maya, sam] };
const other: ChatTeam = { id: "t2", name: "Review", goal: "", members: [ava] };
const msg = (id: number, who: string, text: string): ChatMessage => ({ id, who, text, createdAt: "2026-11-27T00:00:00Z" });
const products = [
  { name: "Nurse Pack", description: "Night nurses" },
  { name: "Bookkeeping", description: "Monthly books" },
];

describe("yes / no", () => {
  it("reads short answers", () => {
    for (const y of ["yes", "Yes, go ahead", "ok", "Proceed", "yes please", "sure!", "go for it"]) expect(readYesNo(y)).toBe("yes");
    for (const n of ["no", "No, thanks", "nope", "stop", "cancel", "not now"]) expect(readYesNo(n)).toBe("no");
  });
  it("ignores longer or mixed messages", () => {
    expect(readYesNo("no, find nurses in Texas")).toBeNull();
    expect(readYesNo("yes no")).toBeNull();
    expect(readYesNo("is it done?")).toBeNull();
    expect(readYesNo("yes ".repeat(11))).toBeNull(); // over 40 chars
    expect(readYesNo("please")).toBeNull();
  });
  it("knows stop words and questions", () => {
    expect(isStopWord("Stop everything")).toBe(true);
    expect(isStopWord("stop sending leads to Ana")).toBe(false);
    expect(looksLikeQuestion("what does the Assessor check?")).toBe(true);
    expect(looksLikeQuestion("how many hot leads do we have")).toBe(true);
    expect(looksLikeQuestion("can you find nurses in Texas")).toBe(false);
    expect(looksLikeQuestion("find HR managers")).toBe(false);
  });
});

describe("search brief", () => {
  it("asks the user to add products when the catalog is empty", () => {
    const s = nextBriefStep({ what: "nurses", where: "Manila", count: 5 }, []);
    expect(s).toEqual({ kind: "no-products", text: MSG_NO_PRODUCTS_YET });
    expect(MSG_NO_PRODUCTS_YET).toContain("Products page");
  });
  it("asks in order product → what → where → count", () => {
    const s = nextBriefStep({}, products);
    expect(s.kind).toBe("ask");
    if (s.kind !== "ask") return;
    expect(s.card.missing).toEqual(["product", "what", "where", "count"]);
    expect(s.card.products).toEqual(["Nurse Pack", "Bookkeeping", ANY_PRODUCT]);
    expect(s.card.brief.asks).toBe(1);
    expect(readJsonMarker<ScrapeBriefCard>(s.message, "scrape")?.missing).toEqual(s.card.missing);
  });
  it("chooses the only product and asks just one detail", () => {
    const s = nextBriefStep({ what: "HR managers at hospitals", where: "Manila" }, [products[0]]);
    expect(s.kind).toBe("ask");
    if (s.kind !== "ask") return;
    expect(s.card.missing).toEqual(["count"]);
    expect(s.card.brief.product).toBe("Nurse Pack");
    expect(s.text).toBe(MSG_ASK_ONE);
  });
  it("uses defaults after 2 asks but never guesses what", () => {
    const a = nextBriefStep({ what: "nurses", asks: 2 }, products);
    expect(a.kind).toBe("ready");
    if (a.kind === "ready") {
      expect(a.brief).toEqual({ product: ANY_PRODUCT, what: "nurses", where: ANYWHERE, count: 10 });
      expect(a.target).toBe(10);
    }
    const b = nextBriefStep({ asks: 2 }, products);
    expect(b.kind === "ask" && b.card.missing).toEqual(["what"]);
  });
  it("caps the count at 25 and builds the instruction", () => {
    const s = nextBriefStep({ product: "nurse pack", what: "HR managers at hospitals", where: "Manila", count: 99 }, products);
    expect(s.kind).toBe("ready");
    if (s.kind !== "ready") return;
    expect(s.target).toBe(25);
    expect(s.instruction).toBe("HR managers at hospitals. Selling: Nurse Pack (Night nurses). Location: Manila.");
    expect(searchInstruction({ product: ANY_PRODUCT, what: "x", where: ANYWHERE }, products)).toBe("x. Selling: Nurse Pack, Bookkeeping. Location: Anywhere.");
  });
  it("reads the brief back from an instruction", () => {
    expect(briefFromInstruction("HR managers. Selling: Nurse Pack (Night nurses). Location: Manila.")).toEqual({
      what: "HR managers",
      product: "Nurse Pack",
      where: "Manila",
    });
  });
  it("look for more keeps what and where and asks only the count", () => {
    expect(isLookForMore("look for more")).toBe(true);
    expect(isLookForMore("find more leads please")).toBe(true);
    expect(isLookForMore("find nurses")).toBe(false);
    const s = nextBriefStep(moreBrief({ what: "nurses", where: "Cebu", product: "Nurse Pack", count: 10, asks: 1 }), products, { more: true });
    expect(s.kind === "ask" && s.card.missing).toEqual(["count"]);
    expect(s.kind === "ask" && s.text).toBe(MSG_ASK_COUNT_MORE);
  });
  it("fills the brief from typed answers", () => {
    expect(fillFromText({ asks: 1 }, "HR managers in Manila, 10 leads", products)).toMatchObject({ what: "HR managers", where: "Manila", count: 10 });
    expect(fillFromText({ what: "nurses", asks: 1 }, "anywhere", products)).toMatchObject({ where: ANYWHERE });
    expect(fillFromText({ what: "nurses", where: "Cebu", asks: 1 }, "Bookkeeping, 5", products)).toMatchObject({ product: "Bookkeeping", count: 5 });
  });
  it("builds the brief from an intent", () => {
    expect(briefFromIntent({ titles: ["HR managers"], industry: "hospitals", geo: "Manila", target: 10 }, "find for the Nurse Pack", products)).toEqual({
      asks: 0,
      what: "HR managers at hospitals",
      where: "Manila",
      count: 10,
      product: "Nurse Pack",
    });
  });
});

describe("card answers and open questions", () => {
  it("round-trips the search card answer", () => {
    const text = scrapeAnswerMessage({ what: "HR managers", where: "Manila", count: 10 });
    expect(stripMarkers(text)).toBe("Looking for: HR managers · Where: Manila · 10 leads");
    expect(readScrapeAnswer(text)).toEqual({ what: "HR managers", where: "Manila", count: 10 });
  });
  it("round-trips the picker answer", () => {
    const some = writeAnswerMessage([{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }]);
    expect(stripMarkers(some)).toBe("Write to «Ana», «Ben»");
    expect(readWriteAnswer(some)).toEqual({ ids: ["a", "b"] });
    expect(readWriteAnswer(writeAnswerMessage("all"))).toEqual({ ids: "all" });
  });
  it("finds the latest question and whether it was answered", () => {
    const card: ScrapeBriefCard = { brief: { asks: 1 }, missing: ["what"], products: [] };
    const thread = [msg(1, "xs", `Q${jsonMarker("scrape", card)}`), msg(2, "xm", "hello")];
    const q = latestQuestion(thread);
    expect(q?.kind).toBe("scrape");
    expect(q?.answered).toBe(false);
    expect(latestQuestion([...thread, msg(3, "me", "hi")])?.answered).toBe(true);
    const approve = latestQuestion([...thread, msg(4, "xs", `Proceed?${marker("approve", "job-1")}`)]);
    expect(approve).toMatchObject({ kind: "approve", jobId: "job-1" });
    const pick: WritePick = { leads: [{ id: "l1", name: "Ana", company: "A" }] };
    expect(latestQuestion([msg(5, "xm", `Who?${jsonMarker("writepick", pick)}`)])?.kind).toBe("writepick");
    const offer: Offer = { kind: "action", cap: "research", agentId: "xr" };
    expect(latestQuestion([msg(6, "xr", `Try?${jsonMarker("offer", offer)}`)])).toMatchObject({ kind: "offer", offer });
    expect(latestQuestion([msg(7, "me", `x${marker("approve", "j")}`)])).toBeNull();
  });
});

describe("outreach target", () => {
  it("asks with a picker of at most 50 leads", () => {
    const leads = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, name: `Lead ${i}`, company: "Co" }));
    const text = outreachPickMessage(leads);
    expect(stripMarkers(text)).toBe(OUTREACH_ASK);
    expect(readJsonMarker<WritePick>(text, "writepick")?.leads).toHaveLength(50);
  });
  it("reads everyone and writes name lists", () => {
    expect(isEveryone("reach everyone in the book")).toBe(true);
    expect(isEveryone("Ana and Ben")).toBe(false);
    expect(namesSummary(["Ana", "Ben", "Cy"])).toBe("«Ana», «Ben» and «Cy»");
    expect(namesSummary(["A", "B", "C", "D", "E", "F"])).toBe("«A», «B», «C», «D» and 2 more");
  });
});

describe("routing", () => {
  it("parses mentions by first name or full name without spaces", () => {
    expect(parseMentions("@maya and @SamCruz, hi @Nobody", [maya, sam])).toEqual(["xm", "xs"]);
    expect(parseMentions("@Maya's turn", [maya])).toEqual(["xm"]);
  });
  it("lets the mentioned agent act when it can", () => {
    const r = resolve("scrape", team, sam, [team, other]);
    expect(r).toMatchObject({ kind: "act", agent: { id: "xs" }, lines: [] });
  });
  it("hands off to a teammate with the spec's line", () => {
    const r = resolve("scrape", team, maya, [team, other]);
    expect(r.kind).toBe("act");
    if (r.kind !== "act") return;
    expect(r.agent.id).toBe("xs");
    expect(r.lines).toEqual([{ who: "xm", text: "This needs lead scraping. That is the area of @Sam, not mine. I am sending this to them." }]);
  });
  it("sends to another team", () => {
    const r = resolve("assess", team, null, [team, other]);
    expect(r.kind === "act" && r.team.id).toBe("t2");
    expect(r.kind === "act" && r.lines[0].text).toBe("No one on this team does lead assessment. @Ava does. I am sending this to them.");
  });
  it("says when nobody can, and when it is soon", () => {
    expect(resolve("research", team, null, [team]).kind === "none" && resolve("research", team, null, [team])).toMatchObject({
      text: "No agent can research leads yet. Create an agent with that capability, and I will send requests to it.",
    });
    expect(resolve("follow-up", team, null, [team])).toMatchObject({ kind: "soon", text: "Follow-ups isn't available yet, so I'm unable to run it at the moment." });
    expect(resolve("book-meeting", team, null, [team])).toMatchObject({ kind: "soon", text: "Meeting booking isn't available yet, so I'm unable to run it at the moment." });
  });
  it("prefers a live teammate over a paused one", () => {
    const paused = agent("xp", "Pat", ["scrape"], true);
    const t: ChatTeam = { ...team, members: [maya, paused, sam] };
    expect(resolve("scrape", t, null, [t]).kind === "act" && (resolve("scrape", t, null, [t]) as { agent: ChatAgent }).agent.id).toBe("xs");
  });
  it("picks who speaks", () => {
    expect(pickSpeaker(team, null, [{ who: "me" }, { who: "xs" }, { who: "me" }])?.id).toBe("xs");
    expect(pickSpeaker(team, null, [])?.id).toBe("xm");
    expect(pickSpeaker(team, sam, [])?.id).toBe("xs");
  });
  it("has the fixed texts", () => {
    expect(ackText("outreach", "«Ana»")).toBe("Understood. I'm drafting emails now («Ana»).");
    expect(MSG_NOBODY).toBe("No one picked that up. Try @mentioning an agent on this team.");
  });
});

describe("describeWork", () => {
  const job = (over: Partial<JobRow>): JobRow => ({
    id: "j", workspaceId: "w", agentId: "xm", kind: "outreach", status: "done",
    params: { agent: { id: "xm", name: "Maya", role: "", goal: "", task: "" }, leadCount: 3 },
    result: { picked: 3, draftsCreated: 3 }, error: null, createdAt: "", startedAt: null, finishedAt: null, ...over,
  });
  it("describes the last real job", () => {
    expect(describeWork(job({}))).toBe("I've just finished drafting outreach: drafted 3 emails.");
    expect(describeWork(job({ status: "running" }))).toBe("I'm drafting emails right now on 3 leads.");
    expect(describeWork(job({ status: "failed", error: "Timed out." }))).toContain("didn't finish: Timed out.");
    expect(describeWork(job({ kind: "scrape", result: { leadsFound: 8 } }))).toBe("I've just finished a lead search: found 8 new leads.");
    expect(describeWork(null)).toContain("haven't run anything");
  });
});

describe("converse", () => {
  const input: ConverseInput = {
    agent: maya,
    team,
    history: [msg(1, "me", "hi ⟦run:x⟧"), msg(2, "xs", "Hello")],
    question: "how many hot leads do we have?",
    facts: "Leads in the book (accepted): 4 (2 hot)",
  };
  it("uses the fallback with no AI", async () => {
    expect(await converse(input, null, "facts answer")).toBe("facts answer");
  });
  it("fences the data and adds an offer when one fits", async () => {
    let prompt = "";
    const ai: AIJson = async (_s, p) => {
      prompt = p;
      return { reply: "We have 2 hot leads 🔥. Want me to draft emails to them?", offer: "outreach" } as never;
    };
    const out = await converse(input, ai, "fb");
    expect(prompt).toContain("<untrusted>");
    expect(prompt).not.toContain("⟦run");
    expect(stripMarkers(out)).toBe("We have 2 hot leads . Want me to draft emails to them?");
    expect(readJsonMarker<Offer>(out, "offer")).toEqual({ kind: "action", cap: "outreach", agentId: "xm" });
    expect(readJsonMarker<string[]>(out, "replies")).toEqual(OFFER_REPLIES);
  });
  it("drops offers the team can't run and falls back on errors", async () => {
    const ai: AIJson = async () => ({ reply: "Two hot leads.", offer: "proposal" }) as never;
    expect(await converse(input, ai, "fb")).toBe("Two hot leads.");
    const bad: AIJson = async () => {
      throw new Error("503");
    };
    expect(await converse(input, bad, "fb")).toBe("fb");
  });
  it("keeps at most 4 sentences and no marker brackets", () => {
    expect(tidyReply("A. B. C. D. E.")).toBe("A. B. C. D.");
    expect(tidyReply("Hi ⟦approve:x⟧")).toBe("Hi approve:x");
  });
});

import { isVagueWhat } from "./scrapeBrief";
describe("vague buyer words", () => {
  it("never takes 'leads' or 'some new prospects' as the buyer", () => {
    expect(isVagueWhat("leads")).toBe(true);
    expect(isVagueWhat("some new prospects")).toBe(true);
    expect(isVagueWhat("HR managers at hospitals")).toBe(false);
  });
});
