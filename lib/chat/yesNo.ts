// Reads a short typed "yes" or "no" in the chat (01-prd.md §7.4, F9). Pure.
import { stripMarkers } from "./markers";

export const YES_NO_MAX = 40;

const YES = [
  "yes", "y", "yeah", "yea", "yep", "yup", "ya", "sure", "ok", "okay", "k", "alright", "all right", "fine",
  "go", "go ahead", "go for it", "proceed", "do it", "please do", "sounds good", "approve", "approved",
  "confirm", "confirmed", "lets go", "let's go", "absolutely", "of course", "definitely", "start", "run it",
  "yes go ahead", "go on", "carry on", "continue", "perfect", "great", "good",
];
const NO = [
  "no", "n", "nope", "nah", "stop", "cancel", "dont", "don't", "do not", "not now", "no thanks", "never mind",
  "nevermind", "reject", "skip", "stop it", "stop that", "stop everything", "abort", "not yet",
  "leave it", "forget it", "no need",
];
// Words that may come with either answer without changing it.
const FILLER = ["please", "thanks", "thank you", "now", "it", "that", "then", "for now", "for me", "pls", "thx", "ty"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const sortLong = (list: string[]) => [...list].sort((a, b) => b.split(" ").length - a.split(" ").length);
const YES_P = sortLong(YES);
const NO_P = sortLong(NO);
const FILL_P = sortLong(FILLER);

// "yes", "no" or null. Only short messages count (≤ 40 characters), and every
// word must belong to the answer ("yes please" yes; "no, find nurses" null).
export function readYesNo(text: string): "yes" | "no" | null {
  const raw = stripMarkers(String(text ?? "")).trim();
  if (!raw || raw.length > YES_NO_MAX || raw.includes("?")) return null;
  const words = norm(raw).split(" ").filter(Boolean);
  if (!words.length) return null;
  let yes = false;
  let no = false;
  let i = 0;
  outer: while (i < words.length) {
    for (const [list, mark] of [[YES_P, "y"], [NO_P, "n"], [FILL_P, "f"]] as const) {
      for (const p of list) {
        const pw = p.split(" ");
        if (pw.every((w, k) => words[i + k] === w)) {
          if (mark === "y") yes = true;
          if (mark === "n") no = true;
          i += pw.length;
          continue outer;
        }
      }
    }
    return null; // a word that isn't part of a yes or no
  }
  if (yes === no) return null; // both, or only filler
  return yes ? "yes" : "no";
}

// A typed "stop" / "cancel" (stops the team's waiting steps even with no ask open).
export function isStopWord(text: string): boolean {
  const s = norm(stripMarkers(String(text ?? "")));
  return /^(stop|cancel|abort)( (it|that|everything|all|now|please|the run|the search))*$/.test(s);
}

const QUESTION_START =
  /^(what|whats|what's|how|why|who|whos|who's|when|which|where|wheres|where's|is|are|was|were|do|does|did|can|could|should|would|will|have|has|any|tell me)\b/;
// Polite requests are not questions: "can you find nurses in Texas".
const POLITE_REQUEST = /^(can|could|would|will) (you|we|someone|somebody)( please)? (find|search|look|get|research|qualify|draft|write|send|email|reach|match|review|assess|score|book|schedule|start|run|do|make|create)\b/;

// A question to the agent (ends with "?" or starts like one).
export function looksLikeQuestion(text: string): boolean {
  const raw = stripMarkers(String(text ?? "")).replace(/@[\p{L}\p{N}_'-]+/gu, "").trim();
  if (!raw) return false;
  const s = norm(raw);
  if (POLITE_REQUEST.test(s)) return false;
  return raw.endsWith("?") || QUESTION_START.test(s);
}
