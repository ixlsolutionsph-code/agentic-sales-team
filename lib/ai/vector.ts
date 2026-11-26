// Small helpers for embedding vectors. Pure, so they can be unit tested.

export const EMBED_DIMS = 768;

// Scales a vector to unit length. Gemini only normalises its full 3072-dim
// output, so the 768-dim output must be normalised here. Returns null for a
// vector of the wrong size, with bad numbers, or of zero length.
export function normalize(v: unknown, dims = EMBED_DIMS): number[] | null {
  if (!Array.isArray(v) || v.length !== dims) return null;
  let sum = 0;
  for (const x of v) {
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    sum += x * x;
  }
  if (sum === 0) return null;
  const len = Math.sqrt(sum);
  return v.map((x: number) => x / len);
}

// The text form Postgres reads as a pgvector value: "[0.1,0.2,…]".
export function toPgVector(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Strips a ```json … ``` fence some models put around JSON.
export function stripCodeFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : t;
}
