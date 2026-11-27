"use server";

// Thin server actions for meetings: read the session, check the input, then
// call the server-only modules with the active workspace id.
import { aiJSON, isAIConfigured } from "@/lib/ai/gemini";
import { bookingProblem, meetingLabel, parseMeetingTime, safeTimeZone } from "@/lib/ai/meetingTime";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG, UUID_RE } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import { bookMeetingRows, bookingAgentForLead, bookingRules, listMeetings, type Meeting } from "./store";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const MSG_NO_BOOKER = "No agent can book meetings yet. Create an agent with that capability, and I will send requests to it.";
const MSG_NO_TIME = "Type a day and time, for example \"tomorrow 2pm\".";
const MSG_NEED_TIME = "Add a time too, for example \"tomorrow 2pm\".";

export async function loadMeetings(): Promise<Meeting[]> {
  try {
    const s = await getSession();
    return s ? await listMeetings(s.userId) : [];
  } catch (e) {
    console.error("loadMeetings failed", e);
    return [];
  }
}

// The lead details "Book a meeting" box: the owner typed the time on the
// lead, so it books at once (inside the booking agent's window).
export async function bookMeetingForLead(leadId: string, text: string, timeZone: string): Promise<ActionResult<{ label: string }>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof leadId !== "string" || !UUID_RE.test(leadId) || typeof text !== "string") return fail("Something went wrong. Please try again.");
  const words = text.trim().slice(0, 200);
  if (!words) return fail(MSG_NO_TIME);
  try {
    const agent = await bookingAgentForLead(s.userId, leadId);
    if (!agent) return fail(MSG_NO_BOOKER);
    const tz = safeTimeZone(timeZone);
    const ai = isAIConfigured() ? <T,>(sys: string, p: string, sc: Record<string, unknown>, o: { temperature: number; maxTokens: number }) => aiJSON<T>(sys, p, sc, o) : null;
    const when = await parseMeetingTime(words, new Date(), tz, ai);
    if (!when) return fail(MSG_NO_TIME);
    if (!when.hasTime) return fail(MSG_NEED_TIME);
    const rules = await bookingRules(s.userId, agent.id);
    const problem = bookingProblem(when.iso, rules, tz, new Date());
    if (problem) return fail(problem);
    const label = meetingLabel(when.iso, rules.duration, tz);
    const booked = await bookMeetingRows(s.userId, { agentId: agent.id, agentName: agent.name, leadIds: [leadId], whenAt: when.iso, whenLabel: label, title: rules.type });
    if (!booked.length) return fail("This lead no longer exists.");
    return { ok: true, data: { label } };
  } catch (e) {
    console.error("bookMeetingForLead failed", e);
    return fail(MSG.serverDown);
  }
}
