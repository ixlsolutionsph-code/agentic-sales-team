// Per-agent work numbers for the agent cards and the Performance section.
// The lead and draft data arrive in Milestones 6–7; until then all are 0.

export type AgentStats = { leads: number; sent: number; drafts: number; replied: number; researched: number };

export const EMPTY_STATS: AgentStats = { leads: 0, sent: 0, drafts: 0, replied: 0, researched: 0 };

// The card line: "{n} leads · {m} sent", or "No work yet".
export function workLine(s: AgentStats): string {
  if (s.leads === 0 && s.sent === 0) return "No work yet";
  return `${s.leads} ${s.leads === 1 ? "lead" : "leads"} · ${s.sent} sent`;
}

// Reply rate as a whole percent of sent drafts.
export function replyRate(s: AgentStats): number {
  return s.sent > 0 ? Math.round((s.replied / s.sent) * 100) : 0;
}
