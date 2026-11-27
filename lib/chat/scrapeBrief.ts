// The search brief asked before every chat search (01-prd.md §7.4, F6). Pure.
//
// Fields, in order: product (only when the catalog has more than one
// product), what (the buyer), where, count (1–25). After 2 asks the missing
// ones get defaults: where "anywhere", count 10, product "Any product".
// "What" is never guessed. No products: the user is asked to add some first.
// Exactly one product: it is chosen for them.
import { jsonMarker, type ScrapeBrief, type ScrapeBriefCard } from "./markers";

export type BriefField = "product" | "what" | "where" | "count";
export type BriefProduct = { name: string; description: string };

export const ANY_PRODUCT = "Any product";
export const ANYWHERE = "anywhere";
export const DEFAULT_COUNT = 10;
export const MAX_COUNT = 25;
export const ASKS_BEFORE_DEFAULTS = 2;

// The card's questions and quick choices (the chat screen shows these).
export const BRIEF_QUESTIONS: Record<BriefField, string> = {
  product: "Which product are these leads for?",
  what: "Who should I look for?",
  where: "Where should I look?",
  count: "How many leads?",
};
export const WHERE_CHOICES = ["Anywhere", "United States", "United Kingdom", "Europe"] as const;
export const COUNT_CHOICES = [5, 10, 25] as const;

export const MSG_NO_PRODUCTS_YET =
  "You have no products in your catalog yet. Add what you sell on the Products page first, so I know which buyers to look for. Then ask me again.";
export const MSG_ASK_ONE = "Before I start, I need one detail.";
export const MSG_ASK_MANY = "Before I start, I need a few details.";
export const MSG_ASK_COUNT_MORE = "Happy to look for more. How many new leads should I find this time?";

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[⟦⟧]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

export function clampCount(n: unknown): number | undefined {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x) || x <= 0) return undefined;
  return Math.min(MAX_COUNT, x);
}

// The product name as it is in the catalog, ANY_PRODUCT, or undefined.
export function matchProduct(name: string | undefined, products: BriefProduct[]): string | undefined {
  const n = clean(name, 200).toLowerCase();
  if (!n) return undefined;
  if (n === ANY_PRODUCT.toLowerCase() || n === "any" || n === "all products" || n === "any of them") return ANY_PRODUCT;
  return products.find((p) => p.name.trim().toLowerCase() === n)?.name;
}

// A product named inside a longer text ("find buyers for the Nurse Pack").
export function productInText(text: string, products: BriefProduct[]): string | undefined {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const hits = products.filter((p) => p.name.trim().length >= 3 && t.includes(p.name.trim().toLowerCase()));
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits[0]?.name;
}

// Merges an answer into the brief (only filled fields of the answer count).
export function mergeBrief(base: ScrapeBrief, add: ScrapeBrief): ScrapeBrief {
  const out: ScrapeBrief = { ...base };
  if (clean(add.product, 200)) out.product = clean(add.product, 200);
  if (clean(add.what, 300)) out.what = clean(add.what, 300);
  if (clean(add.where, 120)) out.where = clean(add.where, 120);
  const c = clampCount(add.count);
  if (c) out.count = c;
  return out;
}

// The fields still missing, in order.
export function missingFields(brief: ScrapeBrief, products: BriefProduct[]): BriefField[] {
  const out: BriefField[] = [];
  if (products.length > 1 && !matchProduct(brief.product, products)) out.push("product");
  if (!clean(brief.what, 300)) out.push("what");
  if (!clean(brief.where, 120)) out.push("where");
  if (!clampCount(brief.count)) out.push("count");
  return out;
}

export type BriefStep =
  | { kind: "no-products"; text: string }
  | { kind: "ask"; text: string; card: ScrapeBriefCard; message: string }
  | { kind: "ready"; brief: Required<Pick<ScrapeBrief, "product" | "what" | "where" | "count">>; instruction: string; target: number };

