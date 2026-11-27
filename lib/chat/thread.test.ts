import { describe, expect, it } from "vitest";
import { jsonMarker, marker, repliesMarker } from "./markers";
import {
  activeTrigger,
  anyUnread,
  cardsOf,
  hasCards,
  lastStoredId,
  markSeen,
  mergeThread,
  OFFER_REPLIES,
  pickChatTeam,
  pickedLeadIds,
  replaceRange,
  runIdsOf,
  segmentText,
  speakerChanged,
  tokenBefore,
  type ChatRow,
} from "./thread";

const msg = (id: number, who: string, text: string): ChatRow => ({ id, who, text, createdAt: "2026-11-27T00:00:00.000Z" });

describe("mergeThread", () => {
  it("dedupes by id and keeps id order", () => {
    const out = mergeThread([msg(1, "me", "a"), msg(3, "x", "c")], [msg(2, "x", "b"), msg(3, "x", "c2")]);
    expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(out[2].text).toBe("c2");
  });

  it("keeps local rows last", () => {
    const local = { ...msg(-1, "me", "hello"), local: true };
    const out = mergeThread([msg(1, "x", "hi"), local], [msg(2, "x", "news")]);
    expect(out.map((r) => r.id)).toEqual([1, 2, -1]);
  });

  it("a stored me row replaces the matching local one", () => {
    const local = { ...msg(-1, "me", "find leads"), local: true };
    const out = mergeThread([local], [msg(5, "me", "find leads"), msg(6, "a1", "On it")]);
    expect(out.map((r) => r.id)).toEqual([5, 6]);
  });

  it("only one local row goes per stored row, and errors stay", () => {
    const a = { ...msg(-1, "me", "yes"), local: true };
    const b = { ...msg(-2, "me", "yes"), local: true };
    const err = { ...msg(-3, "system", "oops"), local: true, error: true };
    const out = mergeThread([a, b, err], [msg(7, "me", "yes")]);
    expect(out.map((r) => r.id)).toEqual([7, -2, -3]);
  });

  it("an already known me row does not eat a new local one", () => {
    const local = { ...msg(-1, "me", "yes"), local: true };
    const out = mergeThread([msg(7, "me", "yes"), local], [msg(7, "me", "yes")]);
    expect(out.map((r) => r.id)).toEqual([7, -1]);
  });

  it("finds the cursor", () => {
    expect(lastStoredId([msg(4, "x", ""), { ...msg(-9, "me", ""), local: true }, msg(2, "x", "")])).toBe(4);
    expect(lastStoredId([])).toBe(0);
  });
});

describe("pickChatTeam", () => {
  const teams = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
  it("prefers the active team", () => {
    expect(pickChatTeam(teams, { t1: [msg(9, "x", "")] }, "t2")).toBe("t2");
  });
  it("else the team with the newest message", () => {
    expect(pickChatTeam(teams, { t1: [msg(3, "x", "")], t3: [msg(9, "x", "")] }, null)).toBe("t3");
    expect(pickChatTeam(teams, {}, "gone")).toBe("t1");
  });
  it("is null with no teams", () => {
    expect(pickChatTeam([], {}, null)).toBeNull();
  });
});

describe("speakerChanged", () => {
  it("shows the name when the agent changes", () => {
    expect(speakerChanged(undefined, msg(1, "a1", ""))).toBe(true);
    expect(speakerChanged(msg(1, "a1", ""), msg(2, "a1", ""))).toBe(false);
    expect(speakerChanged(msg(1, "me", ""), msg(2, "a1", ""))).toBe(true);
    expect(speakerChanged(msg(1, "a1", ""), msg(2, "me", ""))).toBe(false);
    expect(speakerChanged(msg(1, "a1", ""), msg(2, "system", ""))).toBe(false);
  });
});

describe("segmentText", () => {
  it("makes lead pills, mention pills and links", () => {
    const s = segmentText("I found «Ana Cruz». @Maya, check the leads and drafts.", ["Maya"]);
    expect(s).toEqual([
      { t: "text", text: "I found " },
      { t: "lead", text: "Ana Cruz" },
      { t: "text", text: ". " },
      { t: "mention", text: "@Maya" },
      { t: "text", text: ", check " },
      { t: "link", text: "the leads", href: "/leads" },
      { t: "text", text: " and " },
      { t: "link", text: "drafts", href: "/emails" },
      { t: "text", text: "." },
    ]);
  });
  it("links your catalog and calendar, and @You is a pill", () => {
    const s = segmentText("@You, see your catalog and the Calendar.");
    expect(s.filter((x) => x.t !== "text")).toEqual([
      { t: "mention", text: "@You" },
      { t: "link", text: "your catalog", href: "/products" },
      { t: "link", text: "Calendar", href: "/calendar" },
    ]);
  });
  it("leaves unknown mentions and emails as text", () => {
    const s = segmentText("Write to ana@acme.com or @Nobody", ["Maya"]);
    expect(s.every((x) => x.t === "text")).toBe(true);
    expect(s.map((x) => x.text).join("")).toBe("Write to ana@acme.com or @Nobody");
  });
  it("can skip links (for my own messages)", () => {
    expect(segmentText("the leads", [], false)).toEqual([{ t: "text", text: "the leads" }]);
  });
});

