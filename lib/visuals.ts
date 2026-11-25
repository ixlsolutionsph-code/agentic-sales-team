// How agents look: the 4 characters, avatar style, status pills and chips.
import type { CSSProperties } from "react";
import { capabilityLabel, isEngineReady } from "./agentTypes";

export const AGENT_CHARS = [
  { name: "Theo", image: "/agents/theo.jpg" },
  { name: "Pat", image: "/agents/pat.jpg" },
  { name: "Maya", image: "/agents/maya.jpg" },
  { name: "Sam", image: "/agents/sam.jpg" },
] as const;

export const DEFAULT_CHAR = 2; // Maya
export const AGENT_COLOR = "#006AFF"; // every agent; there is no picker

// A stable small number for an id (used when no character was chosen).
export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Which of the 4 characters an agent uses: its explicit choice, else a hash of its id.
export function agentCharIndex(agent: { id: string; char: number | null }): number {
  if (typeof agent.char === "number" && Number.isFinite(agent.char)) return ((Math.trunc(agent.char) % 4) + 4) % 4;
  return hashId(agent.id) % 4;
}

// Avatar: the agent's colour at low strength ("26" alpha) behind the
// character picture, drawn slightly larger (114%) so it fills the circle.
export function avatarStyle(agent: { id: string; char: number | null; color: string }): CSSProperties {
  const ch = AGENT_CHARS[agentCharIndex(agent)];
  return {
    backgroundColor: `${agent.color || AGENT_COLOR}26`,
    backgroundImage: `url(${ch.image})`,
    backgroundSize: "114%",
    backgroundPosition: "center",
  };
}

export type AgentStatus = "working" | "waiting" | "idle";

export function statusPill(status: AgentStatus): { label: string; tone: "positive" | "notice" | "neutral" } {
  if (status === "working") return { label: "Working", tone: "positive" };
  if (status === "waiting") return { label: "Paused", tone: "notice" };
  return { label: "Idle", tone: "neutral" };
}

// A capability chip: its label, and whether it is "soon".
export function chip(capability: string): { label: string; soon: boolean } {
  return { label: capabilityLabel(capability), soon: !isEngineReady(capability) };
}