// What happens next with this brief: ask (the card), or ready to search.
// `brief.asks` = how many times the card was already shown.
// `opts.more`: a "look for more" brief (only the count is asked, with its own text).
export function nextBriefStep(input: ScrapeBrief, products: BriefProduct[], opts: { more?: boolean } = {}): BriefStep {
  if (!products.length) return { kind: "no-products", text: MSG_NO_PRODUCTS_YET };
  const brief: ScrapeBrief = { ...input, asks: Math.max(0, Math.floor(Number(input.asks) || 0)) };
  if (products.length === 1) brief.product = products[0].name;
  else brief.product = matchProduct(brief.product, products);
  if ((brief.asks ?? 0) >= ASKS_BEFORE_DEFAULTS) {
    if (!clean(brief.where, 120)) brief.where = ANYWHERE;
    if (!clampCount(brief.count)) brief.count = DEFAULT_COUNT;
    if (!brief.product) brief.product = ANY_PRODUCT;
  }
  const missing = missingFields(brief, products);
  if (missing.length) {
    const asked: ScrapeBrief = { ...brief, asks: (brief.asks ?? 0) + 1 };
    if (!asked.product) delete asked.product;
    const card: ScrapeBriefCard = {
      brief: asked,
      missing,
      products: missing.includes("product") ? [...products.map((p) => p.name).slice(0, 20), ANY_PRODUCT] : [],
    };
    const onlyCountForMore = opts.more === true && missing.length === 1 && missing[0] === "count";
    const text = onlyCountForMore ? MSG_ASK_COUNT_MORE : missing.length === 1 ? MSG_ASK_ONE : MSG_ASK_MANY;
    return { kind: "ask", text, card, message: `${text}${jsonMarker("scrape", card)}` };
  }
  const ready = {
    product: brief.product ?? ANY_PRODUCT,
    what: clean(brief.what, 300),
    where: clean(brief.where, 120),
    count: clampCount(brief.count) ?? DEFAULT_COUNT,
  };
  return { kind: "ready", brief: ready, instruction: searchInstruction(ready, products), target: ready.count };
}

// "{what}. Selling: {product (desc)}. Location: {where}." (01-prd.md §7.3),
// at most 500 characters. "Any product" lists up to 5 catalog names.
export function searchInstruction(b: { product: string; what: string; where: string }, products: BriefProduct[]): string {
  const p = products.find((x) => x.name === b.product);
  let selling: string;
  if (p) {
    const desc = clean(p.description, 160);
    selling = desc ? `${clean(p.name, 120)} (${desc})` : clean(p.name, 120);
  } else if (b.product === ANY_PRODUCT && products.length) {
    selling = products.slice(0, 5).map((x) => clean(x.name, 60)).join(", ");
  } else {
    selling = clean(b.product, 120) || ANY_PRODUCT;
  }
  const where = b.where.toLowerCase() === ANYWHERE ? "Anywhere" : b.where;
  const what = clean(b.what, 300).replace(/[.\s]+$/, "");
  const out = `${what}. Selling: ${selling}. Location: ${where}.`;
  if (out.length <= 500) return out;
  const room = Math.max(20, 500 - (out.length - selling.length) - 1);
  return `${what}. Selling: ${selling.slice(0, room)}…. Location: ${where}.`.slice(0, 500);
}

// Reads the brief back from a search instruction (for "look for more" when
// the job kept no brief).
export function briefFromInstruction(instruction: string): ScrapeBrief {
  const m = String(instruction ?? "").match(/^([\s\S]*?)\.\s*Selling:\s*([\s\S]*?)\.\s*Location:\s*([\s\S]*?)\.?\s*$/);
  if (!m) return { what: clean(instruction, 300) || undefined };
  const product = m[2].replace(/\s*\([\s\S]*\)\s*$/, "").trim();
  return { what: clean(m[1], 300) || undefined, product: product || undefined, where: clean(m[3], 120) || undefined };
}

