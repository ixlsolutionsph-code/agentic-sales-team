import { describe, expect, it } from "vitest";
import type { AIJson } from "@/lib/ai/engine";
import { searchSummary } from "@/lib/jobs/tasks";
import {
  FirecrawlError,
  buildSearches,
  corpusOf,
  extractProspects,
  fallbackPlan,
  lacksEmployer,
  normalizeProspects,
  perSearchLimit,
  planSearch,
  prospectsWithoutAI,
  readSearchReply,
  runSearches,
  urlKey,
  type Source,
} from "./firecrawl";
import { dropReason, gateSources, type GateAI } from "./gate";

function fakeAI(reply: unknown) {
  const calls: { prompt: string; opts: { temperature: number; maxTokens: number } }[] = [];
  const ai: AIJson = async (_s, prompt, _schema, opts) => {
    calls.push({ prompt, opts });
    return reply as never;
  };
  return { ai, calls };
}

const src = (url: string, title = "Post", description = ""): Source => ({ url, title, description, platform: "Reddit" });

describe("plan", () => {
  it("uses 0.15 / 400 and keeps 3 clean queries", async () => {
    const f = fakeAI({ mode: "intent", queries: ['site:reddit.com "need a VA"', "virtual assistant wanted", "hiring VA help", "fourth"], roles: ["x"], platform: "none" });
    const p = await planSearch("people looking for a virtual assistant in Texas", f.ai);
    expect(p).toEqual({ mode: "intent", queries: ["need a VA", "virtual assistant wanted", "hiring VA help"], roles: [], platform: null });
    expect(f.calls[0].opts).toEqual({ temperature: 0.15, maxTokens: 400 });
  });

  it("forces fit mode when LinkedIn is named", async () => {
    const p = await planSearch("HR managers on LinkedIn", fakeAI({ mode: "intent", queries: ["hospitals Manila"], roles: ["HR Manager"], platform: "none" }).ai);
    expect(p.mode).toBe("fit");
    expect(p.platform).toBe("linkedin");
    expect(p.roles).toEqual(["HR Manager"]);
  });

  it("falls back to one buyer query without AI", async () => {
    expect(await planSearch("Bookkeeping for cafes in Cebu", null)).toEqual(fallbackPlan("Bookkeeping for cafes in Cebu"));
    expect(fallbackPlan("Bookkeeping for cafes").queries).toEqual(["Bookkeeping for cafes looking to buy recommendations"]);
    expect(fallbackPlan("need help on reddit").platform).toBe("reddit");
  });
});

describe("searches", () => {
  it("limits each search to 4–8 results", () => {
    expect([perSearchLimit(1), perSearchLimit(6), perSearchLimit(25)]).toEqual([4, 6, 8]);
  });

  it("fit: LinkedIn people with the role and companies, at most 6, no date filter", () => {
    const s = buildSearches({ mode: "fit", queries: ["hospitals Manila", "medical centers Manila", "clinics Manila"], roles: ["HR Manager"], platform: "linkedin" }, 10);
    expect(s).toHaveLength(6);
    expect(s[0]).toEqual({ query: 'site:linkedin.com/in "HR Manager" hospitals Manila', limit: 8 });
    expect(s[1].query).toBe("site:linkedin.com/company hospitals Manila");
    expect(s.every((x) => !x.tbs)).toBe(true);
  });

  it("intent: Facebook and Reddit from the past month, or only the platform named", () => {
    const both = buildSearches({ mode: "intent", queries: ["need a VA", "VA wanted", "hiring help"], roles: [], platform: null }, 10);
    expect(both).toHaveLength(6);
    expect(both.map((x) => x.query.split(" ")[0])).toEqual(["site:facebook.com", "site:reddit.com", "site:facebook.com", "site:reddit.com", "site:facebook.com", "site:reddit.com"]);
    expect(both.every((x) => x.tbs === "qdr:m")).toBe(true);
    expect(buildSearches({ mode: "intent", queries: ["a", "b"], roles: [], platform: "reddit" }, 10)).toHaveLength(2);
  });
});

describe("Firecrawl", () => {
  it("reads data.web and older data replies, keeping only http(s) links", () => {
    expect(readSearchReply({ data: { web: [{ url: "https://reddit.com/r/x/1", title: "T", description: "D" }, { url: "javascript:alert(1)" }] } })).toEqual([
      { url: "https://reddit.com/r/x/1", title: "T", description: "D", platform: "Reddit" },
    ]);
    expect(readSearchReply({ data: [{ url: "https://www.linkedin.com/in/ana", title: "Ana" }] })[0].platform).toBe("LinkedIn");
    expect(readSearchReply({})).toEqual([]);
  });

  it("sends the key, the query and the limit, and removes duplicate links", async () => {
    const sent: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).authorization) });
      return new Response(JSON.stringify({ data: { web: [{ url: "https://www.reddit.com/r/a/1/?utm_source=x", title: "A" }, { url: "https://reddit.com/r/a/1", title: "A again" }] } }));
    };
    const out = await runSearches([{ query: "q1", limit: 5, tbs: "qdr:m" }, { query: "q2", limit: 5 }], "fc-test", fetchImpl);
    expect(out).toHaveLength(1);
    expect(sent[0]).toMatchObject({ url: "https://api.firecrawl.dev/v2/search", body: { query: "q1", limit: 5, tbs: "qdr:m" }, auth: "Bearer fc-test" });
    expect(sent[1].body.tbs).toBeUndefined();
    expect(urlKey("https://www.reddit.com/r/a/1/#top")).toBe(urlKey("https://reddit.com/r/a/1"));
  });

  it("skips a failed search, and throws only when all of them fail", async () => {
    let n = 0;
    const someFail = async () => (n++ === 0 ? new Response("", { status: 500 }) : new Response(JSON.stringify({ data: { web: [{ url: "https://reddit.com/r/b" }] } })));
    expect(await runSearches([{ query: "a", limit: 4 }, { query: "b", limit: 4 }], "k", someFail)).toHaveLength(1);
    const allFail = async () => new Response("", { status: 402 });
    await expect(runSearches([{ query: "a", limit: 4 }], "k", allFail)).rejects.toBeInstanceOf(FirecrawlError);
  });
});

