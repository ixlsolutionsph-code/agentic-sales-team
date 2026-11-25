// Pure updates the client store applies to agent data, matching what the
// server saves (so the screen and the database agree).
import type { AgentConfig, AgentState } from "@/lib/types";
import type { CapSettings } from "./settings";

const EMPTY_CONFIG: AgentConfig = { role: null, goal: null, permissions: null, settings: null };
const EMPTY_STATE: AgentState = { removed: false, paused: false };

// Same rule as the server's partial upsert: given fields replace; settings
// merge per capability.
export function mergeConfig(
  prev: AgentConfig | undefined,
  patch: { role?: string; goal?: string; settings?: CapSettings },
): AgentConfig {
  const base = prev ?? EMPTY_CONFIG;
  return {
    ...base,
    role: patch.role !== undefined ? patch.role : base.role,
    goal: patch.goal !== undefined ? patch.goal : base.goal,
    settings: patch.settings !== undefined ? { ...(base.settings ?? {}), ...patch.settings } : base.settings,
  };
}

export function withState(prev: AgentState | undefined, patch: Partial<AgentState>): AgentState {
  return { ...(prev ?? EMPTY_STATE), ...patch };
}

// Puts one key of a record back to how it was (or removes it if it was missing).
export function restoreKey<T>(rec: Record<string, T>, key: string, prev: T | undefined): Record<string, T> {
  const next = { ...rec };
  if (prev === undefined) delete next[key];
  else next[key] = prev;
  return next;
}