// "look for more" / "find more leads" / "more leads please".
export function isLookForMore(text: string): boolean {
  return /\b(look|search|find|get|hunt)\s+(for\s+)?(some\s+)?more\b|\bmore\s+(leads|prospects|people)\b|\bfind\s+me\s+more\b/i.test(text);
}

// "Look for more": the last what, where and product; the count is asked again.
export function moreBrief(last: ScrapeBrief): ScrapeBrief {
  const b: ScrapeBrief = { asks: 0 };
  if (last.what) b.what = last.what;
  if (last.where) b.where = last.where;
  if (last.product) b.product = last.product;
  return b;
}

// Fills the missing fields of an open brief from a typed answer
// ("Manila", "10", "HR managers in Cebu", "the Nurse Pack, 25 leads").
export function fillFromText(brief: ScrapeBrief, text: string, products: BriefProduct[]): ScrapeBrief {
  let rest = clean(text.replace(/⟦[^⟧]*⟧/g, " ").replace(/@[\p{L}\p{N}_'-]+/gu, " "), 500);
  const out: ScrapeBrief = { ...brief };
  const missing = missingFields(out, products);

  if (missing.includes("product")) {
    const p = matchProduct(rest, products) ?? productInText(rest, products);
    if (p) {
      out.product = p;
      if (p !== ANY_PRODUCT) rest = rest.replace(new RegExp(escapeRe(p), "i"), " ");
      else rest = rest.replace(/\bany( product)?\b/i, " ");
    }
  }
  const num = rest.match(/\b(\d{1,3})\b(\s*(leads?|people|prospects|contacts|of them))?/i);
  if (num && missing.includes("count")) {
    const c = clampCount(num[1]);
    if (c) {
      out.count = c;
      rest = rest.replace(num[0], " ");
    }
  }
  rest = rest.replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "").replace(/\s+/g, " ").trim();
  const wantWhat = missing.includes("what") && !clean(out.what, 300);
  const wantWhere = missing.includes("where") && !clean(out.where, 120);
  if (!rest) return out;
  if (/^(anywhere|everywhere|any ?where|worldwide|global(ly)?|no preference)$/i.test(rest)) {
    if (wantWhere) out.where = ANYWHERE;
    return out;
  }
  if (wantWhat && wantWhere) {
    const m = rest.match(/^(.*\S)\s+(?:in|from|near|around|based in)\s+([^,]+?)$/i);
    if (m) {
      out.what = clean(m[1], 300);
      out.where = clean(m[2], 120);
    } else {
      out.what = clean(rest, 300);
    }
  } else if (wantWhat) {
    out.what = clean(rest, 300);
  } else if (wantWhere) {
    out.where = clean(rest.replace(/^(in|from|near|around|based in)\s+/i, ""), 120);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Words that name no buyer ("find leads"). "What" is never guessed, so these are asked.
export function isVagueWhat(what: string): boolean {
  const w = what.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\b(some|more|new|good|the|me|a|few|potential|possible|qualified)\b/g, " ").trim().replace(/\s+/g, " ");
  return !w || /^(leads?|prospects?|customers?|clients?|buyers?|people|contacts?|companies|businesses|accounts?|sales leads?)$/.test(w);
}

// The brief from a request's intent ("find HR managers at hospitals in Manila").
export function briefFromIntent(
  i: { what?: string; titles?: string[]; industry?: string; geo?: string; target?: number | null },
  text: string,
  products: BriefProduct[],
): ScrapeBrief {
  const b: ScrapeBrief = { asks: 0 };
  let what = clean(i.what, 300);
  if (!what) {
    const titles = (i.titles ?? []).map((t) => clean(t, 80)).filter(Boolean).join(" and ");
    const industry = clean(i.industry, 120);
    what = titles && industry ? `${titles} at ${industry}` : titles || industry;
  }
  if (what && !isVagueWhat(what)) b.what = what;
  if (clean(i.geo, 120)) b.where = clean(i.geo, 120);
  const c = clampCount(i.target);
  if (c) b.count = c;
  const p = productInText(text, products);
  if (p) b.product = p;
  return b;
}
