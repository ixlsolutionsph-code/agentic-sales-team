"use server";

// Thin server actions for leads: read the session, check the input, then
// call ./store.ts with the active workspace id.
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { AGENT_ID_RE } from "@/lib/agents/new";
import { UUID_RE } from "@/lib/products/shape";
import {
  advanceLeadRow,
  deleteLeadRow,
  importLeadRows,
  insertLead,
  leadExtras,
  listWorkbook,
  liveAgentName,
  navCountRows,
  setLeadStatus,
  setReviewAllPending,
  setReviewRows,
  type LeadExtras,
} from "./store";
import { checkNewLead, isStage, leadsFromCSV, type Lead, type LeadStage } from "./types";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const TRY_AGAIN = "Something went wrong. Please try again.";
const GONE = "This lead was deleted. Reload the page.";
const NO_AGENT = "Pick an agent for this lead.";
const CSV_MAX_CHARS = 1_000_000;
const BULK_MAX = 500;

async function workspace(): Promise<string | null> {
  const s = await getSession();
  return s?.userId ?? null;
}

const isLeadId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export async function loadWorkbook(): Promise<ActionResult<Lead[]>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  try {
    return { ok: true, data: await listWorkbook(ws) };
  } catch (e) {
    console.error("loadWorkbook failed", e);
    return fail(MSG.serverDown);
  }
}

export async function addLead(input: unknown, agentId: string): Promise<ActionResult<Lead>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  const lead = checkNewLead(input);
  if (typeof lead === "string") return fail(lead);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId)) return fail(NO_AGENT);
  try {
    const agentName = await liveAgentName(ws, agentId);
    if (!agentName) return fail(NO_AGENT);
    const saved = await insertLead(ws, agentId, agentName, lead);
    return saved ? { ok: true, data: saved } : fail(TRY_AGAIN);
  } catch (e) {
    console.error("addLead failed", e);
    return fail(MSG.serverDown);
  }
}

// CSV import for one agent (up to 500 rows). `skipped` counts rows with no
// valid email and duplicates (in the file or already the agent's).
export async function importLeads(csv: string, agentId: string): Promise<ActionResult<{ leads: Lead[]; skipped: number }>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId)) return fail(NO_AGENT);
  if (typeof csv !== "string" || csv.length > CSV_MAX_CHARS) return fail("That file is too large.");
  const parsed = leadsFromCSV(csv);
  if (typeof parsed === "string") return fail(parsed);
  try {
    const agentName = await liveAgentName(ws, agentId);
    if (!agentName) return fail(NO_AGENT);
    const leads = await importLeadRows(ws, agentId, agentName, parsed.leads);
    return { ok: true, data: { leads, skipped: parsed.skipped + (parsed.leads.length - leads.length) } };
  } catch (e) {
    console.error("importLeads failed", e);
    return fail(MSG.serverDown);
  }
}

export async function setLeadStage(leadId: string, stage: LeadStage): Promise<ActionResult> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (!isLeadId(leadId) || !isStage(stage)) return fail(TRY_AGAIN);
  try {
    return (await setLeadStatus(ws, leadId, stage)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("setLeadStage failed", e);
    return fail(MSG.serverDown);
  }
}

export async function advanceLead(leadId: string): Promise<ActionResult<LeadStage>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (!isLeadId(leadId)) return fail(TRY_AGAIN);
  try {
    const next = await advanceLeadRow(ws, leadId);
    return next && isStage(next) ? { ok: true, data: next } : fail("This lead is already at the last stage.");
  } catch (e) {
    console.error("advanceLead failed", e);
    return fail(MSG.serverDown);
  }
}

// Accept or dismiss some leads, or (with "all") every pending lead.
export async function reviewLeads(leadIds: string[] | "all", review: "accepted" | "dismissed"): Promise<ActionResult<number>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (review !== "accepted" && review !== "dismissed") return fail(TRY_AGAIN);
  if (leadIds !== "all" && (!Array.isArray(leadIds) || leadIds.length > BULK_MAX || !leadIds.every(isLeadId))) return fail(TRY_AGAIN);
  try {
    const n = leadIds === "all" ? await setReviewAllPending(ws, review) : await setReviewRows(ws, leadIds, review);
    return { ok: true, data: n };
  } catch (e) {
    console.error("reviewLeads failed", e);
    return fail(MSG.serverDown);
  }
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (!isLeadId(leadId)) return fail(TRY_AGAIN);
  try {
    return (await deleteLeadRow(ws, leadId)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("deleteLead failed", e);
    return fail(MSG.serverDown);
  }
}

export async function loadLeadExtras(leadId: string): Promise<ActionResult<LeadExtras>> {
  const ws = await workspace();
  if (!ws) return fail(MSG.serverDown);
  if (!isLeadId(leadId)) return fail(TRY_AGAIN);
  try {
    return { ok: true, data: await leadExtras(ws, leadId) };
  } catch (e) {
    console.error("loadLeadExtras failed", e);
    return fail(MSG.serverDown);
  }
}

// Sidebar badges. Never throws: 0 on any failure.
export async function loadNavCounts(): Promise<{ leads: number; emails: number }> {
  try {
    const ws = await workspace();
    return ws ? await navCountRows(ws) : { leads: 0, emails: 0 };
  } catch (e) {
    console.error("loadNavCounts failed", e);
    return { leads: 0, emails: 0 };
  }
}
