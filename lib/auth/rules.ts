// Pure sign-in rules and texts. No server-only imports, so tests can use them.

export const MSG = {
  badEmail: "Enter a valid email address.",
  shortPassword: "Password must be at least 8 characters.",
  noName: "Enter your full name.",
  wrongLogin: "Incorrect email or password.",
  signupRefused: "We couldn't create an account with these details. If you already have one, sign in instead.",
  serverDown: "Couldn't reach the server. Check your connection and try again.",
  resetOff:
    "Self-serve password reset isn't available yet. If an account exists for that email, contact support and we'll reset it for you.",
  passwordsDiffer: "Passwords don't match.",
  tooManyWorkspaces: "You can have up to 10 workspaces.",
  noWorkspaceName: "Enter a workspace name.",
} as const;

export function tooManyAttempts(minutes: number): string {
  const n = Math.max(1, Math.ceil(minutes));
  return `Too many attempts. Try again in ${n} minute${n === 1 ? "" : "s"}.`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;
export const MAX_WORKSPACES = 10;
export const MAX_WORKSPACE_NAME = 80;

export function cleanEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

// 0 = nothing typed. 1 Weak, 2 Okay, 3 Good, 4 Strong.
export const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong"] as const;
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  if (pw.length < MIN_PASSWORD) return 1;
  let kinds = 0;
  if (/[a-z]/.test(pw)) kinds++;
  if (/[A-Z]/.test(pw)) kinds++;
  if (/\d/.test(pw)) kinds++;
  if (/[^A-Za-z0-9]/.test(pw)) kinds++;
  let score = 1;
  if (kinds >= 2) score++;
  if (kinds >= 3 && pw.length >= 10) score++;
  if (kinds >= 3 && pw.length >= 14) score++;
  return Math.min(4, score) as 2 | 3 | 4;
}

// Fixed-window limits from 01-prd.md §7.8.
export type LimitAction = "signin" | "signup" | "reset";
export const LIMITS: Record<LimitAction, { ip: number; email: number; windowMin: number }> = {
  signin: { ip: 20, email: 5, windowMin: 15 },
  signup: { ip: 5, email: 5, windowMin: 60 },
  reset: { ip: 5, email: 3, windowMin: 60 },
};

// Minutes left in a window that started at `start`.
export function minutesLeft(start: Date, windowMin: number, now = new Date()): number {
  const end = start.getTime() + windowMin * 60_000;
  return Math.max(1, Math.ceil((end - now.getTime()) / 60_000));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanWorkspaceName(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_WORKSPACE_NAME) : "";
}

// First IP from x-forwarded-for, else x-real-ip.
export function clientIp(h: { get(name: string): string | null }): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
