// The lead search engine (01-prd.md §7.3): plan the searches, run them on
// Firecrawl, then pick out leads from the results. Pure apart from the
// Firecrawl call, which takes its key and fetch as arguments, so it can be
// unit tested. Only the search results' title, description and link are read;
// the pages themselves are never fetched.
import type { AIJson } from "@/lib/ai/engine";
import { LEAD_FIELD_LIMITS, UNTRUSTED_RULE, cleanField, fence } from "@/lib/ai/untrusted";
import { EMAIL_RE } from "@/lib/auth/rules";
import { oneLineFit } from "@/lib/leads/fit";
import { platformOf, safeUrl } from "@/lib/url/safeUrl";
import { EXTRACT_RULES } from "./rules";

export type SearchMode = "fit" | "intent";
export type SearchPlatform = "facebook" | "reddit" | "linkedin" | null;
export type SearchPlan = { mode: SearchMode; queries: string[]; roles: string[]; platform: SearchPlatform };
export type Search = { query: string; limit: number; tbs?: string };
export type Source = { url: string; title: string; description: string; platform: string };
export type Prospect = {
  name: string;
  title: string;
  company: string;
  email: string;
  profileUrl: string;
  platform: string;
  fitReason: string;
};

export const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
export const FIRECRAWL_TIMEOUT_MS = 15_000;
export const MAX_SEARCHES = 6;
export const CORPUS_MAX = 40_000;
export const EXTRA_PROSPECTS = 5; // ask for target + 5, since some are dropped

// The platform the request names, if any.
export function namedPlatform(text: string): SearchPlatform {
  if (/linked\s?in/i.test(text)) return "linkedin";
  if (/\bfacebook\b|\bfb\b/i.test(text)) return "facebook";
  if (/\breddit\b/i.test(text)) return "reddit";
  return null;
}

// Search words without operators the plan should not add itself.
function cleanQuery(q: unknown): string {
  return cleanField(q, 160)
    .replace(/\bsite:\S+/gi, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// With no AI: intent mode, one query in the buyer's voice.
export function fallbackPlan(instruction: string): SearchPlan {
  const goal = cleanQuery(instruction.split(/\.\s/)[0] || instruction) || "services";
  const platform = namedPlatform(instruction);
  return { mode: "intent", queries: [`${goal} looking to buy recommendations`], roles: [], platform: platform === "linkedin" ? null : platform };
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["fit", "intent"] },
    queries: { type: "array", items: { type: "string" } },
    roles: { type: "array", items: { type: "string" } },
    platform: { type: "string", enum: ["facebook", "reddit", "linkedin", "none"] },
  },
  required: ["mode", "queries", "roles", "platform"],
};

