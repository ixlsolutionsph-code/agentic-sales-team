// Small pure helpers for the landing page. Kept here so they can be tested.

export const LOADER_MS = 3000;
export const LOADER_REDUCED_MS = 250;
export const HERO_EMAIL_KEY = "ast.signupEmail";
export const HERO_EMAIL_ERROR = "Enter a work email, like you@company.com.";

export function loaderDuration(reducedMotion: boolean): number {
  return reducedMotion ? LOADER_REDUCED_MS : LOADER_MS;
}

// A light format check: something@something.tld, no spaces.
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

// The hero demo is a fixed script. Each beat is shown after `at` ms.
export type DemoBeat =
  | { kind: "user"; at: number; text: string }
  | { kind: "agent"; at: number; agent: AgentKey; text: string }
  | { kind: "timeline"; at: number }
  | { kind: "approval"; at: number; agent: AgentKey; text: string };

export type AgentKey = "theo" | "pat" | "maya" | "sam";

export const HERO_SCRIPT: DemoBeat[] = [
  { kind: "user", at: 400, text: "Find HR managers at hospitals in Manila" },
  { kind: "agent", at: 1600, agent: "theo", text: "On it. I'll look on Facebook, Reddit, X and LinkedIn." },
  { kind: "timeline", at: 2800 },
  { kind: "agent", at: 6200, agent: "theo", text: "I found 12 new leads. @Pat, please review them." },
  { kind: "approval", at: 7400, agent: "pat", text: "Review 12 new leads?" },
  { kind: "agent", at: 9800, agent: "pat", text: "I accepted 9. I dropped 3 because they sell HR software." },
  { kind: "agent", at: 11400, agent: "maya", text: "9 drafts are ready for you to review and send." },
];

export const HERO_LOOP_MS = 16000;

// How many beats are visible at time t (ms since the loop started).
export function beatsVisibleAt(t: number, script: DemoBeat[] = HERO_SCRIPT): number {
  let n = 0;
  for (const beat of script) if (t >= beat.at) n++;
  return n;
}

// 0 → 1 across the first `distance` px of scroll. Used for the hero tilt.
export function tiltProgress(scrollY: number, distance = 520): number {
  if (distance <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / distance));
}
