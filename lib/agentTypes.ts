// Capabilities, agent types and team templates (01-prd.md §7.1).

export type CapabilityId =
  | "scrape"
  | "research"
  | "outreach"
  | "follow-up"
  | "book-meeting"
  | "qualify"
  | "proposal"
  | "enrich"
  | "match"
  | "assess";

// `runs: false` = "soon": listed and selectable, but there is no engine yet.
export const CAPABILITIES: { id: CapabilityId; label: string; runs: boolean }[] = [
  { id: "scrape", label: "Lead scraping", runs: true },
  { id: "research", label: "Lead research", runs: true },
  { id: "outreach", label: "Email drafting", runs: true },
  { id: "follow-up", label: "Follow-ups", runs: false },
  { id: "book-meeting", label: "Meeting booking", runs: true },
  { id: "qualify", label: "Lead qualification", runs: true },
  { id: "proposal", label: "Proposal drafting", runs: true },
  { id: "enrich", label: "Contact enrichment", runs: false },
  { id: "match", label: "Matchmaking", runs: true },
  { id: "assess", label: "Lead assessment", runs: true },
];

export type AgentTypeId =
  | "sdr"
  | "bdr"
  | "ae"
  | "csm"
  | "recruiter"
  | "manager"
  | "scout"
  | "researcher"
  | "writer"
  | "followup"
  | "qualifier"
  | "closer"
  | "matchmaker"
  | "assessor"
  | "meeting"
  | "custom";

export const AGENT_TYPES: { id: AgentTypeId; label: string; capabilities: CapabilityId[] }[] = [
  { id: "sdr", label: "SDR", capabilities: ["research", "scrape", "outreach", "follow-up", "qualify"] },
  { id: "bdr", label: "BDR", capabilities: ["outreach", "follow-up"] },
  { id: "ae", label: "Account Executive", capabilities: ["outreach", "book-meeting", "proposal"] },
  { id: "csm", label: "Customer Success", capabilities: ["follow-up"] },
  { id: "recruiter", label: "Recruiter", capabilities: ["scrape", "outreach"] },
  { id: "manager", label: "Sales Manager", capabilities: [] },
  { id: "scout", label: "Lead Scout", capabilities: ["scrape"] },
  { id: "researcher", label: "Research Agent", capabilities: ["research"] },
  { id: "writer", label: "Outreach Writer", capabilities: ["outreach"] },
  { id: "followup", label: "Follow-up Agent", capabilities: ["follow-up"] },
  { id: "qualifier", label: "Lead Qualifier", capabilities: ["qualify"] },
  { id: "closer", label: "Closer", capabilities: ["research", "qualify", "proposal", "match"] },
  { id: "matchmaker", label: "Matchmaker", capabilities: ["match"] },
  { id: "assessor", label: "Assessor", capabilities: ["assess"] },
  { id: "meeting", label: "Meeting Booker", capabilities: ["book-meeting"] },
  { id: "custom", label: "Custom", capabilities: [] }, // the user picks any of the 10
];

export type TeamTemplateId =
  | "outbound"
  | "leadgen"
  | "enterprise"
  | "fullcycle"
  | "nurture"
  | "meetings"
  | "recruitment"
  | "success"
  | "revenue"
  | "custom";

// `required` = the runnable capabilities; `soon` ones are listed but not required.
export const TEAM_TEMPLATES: { id: TeamTemplateId; label: string; required: CapabilityId[]; soon: CapabilityId[] }[] = [
  { id: "outbound", label: "Outbound", required: ["scrape", "outreach"], soon: ["follow-up"] },
  { id: "leadgen", label: "Lead-Gen / Research", required: ["scrape"], soon: [] },
  { id: "enterprise", label: "Enterprise / Named Accounts", required: ["outreach", "book-meeting"], soon: [] },
  { id: "fullcycle", label: "Full-Cycle Pod", required: ["scrape", "outreach", "book-meeting"], soon: ["follow-up"] },
  { id: "nurture", label: "Nurture / Re-engagement", required: ["outreach"], soon: ["follow-up"] },
  { id: "meetings", label: "Meeting-Booking / SDR→AE", required: ["outreach", "book-meeting"], soon: [] },
  { id: "recruitment", label: "Recruitment", required: ["scrape", "outreach"], soon: [] },
  { id: "success", label: "Customer Success", required: [], soon: ["follow-up"] },
  { id: "revenue", label: "Qualify → Propose", required: ["qualify", "proposal"], soon: [] },
  { id: "custom", label: "Custom", required: [], soon: [] },
];

const CAP_BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));
const TYPE_BY_ID = new Map(AGENT_TYPES.map((t) => [t.id, t]));

export function isCapability(id: unknown): id is CapabilityId {
  return typeof id === "string" && CAP_BY_ID.has(id as CapabilityId);
}

export function isAgentType(id: unknown): id is AgentTypeId {
  return typeof id === "string" && TYPE_BY_ID.has(id as AgentTypeId);
}

export function capabilityLabel(id: string): string {
  return CAP_BY_ID.get(id as CapabilityId)?.label ?? id;
}

export function agentType(id: string) {
  return TYPE_BY_ID.get(id as AgentTypeId) ?? TYPE_BY_ID.get("custom")!;
}

// True when the capability has an engine that can run (not "soon").
export function isEngineReady(id: string): boolean {
  return CAP_BY_ID.get(id as CapabilityId)?.runs === true;
}

// The capabilities a new agent gets: the type's preset, or the user's picks for Custom.
export function capabilitiesFor(typeId: string, customPicks: string[] = []): CapabilityId[] {
  if (typeId === "custom") {
    const picked = new Set(customPicks.filter(isCapability));
    return CAPABILITIES.map((c) => c.id).filter((id) => picked.has(id));
  }
  return [...agentType(typeId).capabilities];
}

export const MEETING_MINUTES = { min: 5, max: 480, default: 30 } as const;

// Reads a meeting length typed in plain words: "30", "45 min", "1 hour",
// "1.5 hours", "1h 30m", "90 minutes". Returns minutes (5–480) or null.
export function parseMeetingMinutes(text: string): number | null {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s) return null;
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)?/g;
  let rest = s;
  for (const m of s.matchAll(re)) {
    const n = Number(m[1]);
    const unit = m[2] ?? "";
    total += unit.startsWith("h") ? n * 60 : n;
    matched = true;
    rest = rest.replace(m[0], " ");
  }
  if (!matched) {
    if (/^(an?|one)\s+hour$/.test(s)) total = 60;
    else if (/^half\s+(an\s+)?hour$/.test(s)) total = 30;
    else return null;
  } else if (rest.replace(/\band\b|,/g, "").trim()) {
    return null; // leftover words we don't understand
  }
  const minutes = Math.round(total);
  if (minutes < MEETING_MINUTES.min || minutes > MEETING_MINUTES.max) return null;
  return minutes;
}

export const MEETING_LENGTH_ERROR = "Enter a length between 5 minutes and 8 hours, like 30 minutes or 1 hour.";