// Turns the request into a search plan: the mode, 3 search queries, the job
// roles to look for, and a platform if one is named. LinkedIn always means fit.
export async function planSearch(instruction: string, ai: AIJson | null): Promise<SearchPlan> {
  if (!ai) return fallbackPlan(instruction);
  const prompt = [
    "Plan a web search for sales leads from this request.",
    fence(cleanField(instruction, 600)),
    'mode: "fit" when the request describes a type of company or a job role (for example "HR managers at hospitals"), or names LinkedIn. ' +
      '"intent" when it is about people who need something now (for example "people looking for a virtual assistant").',
    "queries: 3 short search queries (2 to 8 words). For intent, write them in the buyer's own voice, as they would post it (for example \"need a virtual assistant\"). " +
      "For fit, describe the companies (industry and place). Do not use site: or quotes.",
    'roles: for fit, 1 to 3 job titles of the people to reach (for example "HR Manager"). For intent, an empty list.',
    'platform: "facebook", "reddit" or "linkedin" only when the request names it, otherwise "none".',
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(`You plan lead searches. ${UNTRUSTED_RULE}`, prompt, PLAN_SCHEMA, { temperature: 0.15, maxTokens: 400 });
  const named = namedPlatform(instruction);
  const p = typeof r?.platform === "string" && ["facebook", "reddit", "linkedin"].includes(r.platform) ? (r.platform as SearchPlatform) : null;
  const platform = named ?? p;
  const mode: SearchMode = platform === "linkedin" || r?.mode === "fit" ? "fit" : "intent";
  const list = (v: unknown, n: number, max: number) =>
    (Array.isArray(v) ? v : []).map((x) => cleanQuery(x).slice(0, max)).filter(Boolean).slice(0, n);
  const queries = list(r?.queries, 3, 120);
  if (!queries.length) return fallbackPlan(instruction);
  return { mode, queries, roles: mode === "fit" ? list(r?.roles, 3, 60) : [], platform: mode === "fit" ? "linkedin" : platform };
}

export function perSearchLimit(target: number): number {
  return Math.max(4, Math.min(target, 8));
}

// The Firecrawl searches for a plan, at most 6.
//  - fit: LinkedIn people with the role, then LinkedIn companies.
//  - intent: Facebook and Reddit (or the one platform named), past month only.
export function buildSearches(plan: SearchPlan, target: number): Search[] {
  const limit = perSearchLimit(target);
  const out: Search[] = [];
  if (plan.mode === "fit") {
    plan.queries.forEach((q, i) => {
      const role = plan.roles.length ? plan.roles[i % plan.roles.length] : "";
      if (role) out.push({ query: `site:linkedin.com/in "${role}" ${q}`, limit });
      out.push({ query: `site:linkedin.com/company ${q}`, limit });
    });
  } else {
    const sites = plan.platform === "facebook" ? ["facebook.com"] : plan.platform === "reddit" ? ["reddit.com"] : ["facebook.com", "reddit.com"];
    for (const q of plan.queries) for (const site of sites) out.push({ query: `site:${site} ${q}`, limit, tbs: "qdr:m" });
  }
  return out.slice(0, MAX_SEARCHES);
}

// One Firecrawl search. Throws FirecrawlError on an HTTP error.
export class FirecrawlError extends Error {
  constructor(public status: number) {
    super(`Firecrawl HTTP ${status}`);
    this.name = "FirecrawlError";
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function firecrawlSearch(s: Search, apiKey: string, fetchImpl: FetchLike = fetch): Promise<Source[]> {
  const res = await fetchImpl(FIRECRAWL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query: s.query, limit: s.limit, ...(s.tbs ? { tbs: s.tbs } : {}), timeout: FIRECRAWL_TIMEOUT_MS }),
    signal: AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new FirecrawlError(res.status);
  return readSearchReply(await res.json());
}

// Results are in data.web (v2), or in data itself (older replies).
export function readSearchReply(json: unknown): Source[] {
  const data = (json as { data?: unknown })?.data;
  const list = Array.isArray(data) ? data : Array.isArray((data as { web?: unknown })?.web) ? ((data as { web: unknown[] }).web) : [];
  const out: Source[] = [];
  for (const x of list as Record<string, unknown>[]) {
    const url = safeUrl(x?.url);
    if (!url) continue;
    out.push({ url, title: cleanField(x?.title, 300), description: cleanField(x?.description, 600), platform: platformOf(url) ?? "web" });
  }
  return out;
}

// The same link with or without "www.", a trailing slash, a #part or
// tracking codes counts once.
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k);
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

// Runs all searches at once. A failed search is skipped; only when every
// search failed is the error thrown (the first one).
export async function runSearches(searches: Search[], apiKey: string, fetchImpl: FetchLike = fetch): Promise<Source[]> {
  const settled = await Promise.allSettled(searches.map((s) => firecrawlSearch(s, apiKey, fetchImpl)));
  const ok = settled.filter((r): r is PromiseFulfilledResult<Source[]> => r.status === "fulfilled");
  if (!ok.length && settled.length) throw (settled[0] as PromiseRejectedResult).reason;
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const r of ok)
    for (const src of r.value) {
      const k = urlKey(src.url);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(src);
    }
  return out;
}

// Employers that are not real employers for a LinkedIn person.
export const PLATFORM_EMPLOYERS = [
  "shopify", "amazon", "etsy", "ebay", "upwork", "fiverr", "freelancer", "freelance", "self-employed", "self employed",
  "confidential", "stealth", "stealth mode", "independent", "n/a", "na", "none", "unemployed", "retired", "linkedin",
];

export function lacksEmployer(company: string): boolean {
  const c = company.trim().toLowerCase().replace(/[.\s]+$/, "");
  return !c || PLATFORM_EMPLOYERS.includes(c);
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    prospects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "integer" },
          name: { type: "string" },
          title: { type: "string" },
          company: { type: "string" },
          email: { type: "string" },
          fitReason: { type: "string" },
        },
        required: ["source", "name", "title", "company", "email", "fitReason"],
      },
    },
  },
  required: ["prospects"],
};

