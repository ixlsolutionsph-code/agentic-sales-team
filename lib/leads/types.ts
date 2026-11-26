// Leads: stages, checking and CSV reading. Pure, so it can be unit tested.
// The queries are in ./store.ts.
import { LEAD_FIELD_LIMITS, cleanField } from "@/lib/ai/untrusted";
import { EMAIL_RE } from "@/lib/auth/rules";
import { readTable } from "@/lib/csv";

// new → contacted → engaged → replied → meeting (01-prd.md §7.7).
export const LEAD_STAGES = ["new", "contacted", "engaged", "replied", "meeting"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const REVIEWS = ["pending", "accepted", "dismissed"] as const;
export type LeadReview = (typeof REVIEWS)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  replied: "Replied",
  meeting: "Meeting",
};

export const LEAD_CSV_MAX = 500;
export const MSG_LEAD_CSV_EMPTY = "That file has no leads. The first row must name the columns, like name, email, title, company.";
export const MSG_LEAD_CSV_TOO_BIG = `A lead CSV can have up to ${LEAD_CSV_MAX} rows.`;

export type LeadResearch = { summary: string; priorities: string[]; hooks: string[]; angle: string };

export type Lead = {
  id: string;
  agentId: string;
  name: string;
  title: string;
  company: string;
  email: string;
  status: LeadStage;
  score: number;
  source: string;
  review: LeadReview;
  profileUrl: string | null;
  platform: string | null;
  fitReason: string;
  research: LeadResearch | null;
  createdAt: string;
};

export function isStage(v: unknown): v is LeadStage {
  return typeof v === "string" && (LEAD_STAGES as readonly string[]).includes(v);
}

// The next stage, or null at the last one.
export function nextStage(s: string): LeadStage | null {
  const i = LEAD_STAGES.indexOf(s as LeadStage);
  return i >= 0 && i < LEAD_STAGES.length - 1 ? LEAD_STAGES[i + 1] : null;
}

// Hot 75+, Warm 50–74, Cold 1–49, 0 = not scored (01-prd.md §7.1).
export function leadTier(score: number): "Hot" | "Warm" | "Cold" | null {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 1) return "Cold";
  return null;
}

export type NewLead = { name: string; title: string; company: string; email: string };

export function cleanEmailField(v: unknown): string {
  return cleanField(v, LEAD_FIELD_LIMITS.email).toLowerCase();
}

// The "Add a lead" form. Name, email and agent are required.
export function checkNewLead(v: unknown): NewLead | string {
  if (!v || typeof v !== "object") return "Something went wrong. Please try again.";
  const r = v as Record<string, unknown>;
  const name = cleanField(r.name, LEAD_FIELD_LIMITS.name);
  if (!name) return "A name is required.";
  const email = cleanEmailField(r.email);
  if (!email) return "An email is required.";
  if (!EMAIL_RE.test(email)) return "Enter an email like name@company.com.";
  return {
    name,
    email,
    title: cleanField(r.title, LEAD_FIELD_LIMITS.title),
    company: cleanField(r.company, LEAD_FIELD_LIMITS.company),
  };
}

export const LEAD_ALIASES = {
  name: ["name", "full name", "contact", "contact name", "lead", "lead name"],
  email: ["email", "email address", "e-mail", "e mail", "mail"],
  title: ["title", "job title", "position", "role"],
  company: ["company", "company name", "organization", "organisation", "account", "business"],
};

// The part of an email before the @, used when a row has no name.
export function nameFromEmail(email: string): string {
  return email.split("@")[0] ?? "";
}

// Reads a lead CSV. Rows with no valid email are skipped, and so is a second
// row with the same email. Duplicates against the agent's saved leads are
// skipped by the database.
export function leadsFromCSV(text: string): { leads: NewLead[]; skipped: number } | string {
  const { rows, hasHeader } = readTable(text, LEAD_ALIASES);
  if (!rows.length || !hasHeader) return MSG_LEAD_CSV_EMPTY;
  if (rows.length > LEAD_CSV_MAX) return MSG_LEAD_CSV_TOO_BIG;
  const seen = new Set<string>();
  const leads: NewLead[] = [];
  let skipped = 0;
  for (const r of rows) {
    const email = cleanEmailField(r.known.email);
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);
    leads.push({
      email,
      name: cleanField(r.known.name, LEAD_FIELD_LIMITS.name) || cleanField(nameFromEmail(email), LEAD_FIELD_LIMITS.name),
      title: cleanField(r.known.title, LEAD_FIELD_LIMITS.title),
      company: cleanField(r.known.company, LEAD_FIELD_LIMITS.company),
    });
  }
  if (!leads.length && !skipped) return MSG_LEAD_CSV_EMPTY;
  return { leads, skipped };
}

// "Imported N leads for {First}".
export function importedText(n: number, agentName: string): string {
  const first = agentName.trim().split(/\s+/)[0] ?? agentName;
  return `Imported ${n} ${n === 1 ? "lead" : "leads"} for ${first}`;
}