describe("cardsOf", () => {
  it("reads every card marker", () => {
    const text =
      "Here." +
      marker("approve", "j1") +
      marker("run", "j2") +
      marker("leads", "l1,l2") +
      jsonMarker("scrape", { brief: { what: "HR" }, missing: ["count"], products: [] }) +
      jsonMarker("writepick", { leads: [{ id: "l1", name: "Ana", company: "Acme" }] }) +
      repliesMarker(["5", "10"]);
    const c = cardsOf(text);
    expect(c.approve).toBe("j1");
    expect(c.run).toBe("j2");
    expect(c.leads).toEqual(["l1", "l2"]);
    expect(c.scrape?.missing).toEqual(["count"]);
    expect(c.writepick?.leads[0].name).toBe("Ana");
    expect(c.replies).toEqual(["5", "10"]);
    expect(hasCards(c)).toBe(true);
  });
  it("an offer without replies gets Yes / No", () => {
    const c = cardsOf("Want me to look wider?" + jsonMarker("offer", { kind: "action", cap: "outreach", agentId: "a1" }));
    expect(c.replies).toEqual(OFFER_REPLIES);
    expect(c.offer?.kind).toBe("action");
  });
  it("draws nothing for job, answer and meet markers", () => {
    const c = cardsOf("Done" + marker("job", "j9") + marker("meet", "x|2026-01-01") + marker("answer", "%7B%7D"));
    expect(hasCards(c)).toBe(false);
  });
  it("collects run ids", () => {
    expect(runIdsOf([{ text: marker("run", "a") }, { text: "x" + marker("run", "b") + marker("run", "a") }])).toEqual(["a", "b"]);
  });
});

describe("composer helpers", () => {
  it("finds the @ trigger", () => {
    expect(activeTrigger("hi @Ma", 6)).toEqual({ kind: "mention", start: 3, query: "Ma" });
    expect(activeTrigger("@", 1)).toEqual({ kind: "mention", start: 0, query: "" });
    expect(activeTrigger("ana@acme", 8)).toBeNull();
  });
  it("finds the /lead trigger", () => {
    expect(activeTrigger("write to /lead", 14)).toEqual({ kind: "lead", start: 9, query: "" });
    expect(activeTrigger("/lead an", 8)).toEqual({ kind: "lead", start: 0, query: "an" });
    expect(activeTrigger("a/lead", 6)).toBeNull();
  });
  it("Backspace deletes a whole token", () => {
    expect(tokenBefore("write to «Ana Cruz» ", 20)).toBe(9);
    expect(tokenBefore("write to «Ana Cruz»", 19)).toBe(9);
    expect(tokenBefore("hey @Maya ", 10)).toBe(4);
    expect(tokenBefore("hey Maya ", 9)).toBe(-1);
    expect(tokenBefore("hey @Maya", 9)).toBe(-1);
  });
  it("replaces a range", () => {
    expect(replaceRange("hi @Ma there", 3, 6, "@Maya ")).toEqual({ text: "hi @Maya  there", caret: 9 });
  });
  it("sends only picks still in the text", () => {
    const picked = [
      { id: "l1", name: "Ana" },
      { id: "l2", name: "Ben" },
    ];
    expect(pickedLeadIds("write to «Ana»", picked)).toEqual(["l1"]);
  });
});

describe("unread", () => {
  it("keeps the highest seen id", () => {
    expect(markSeen({ t1: 5 }, "t1", 3)).toEqual({ t1: 5 });
    expect(markSeen({ t1: 5 }, "t1", 8)).toEqual({ t1: 8 });
    expect(markSeen({}, "t2", 0)).toEqual({});
  });
  it("ignores the open team for the tab dot", () => {
    expect(anyUnread({ t1: 2 }, "t1")).toBe(false);
    expect(anyUnread({ t1: 2, t2: 1 }, "t1")).toBe(true);
    expect(anyUnread({ t1: 0 }, null)).toBe(false);
  });
});
