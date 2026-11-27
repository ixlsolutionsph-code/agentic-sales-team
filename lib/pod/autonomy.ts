// Ask or Auto per capability (01-prd.md §7.5): agent_config.settings[cap].mode.
// Only "auto" is Auto; anything else (or missing) is Ask. Pure.
import { capMode, type CapSettings, type Mode } from "@/lib/agents/settings";

export { capMode };
export type { CapSettings, Mode };

// The capabilities (of the given list, else of the settings) that run without Proceed.
export function autoCaps(settings: CapSettings | null | undefined, capabilities?: readonly string[]): string[] {
  const caps = capabilities ?? Object.keys(settings ?? {});
  return caps.filter((c) => capMode(settings, c) === "auto");
}

// True when a step of this capability waits for Proceed.
export function needsApproval(settings: CapSettings | null | undefined, cap: string): boolean {
  return capMode(settings, cap) !== "auto";
}
