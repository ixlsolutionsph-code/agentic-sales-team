// Request bodies and reply reading for the Gemini REST API. Pure (no fetch,
// no keys), so it can be unit tested. The calls are in ./gemini.ts.
import { EMBED_DIMS, normalize, stripCodeFence } from "./vector";

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "gemini-2.5-flash";
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_BATCH = 100;

export type GenOpts = { temperature: number; maxTokens: number };
export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function generateBody(system: string, prompt: string, opts: GenOpts, schema?: Record<string, unknown>) {
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
    },
  };
}

// The reply's text. A reply with no text, or one that stopped for any
// reason other than STOP or MAX_TOKENS (safety, recitation…), is an error.
export function readGenerateReply(json: unknown): string {
  const c = (json as { candidates?: { finishReason?: string; content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0];
  const reason = c?.finishReason;
  if (reason && reason !== "STOP" && reason !== "MAX_TOKENS") throw new Error(`Gemini stopped: ${reason}`);
  const text = (c?.content?.parts ?? [])
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

export function parseJSONReply<T>(text: string): T {
  return JSON.parse(stripCodeFence(text)) as T;
}

export function embedBody(texts: string[], task: EmbedTask) {
  return {
    requests: texts.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType: task,
      outputDimensionality: EMBED_DIMS,
    })),
  };
}

// One unit-length vector per text, or null where Gemini gave nothing usable.
export function readEmbedReply(json: unknown, count: number): (number[] | null)[] {
  const list = (json as { embeddings?: { values?: unknown }[] })?.embeddings;
  const out: (number[] | null)[] = [];
  for (let i = 0; i < count; i++) out.push(normalize(Array.isArray(list) ? list[i]?.values : undefined));
  return out;
}