// Each source in its own fence, numbered, until 40 000 characters.
export function corpusOf(sources: Source[]): { text: string; used: Source[] } {
  const parts: string[] = [];
  const used: Source[] = [];
  let size = 0;
  for (const s of sources) {
    const block = `[${used.length + 1}] ${s.platform}\n${fence(`Link: ${s.url}\nTitle: ${s.title}\nSnippet: ${s.description}`)}`;
    if (size + block.length > CORPUS_MAX) break;
    parts.push(block);
    used.push(s);
    size += block.length + 2;
  }
  return { text: parts.join("\n\n"), used };
}

export type RawProspect = Record<string, unknown>;

// Picks target + 5 leads from the search results.
export async function extractProspects(instruction: string, plan: SearchPlan, sources: Source[], target: number, ai: AIJson): Promise<{ raw: RawProspect[]; used: Source[] }> {
  const { text, used } = corpusOf(sources);
  if (!used.length) return { raw: [], used };
  const want = target + EXTRA_PROSPECTS;
  const prompt = [
    "The request (what we look for and what we sell):",
    fence(cleanField(instruction, 600)),
    plan.mode === "fit"
      ? `These are LinkedIn results. Pick the people (or, for a company page, the company) who fit the request${plan.roles.length ? `, ideally in roles like ${plan.roles.join(", ")}` : ""}.`
      : "These are recent posts. Pick the people who posted that they need what we sell.",
    `Pick up to ${want} leads. For each give the number of its source, the person's name (or the company or user name when there is no person), their job title, their company, their email, and the fit reason.`,
    ...EXTRACT_RULES,
    "Search results:",
    text,
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(`You pick sales leads from search results. Be strict and accurate. ${UNTRUSTED_RULE}`, prompt, EXTRACT_SCHEMA, {
    temperature: 0.3,
    maxTokens: 4000,
  });
  return { raw: Array.isArray(r?.prospects) ? (r.prospects as RawProspect[]) : [], used };
}

// Checks and cleans what the model picked: the link must be one of the
// search results, an email must appear in that result, a LinkedIn person must
// have a real employer, one lead per link and per email, at most `max`.
export function normalizeProspects(raw: RawProspect[], used: Source[], max: number): Prospect[] {
  const out: Prospect[] = [];
  const urls = new Set<string>();
  const emails = new Set<string>();
  for (const p of raw) {
    if (out.length >= max) break;
    const n = Math.floor(Number(p?.source));
    const src = Number.isFinite(n) && n >= 1 && n <= used.length ? used[n - 1] : null;
    if (!src) continue;
    const name = cleanField(p?.name, LEAD_FIELD_LIMITS.name);
    if (!name) continue;
    const company = cleanField(p?.company, LEAD_FIELD_LIMITS.company);
    if (/linkedin\.com\/in\//i.test(src.url) && lacksEmployer(company)) continue;
    const key = urlKey(src.url);
    if (urls.has(key)) continue;
    const said = `${src.title} ${src.description}`.toLowerCase();
    const e = cleanField(p?.email, LEAD_FIELD_LIMITS.email).toLowerCase();
    const email = e && EMAIL_RE.test(e) && said.includes(e) ? e : "";
    if (email && emails.has(email)) continue;
    urls.add(key);
    if (email) emails.add(email);
    out.push({
      name,
      title: cleanField(p?.title, LEAD_FIELD_LIMITS.title),
      company,
      email,
      profileUrl: src.url,
      platform: src.platform,
      fitReason: oneLineFit(cleanField(p?.fitReason, LEAD_FIELD_LIMITS.fit)),
    });
  }
  return out;
}

// With no AI, each search result is a lead to review by hand.
export function prospectsWithoutAI(sources: Source[], instruction: string, max: number): Prospect[] {
  return sources.slice(0, max).map((s) => ({
    name: cleanField(s.title, LEAD_FIELD_LIMITS.name) || s.platform,
    title: "",
    company: "",
    email: "",
    profileUrl: s.url,
    platform: s.platform,
    fitReason: oneLineFit(`Found by searching for: ${cleanField(instruction, 200)}`),
  }));
}
