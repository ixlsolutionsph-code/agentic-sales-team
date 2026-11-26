import "server-only";
import {
  DEFAULT_MODEL,
  EMBED_BATCH,
  EMBED_MODEL,
  GEMINI_BASE,
  embedBody,
  generateBody,
  parseJSONReply,
  readEmbedReply,
  readGenerateReply,
  type EmbedTask,
  type GenOpts,
} from "./geminiShape";
import { chunk } from "./vector";

// The app's only link to Google Gemini: raw fetch, no SDK, no retries
// (01-prd.md §8). The key is read from GEMINI_API_KEY and never logged.

const GEN_TIMEOUT_MS = 30_000;
const EMBED_TIMEOUT_MS = 20_000;

export function isAIConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function key(): string {
  const k = process.env.GEMINI_API_KEY?.trim();
  if (!k) throw new Error("AI is not configured");
  return k;
}

async function post(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`Gemini HTTP ${res.status}: ${text}`);
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  return res.json();
}

function model(override?: string): string {
  return override || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

// Plain text. Default temperature 0.7, up to 400 tokens.
export async function aiGenerate(
  system: string,
  prompt: string,
  opts: Partial<GenOpts> & { model?: string } = {},
): Promise<string> {
  const o = { temperature: opts.temperature ?? 0.7, maxTokens: opts.maxTokens ?? 400 };
  const m = model(opts.model);
  const json = await post(`${GEMINI_BASE}/${m}:generateContent`, generateBody(system, prompt, o, undefined, m), GEN_TIMEOUT_MS);
  return readGenerateReply(json);
}

// JSON that follows `schema`. Default temperature 0.6, up to 700 tokens.
export async function aiJSON<T>(
  system: string,
  prompt: string,
  schema: Record<string, unknown>,
  opts: Partial<GenOpts> & { model?: string } = {},
): Promise<T> {
  const o = { temperature: opts.temperature ?? 0.6, maxTokens: opts.maxTokens ?? 700 };
  const m = model(opts.model);
  const json = await post(`${GEMINI_BASE}/${m}:generateContent`, generateBody(system, prompt, o, schema, m), GEN_TIMEOUT_MS);
  return parseJSONReply<T>(readGenerateReply(json));
}

// Unit-length 768-dim vectors, in batches of 100. Never throws: a failed
// batch gives null for each of its texts.
export async function aiEmbedBatch(texts: string[], task: EmbedTask): Promise<(number[] | null)[]> {
  if (!texts.length) return [];
  if (!isAIConfigured()) return texts.map(() => null);
  const out: (number[] | null)[] = [];
  for (const part of chunk(texts, EMBED_BATCH)) {
    try {
      const json = await post(`${GEMINI_BASE}/${EMBED_MODEL}:batchEmbedContents`, embedBody(part, task), EMBED_TIMEOUT_MS);
      out.push(...readEmbedReply(json, part.length));
    } catch (e) {
      console.error("aiEmbedBatch failed", e instanceof Error ? e.message : e);
      out.push(...part.map(() => null));
    }
  }
  return out;
}

export async function aiEmbed(text: string, task: EmbedTask): Promise<number[] | null> {
  const [v] = await aiEmbedBatch([text], task);
  return v ?? null;
}