describe("gate", () => {
  const sources = [src("https://reddit.com/1", "Need a VA"), src("https://reddit.com/2", "I am a VA for hire"), src("https://reddit.com/3", "Hiring me?")];
  const verdicts: Record<string, unknown> = {
    "https://reddit.com/1": { kind: "buyer", competitor: false },
    "https://reddit.com/2": { kind: "seller", competitor: true },
    "https://reddit.com/3": { kind: "job_seeker", competitor: false },
  };
  const ai: GateAI = async (_s, prompt) => verdicts[(prompt.match(/Link: (\S+)/) ?? [])[1] ?? ""];

  it("intent drops sellers and job seekers; fit drops competitors", async () => {
    const intent = await gateSources(sources, "intent", "We sell VA services", ai);
    expect(intent.kept.map((s) => s.url)).toEqual(["https://reddit.com/1"]);
    expect(intent.dropped.map((d) => d.why)).toEqual(["Seller", "Job seeker"]);
    const fit = await gateSources(sources, "fit", "We sell VA services", ai);
    expect(fit.dropped.map((d) => d.why)).toEqual(["Competitor"]);
    expect(dropReason({ kind: "other" }, "intent")).toBeNull();
  });

  it("fails open: errors, slow answers and no AI keep the result", async () => {
    const broken: GateAI = async () => {
      throw new Error("429");
    };
    expect((await gateSources(sources, "intent", "x", broken)).kept).toHaveLength(3);
    expect((await gateSources(sources, "intent", "x", null)).kept).toHaveLength(3);
    const slow: GateAI = () => new Promise((r) => setTimeout(() => r({ kind: "seller", competitor: true }), 200));
    const r = await gateSources(sources, "intent", "x", slow, { callMs: 1000, budgetMs: 50, concurrency: 16 });
    expect(r.kept).toHaveLength(3);
  });
});

describe("extract", () => {
  const used = [
    src("https://www.linkedin.com/in/ana", "Ana Cruz - HR Manager - St. Luke's", "ana@stlukes.ph"),
    src("https://www.linkedin.com/in/ben", "Ben - Freelance"),
    src("https://reddit.com/r/va/3", "Need a VA for my clinic"),
  ];

  it("fences every source and asks for target + 5 with 0.3 / 4000", async () => {
    const f = fakeAI({ prospects: [] });
    await extractProspects("HR managers", { mode: "fit", queries: ["q"], roles: ["HR Manager"], platform: "linkedin" }, used, 10, f.ai);
    expect(f.calls[0].opts).toEqual({ temperature: 0.3, maxTokens: 4000 });
    expect(f.calls[0].prompt).toContain("up to 15 leads");
    expect(f.calls[0].prompt.match(/<untrusted>/g)!.length).toBe(4); // the request + 3 sources
    expect(corpusOf(Array.from({ length: 200 }, (_, i) => src(`https://reddit.com/${i}`, "x".repeat(250), "y".repeat(500)))).text.length).toBeLessThanOrEqual(40_000);
  });

  it("keeps only real sources, real emails and real employers, once each", () => {
    const out = normalizeProspects(
      [
        { source: 1, name: "Ana Cruz", title: "HR Manager", company: "St. Luke's", email: "ana@stlukes.ph", fitReason: "Runs hiring at a big hospital" },
        { source: 1, name: "Ana again", title: "", company: "St. Luke's", email: "", fitReason: "" },
        { source: 2, name: "Ben", title: "VA", company: "Freelance", email: "", fitReason: "" },
        { source: 3, name: "u/clinicowner", title: "", company: "", email: "made@up.com", fitReason: "Needs a VA now" },
        { source: 9, name: "Ghost", title: "", company: "", email: "", fitReason: "" },
      ],
      used,
      10,
    );
    expect(out.map((p) => [p.name, p.email, p.profileUrl])).toEqual([
      ["Ana Cruz", "ana@stlukes.ph", "https://www.linkedin.com/in/ana"],
      ["u/clinicowner", "", "https://reddit.com/r/va/3"],
    ]);
    expect(lacksEmployer(" Self-employed ")).toBe(true);
    expect(lacksEmployer("Makati Medical Center")).toBe(false);
  });

  it("without AI, each result is a lead to review with a short reason", () => {
    const out = prospectsWithoutAI(used, "VA for clinics", 2);
    expect(out).toHaveLength(2);
    expect(out[0].fitReason).toBe("Found by searching for: VA for clinics");
  });
});

describe("summary", () => {
  it("reads N sources · N dropped · N leads", () => {
    expect(searchSummary({ sources: 14, dropped: 3, leadsFound: 1 })).toBe("14 sources · 3 dropped · 1 lead");
  });
});
