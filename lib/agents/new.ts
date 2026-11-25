// Building and checking a new agent. Pure: used by the wizard and the server.
import type { Agent } from "@/lib/types";
import { CAPABILITIES, agentType, capabilitiesFor, isAgentType, isCapability } from "@/lib/agentTypes";
import { AGENT_COLOR } from "@/lib/visuals";

export const AGENT_NAME_MAX = 120;
export const AGENT_GOAL_MAX = 500;
export const AGENT_ID_RE = /^x[0-9a-z]{6,20}$/;

// "x" + Date.now() in base 36 + 3 random base-36 characters.
export function newAgentId(now = Date.now(), rand: () => number = Math.random): string {
  let tail = "";
  for (let i = 0; i < 3; i++) tail += Math.floor(rand() * 36).toString(36);
  return `x${now.toString(36)}${tail}`;
}

// First letter of the first two words, upper case.
export function agentInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]).join("").toUpperCase();
}

// Only the first sentence of the wizard's goal text is kept (split on ".").
export function firstSentence(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const idx = t.indexOf(".");
  return idx === -1 ? t : t.slice(0, idx + 1).trim();
}

export type NewAgentInput = {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  char: number | null;
  goal: string;
};

// The row a new agent is saved as: colour #006AFF, status "idle",
// task "Ready for work", score 0, goal = first sentence.
export function buildAgent(input: NewAgentInput, createdAt = new Date().toISOString()): Agent {
  const name = input.name.trim().slice(0, AGENT_NAME_MAX);
  return {
    id: input.id,
    name,
    initials: agentInitials(name),
    role: agentType(input.type).label,
    color: AGENT_COLOR,
    status: "idle",
    task: "Ready for work",
    score: 0,
    goal: firstSentence(input.goal).slice(0, AGENT_GOAL_MAX),
    char: input.char,
    type: isAgentType(input.type) ? input.type : "custom",
    capabilities: capabilitiesFor(input.type, input.capabilities),
    createdAt,
  };
}

// Server-side check of what the browser sent. Returns an error message or null.
export function checkNewAgent(input: unknown): string | null {
  if (!input || typeof input !== "object") return "Something went wrong. Please try again.";
  const a = input as Record<string, unknown>;
  if (typeof a.id !== "string" || !AGENT_ID_RE.test(a.id)) return "Something went wrong. Please try again.";
  if (typeof a.name !== "string" || !a.name.trim()) return "A name is required.";
  if (!isAgentType(a.type)) return "Pick a type for your agent.";
  if (!Array.isArray(a.capabilities) || !a.capabilities.every(isCapability)) return "Something went wrong. Please try again.";
  if (a.char !== null && !(typeof a.char === "number" && Number.isInteger(a.char) && a.char >= 0 && a.char <= 3))
    return "Something went wrong. Please try again.";
  if (typeof a.goal !== "string") return "Something went wrong. Please try again.";
  return null;
}

export const ALL_CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);
