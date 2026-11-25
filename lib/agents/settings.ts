// Per-capability settings in agent_config.settings. Ask/Auto lives in
// settings[cap].mode: only "auto" is Auto; anything else (or missing) is Ask.
import type { AgentConfig } from "@/lib/types";

export type CapSettings = Record<string, Record<string, unknown>>;
export type Mode = "ask" | "auto";

export function capMode(settings: CapSettings | null | undefined, cap: string): Mode {
  return settings?.[cap]?.mode === "auto" ? "auto" : "ask";
}

// The settings object to save when one capability's mode changes. It keeps
// that capability's other settings (for example the meeting length).
export function withMode(settings: CapSettings | null | undefined, cap: string, mode: Mode): CapSettings {
  return { [cap]: { ...(settings?.[cap] ?? {}), mode } };
}

export type MeetingSettings = {
  type: string;
  duration: number;
  windowStart: number;
  windowEnd: number;
  weekdaysOnly: boolean;
};

export const MEETING_DEFAULTS: MeetingSettings = {
  type: "Meeting",
  duration: 30,
  windowStart: 9,
  windowEnd: 17,
  weekdaysOnly: true,
};

const hour = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : d);

// Book-meeting settings with defaults. Only an explicit false turns off
// weekdays-only.
export function meetingSettings(settings: CapSettings | null | undefined): MeetingSettings {
  const s = settings?.["book-meeting"] ?? {};
  return {
    type: typeof s.type === "string" && s.type.trim() ? s.type : MEETING_DEFAULTS.type,
    duration: typeof s.duration === "number" && s.duration > 0 ? s.duration : MEETING_DEFAULTS.duration,
    windowStart: hour(s.windowStart, MEETING_DEFAULTS.windowStart),
    windowEnd: hour(s.windowEnd, MEETING_DEFAULTS.windowEnd),
    weekdaysOnly: s.weekdaysOnly !== false,
  };
}

// Configuration page choices.
export const MEETING_LENGTHS = [15, 30, 45, 60] as const;
export const BOOKING_HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8 AM – 6 PM

// Merges an agent's edits (agent_config) over its base values. Edits win.
export function effectiveRoleGoal(base: { role: string; goal: string }, config: AgentConfig | undefined) {
  return {
    role: config?.role ?? base.role,
    goal: config?.goal ?? base.goal,
  };
}

// Checks a settings patch from the browser: known shape only.
export function cleanSettingsPatch(input: unknown): CapSettings | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: CapSettings = {};
  for (const [cap, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const v = raw as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    if (v.mode !== undefined) {
      if (v.mode !== "auto" && v.mode !== "ask") return null;
      clean.mode = v.mode;
    }
    if (cap === "book-meeting") {
      if (v.type !== undefined) {
        if (typeof v.type !== "string") return null;
        clean.type = v.type.trim().slice(0, 80) || MEETING_DEFAULTS.type;
      }
      if (v.duration !== undefined) {
        if (typeof v.duration !== "number" || !Number.isInteger(v.duration) || v.duration < 5 || v.duration > 480) return null;
        clean.duration = v.duration;
      }
      for (const k of ["windowStart", "windowEnd"] as const) {
        if (v[k] !== undefined) {
          if (typeof v[k] !== "number" || !Number.isInteger(v[k]) || (v[k] as number) < 0 || (v[k] as number) > 23) return null;
          clean[k] = v[k];
        }
      }
      if (v.weekdaysOnly !== undefined) {
        if (typeof v.weekdaysOnly !== "boolean") return null;
        clean.weekdaysOnly = v.weekdaysOnly;
      }
      if (v.length !== undefined) {
        if (typeof v.length !== "string") return null;
        clean.length = v.length.slice(0, 60);
      }
    }
    out[cap] = clean;
  }
  return out;
}
