// Every limit and fixed message for runs (01-prd.md §7.5 and §7.8).
import { capabilityLabel } from "@/lib/agentTypes";

export const JOB_KINDS = ["scrape", "assess", "research", "qualify", "match", "outreach", "proposal", "book-meeting"] as const;
export type JobKind = (typeof JOB_KINDS)[number];
// Kinds that need Gemini. They are refused at enqueue when there is no key.
export const AI_KINDS: readonly JobKind[] = ["assess", "research", "qualify", "match", "outreach", "proposal"];
// Kinds the job runner works on (scrape has its own runner in Milestone 8; book-meeting has none).
export const RUNNABLE_KINDS: readonly JobKind[] = ["assess", "research", "qualify", "match", "outreach", "proposal"];

export const JOB_STATUSES = ["needs_approval", "queued", "running", "done", "failed", "dismissed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const RUNS_PER_DAY = 100;
export const SEARCHES_PER_DAY = 20;
export const CHAT_MESSAGES_PER_DAY = 300;
export const MAX_LEADS_PER_RUN = 25;
export const POD_BATCH = 20;
export const DEFAULT_BATCH = 5;
export const INSTRUCTION_MAX = 500;
export const SEARCH_TARGET = { min: 1, max: 25, default: 10 } as const;

export const MSG_RUNS_LIMIT = `You've reached today's limit of ${RUNS_PER_DAY} runs. Try again tomorrow.`;
export const MSG_SEARCHES_LIMIT = `You've reached today's limit of ${SEARCHES_PER_DAY} lead searches. Try again tomorrow.`;
export const MSG_TOO_MANY_LEADS = `Pick at most ${MAX_LEADS_PER_RUN} leads at a time.`;
export const MSG_INSTRUCTION_TOO_LONG = "Keep the search request under 500 characters.";
export const MSG_NO_AI = "AI isn't set up on this server, so I can't do that. Ask your admin to add the Gemini API key.";
export const MSG_AGENT_UNAVAILABLE = "This agent is paused or no longer exists.";
export const MSG_RUN_FAILED = "That run didn't complete. Please check the agent's page.";
export const MSG_SEARCH_FAILED = "That search didn't complete. Please try again.";
export const MSG_TIMED_OUT = "Timed out: the run was stopped before it finished.";
export const MSG_OPEN_DRAFT = "This lead already has a draft. Open it in Emails.";
export const MSG_NO_PRODUCTS = "Add products on the Products page first.";
export const MSG_NO_SEARCH_KEY = "Lead search isn't set up on this server. Ask your admin to add the Firecrawl API key.";
export const MSG_SEARCH_NEEDS_TEXT = "Tell me what leads to look for.";
export const MSG_SEARCH_DOWN = "The web search didn't work just now. Please try again in a few minutes.";
export const MSG_SEARCH_NO_CREDITS = "The lead search service has run out of credits for this month.";
export const SCRAPE_DEADLINE_MS = 45_000;

export function msgCantRun(kind: string): string {
  return `This agent can't run ${kind}.`;
}

// "{Kind label} failed. Please try again."
export function msgKindFailed(kind: string): string {
  return `${capabilityLabel(kind)} failed. Please try again.`;
}

export function isJobKind(v: unknown): v is JobKind {
  return typeof v === "string" && (JOB_KINDS as readonly string[]).includes(v);
}
