// Products: checking, CSV reading, embedding text and search merging.
// Pure, so it can be unit tested. The queries are in ./store.ts.
import { cleanField, sanitizeText } from "@/lib/ai/untrusted";
import { readTable } from "@/lib/csv";

export type Folder = { id: string; name: string; createdAt: string };
export type CatalogProduct = {
  id: string;
  folderId: string | null;
  name: string;
  description: string;
  price: string;
  category: string;
  attributes: Record<string, string>;
  embedded: boolean;
  createdAt: string;
};
export type ProductInput = { name: string; description: string; price: string; category: string; attributes: Record<string, string> };

export const PRODUCT_CSV_MAX = 200;
export const PRODUCT_LIMITS = { name: 200, description: 2000, price: 60, category: 80, folder: 80, attrKey: 60, attrValue: 500, attrs: 30 } as const;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PRODUCT_ALIASES = {
  name: ["name", "title", "product", "product name"],
  description: ["description", "short description", "desc", "summary"],
  price: ["price", "cost"],
  category: ["category", "type"],
};

export const MSG_PRODUCT_NAME = "A product name is required.";
export const MSG_PRODUCT_CSV_EMPTY = "That file has no products. The first row must name the columns, like name, price, description.";
export const MSG_PRODUCT_CSV_TOO_BIG = `A product CSV can have up to ${PRODUCT_CSV_MAX} rows.`;

function cleanAttributes(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (Object.keys(out).length >= PRODUCT_LIMITS.attrs) break;
    const key = cleanField(k, PRODUCT_LIMITS.attrKey);
    const value = cleanField(val, PRODUCT_LIMITS.attrValue);
    if (key && value && key !== "__proto__") out[key] = value;
  }
  return out;
}

// Checks and trims one product. Returns the clean product or an error message.
export function cleanProduct(v: unknown): ProductInput | string {
  if (!v || typeof v !== "object") return MSG_PRODUCT_NAME;
  const p = v as Record<string, unknown>;
  const name = cleanField(p.name, PRODUCT_LIMITS.name);
  if (!name) return MSG_PRODUCT_NAME;
  return {
    name,
    description: sanitizeText(p.description).trim().slice(0, PRODUCT_LIMITS.description),
    price: cleanField(p.price, PRODUCT_LIMITS.price),
    category: cleanField(p.category, PRODUCT_LIMITS.category),
    attributes: cleanAttributes(p.attributes),
  };
}

// Reads a product CSV: known columns by alias, every other column into
// `attributes`. Rows with no name are skipped.
export function productsFromCSV(text: string): { products: ProductInput[]; skipped: number } | string {
  const { rows, hasHeader } = readTable(text, PRODUCT_ALIASES);
  if (!rows.length || !hasHeader) return MSG_PRODUCT_CSV_EMPTY;
  if (rows.length > PRODUCT_CSV_MAX) return MSG_PRODUCT_CSV_TOO_BIG;
  const products: ProductInput[] = [];
  let skipped = 0;
  for (const r of rows) {
    const p = cleanProduct({ ...r.known, attributes: r.extra });
    if (typeof p === "string") skipped++;
    else products.push(p);
  }
  if (!products.length) return MSG_PRODUCT_CSV_EMPTY;
  return { products, skipped };
}

// The text a product is embedded from: name, category, description, then
// each extra detail as "key: value".
export function embeddingText(p: Pick<ProductInput, "name" | "category" | "description" | "attributes">): string {
  const attrs = Object.entries(p.attributes ?? {}).map(([k, v]) => `${k}: ${v}`);
  return [p.name, p.category, p.description, ...attrs].filter((x) => x && x.trim()).join("\n");
}

// Common words that say nothing about a product.
const STOP_WORDS = new Set(
  (
    "the and for with who that this from are our your you can will need needs want wants someone something some any " +
    "all into about over have has had was were been not but they them their what when where which while how per via its one"
  ).split(" "),
);

// The words used for keyword search: 3+ letters, not a common word, no
// repeats, at most 8.
export function keywordTerms(q: string): string[] {
  const words = sanitizeText(q)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 8);
}

// Meaning matches first (closest first), then keyword matches not already
// in the list, up to k.
export function mergeSearch<T extends { id: string }>(byMeaning: T[], byKeyword: T[], k: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const p of [...byMeaning, ...byKeyword]) {
    if (out.length >= k) break;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
