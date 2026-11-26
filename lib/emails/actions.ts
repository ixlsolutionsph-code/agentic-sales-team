"use server";

// Thin server actions for the Emails page and proposals.
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { UUID_RE } from "@/lib/products/shape";
import { clearSentDrafts, discardDraft as discardDraftRow, listDrafts, markDraftSent, markProposalSentRow, type Draft } from "./store";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const GONE = "This draft was removed. Reload the page.";
const isId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export async function loadDrafts(): Promise<ActionResult<Draft[]>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  try {
    return { ok: true, data: await listDrafts(s.userId) };
  } catch (e) {
    console.error("loadDrafts failed", e);
    return fail(MSG.serverDown);
  }
}

export async function markSent(draftId: string): Promise<ActionResult<{ leadStatus: string }>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (!isId(draftId)) return fail(GONE);
  try {
    const r = await markDraftSent(s.userId, draftId);
    return r ? { ok: true, data: r } : fail(GONE);
  } catch (e) {
    console.error("markSent failed", e);
    return fail(MSG.serverDown);
  }
}

export async function discardDraft(draftId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (!isId(draftId)) return fail(GONE);
  try {
    return (await discardDraftRow(s.userId, draftId)) ? { ok: true } : fail(GONE);
  } catch (e) {
    console.error("discardDraft failed", e);
    return fail(MSG.serverDown);
  }
}

export async function clearSent(): Promise<ActionResult<number>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  try {
    return { ok: true, data: await clearSentDrafts(s.userId) };
  } catch (e) {
    console.error("clearSent failed", e);
    return fail(MSG.serverDown);
  }
}

export async function markProposalSent(proposalId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (!isId(proposalId)) return fail("This proposal was removed. Reload the page.");
  try {
    return (await markProposalSentRow(s.userId, proposalId)) ? { ok: true } : fail("This proposal was already marked sent.");
  } catch (e) {
    console.error("markProposalSent failed", e);
    return fail(MSG.serverDown);
  }
}
