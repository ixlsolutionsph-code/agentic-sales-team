// Helpers for the Emails page. Pure, so they can be unit tested.
import { EMAIL_RE } from "@/lib/auth/rules";

// Some mail apps cut very long mailto links; keep the body under this.
export const MAILTO_BODY_MAX = 1800;

// "Open in mail": the owner's own mail app with the draft filled in.
// Returns null when the lead has no usable email.
export function mailtoLink(email: string, subject: string, body: string): string | null {
  const to = email.trim();
  if (!EMAIL_RE.test(to) || /[?&#\s]/.test(to)) return null;
  const b = body.length > MAILTO_BODY_MAX ? `${body.slice(0, MAILTO_BODY_MAX)}…` : body;
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
}

// What "Copy message" puts on the clipboard.
export function copyText(subject: string, body: string): string {
  return subject ? `Subject: ${subject}\n\n${body}` : body;
}

// "To {lead} · company · email" or "To {lead} · company · {platform} DM".
export function toLine(d: { leadName: string; company: string; email: string; platform: string | null }): string {
  const how = d.email ? d.email : `${d.platform || "Direct"} DM`;
  return ["To " + d.leadName, d.company, how].filter(Boolean).join(" · ");
}

export type DraftTab = "to-send" | "sent" | "all";

// The Emails page list: tab, search ("Search lead, company or text") and agent filter.
export function filterDrafts<T extends { status: string; agentId: string; leadName: string; company: string; subject: string; body: string }>(
  list: T[],
  tab: DraftTab,
  q: string,
  agentId: string,
): T[] {
  const needle = q.trim().toLowerCase();
  return list.filter(
    (d) =>
      (tab === "all" || (tab === "sent" ? d.status === "sent" : d.status !== "sent")) &&
      (!agentId || d.agentId === agentId) &&
      (!needle || [d.leadName, d.company, d.subject, d.body].some((f) => f.toLowerCase().includes(needle))),
  );
}
