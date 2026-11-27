"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { callAction } from "@/lib/auth/call-action";
import { loadTeamChatLeads, type ChatLead } from "@/lib/chat/actions";
import { css } from "@/lib/css";
import { reviewLeads } from "@/lib/leads/actions";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { useApp } from "@/lib/store";

// The new leads card (⟦leads:id,id⟧): 5 rows, then "Show all N". Each row
// shows "Why:" (or "Not a fit:" when dismissed) with platform and review
// chips; a click opens the Lead overview.
const FIRST = 5;
const REVIEW_LABEL: Record<string, string> = { pending: "Pending", accepted: "Accepted", dismissed: "Dismissed" };

export default function ScrapeResults({ teamId, ids }: { teamId: string; ids: string[] }) {
  const [leads, setLeads] = useState<ChatLead[] | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const key = ids.join(",");

  const load = useCallback(async () => {
    const list = await loadTeamChatLeads(teamId, key.split(",")).catch(() => null);
    setLeads(list ?? []);
  }, [teamId, key]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!leads) return <div className="chat-card"><p className="sub-empty-text">Loading the leads…</p></div>;
  if (!leads.length) return null;
  const shown = all ? leads : leads.slice(0, FIRST);
  const current = leads.find((l) => l.id === open) ?? null;

  return (
    <div className="chat-card" role="group" aria-label="New leads">
      <ul className="chat-leads">
        {shown.map((l) => (
          <li key={l.id}>
            <button type="button" className="chat-lead-row" onClick={() => setOpen(l.id)}>
              <span className="chat-lead-top">
                <span className="cell-main">{l.name}</span>
                <span className="chat-lead-chips">
                  {l.platform ? <span className="attr-chip">{l.platform}</span> : null}
                  <span className={css("review-chip", `is-${l.review}`)}>{REVIEW_LABEL[l.review] ?? l.review}</span>
                </span>
              </span>
              {l.title || l.company ? <span className="cell-sub">{[l.title, l.company].filter(Boolean).join(" · ")}</span> : null}
              {l.fitReason ? (
                <span className="chat-lead-why">
                  <strong>{l.review === "dismissed" ? "Not a fit:" : "Why:"}</strong> {l.fitReason}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {!all && leads.length > FIRST ? (
        <div className="chat-card-foot">
          <button type="button" className="btn btn-sm" onClick={() => setAll(true)}>
            Show all {leads.length}
          </button>
        </div>
      ) : null}
      <LeadOverview
        lead={current}
        onClose={() => setOpen(null)}
        onReviewed={(id, review) => setLeads((cur) => (cur ?? []).map((l) => (l.id === id ? { ...l, review } : l)))}
      />
    </div>
  );
}

// The Lead overview modal: role or what they want, why it fits, contact,
// research summary and angle, "Found {date}", Accept · Dismiss · Open in Leads →.
export function LeadOverview({
  lead,
  onClose,
  onReviewed,
}: {
  lead: ChatLead | null;
  onClose: () => void;
  onReviewed: (id: string, review: "accepted" | "dismissed") => void;
}) {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);

  async function review(r: "accepted" | "dismissed") {
    if (!lead) return;
    setBusy(true);
    const res = await callAction(() => reviewLeads([lead.id], r));
    setBusy(false);
    if (!res.ok) return showToast(res.error, true);
    onReviewed(lead.id, r);
    refreshNavCounts();
    showToast(r === "accepted" ? `${lead.name} accepted` : `${lead.name} dismissed`);
  }

  const isProfile = (lead?.platform ?? "").toLowerCase().includes("linkedin");
  const found = lead ? new Date(lead.createdAt) : null;

  return (
    <Modal
      open={!!lead}
      title={lead?.name ?? ""}
      onClose={onClose}
      footer={
        lead ? (
          <>
            <Link href="/leads" className="btn btn-sm btn-ghost" onClick={onClose}>
              Open in Leads →
            </Link>
            {lead.review !== "dismissed" ? (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => review("dismissed")}>
                Dismiss
              </button>
            ) : null}
            {lead.review !== "accepted" ? (
              <button type="button" className="btn btn-sm btn-accent" disabled={busy} onClick={() => review("accepted")}>
                Accept
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {lead ? (
        <div className="lead-detail">
          <div className="lead-detail-chips">
            {lead.platform ? <span className="attr-chip">{lead.platform}</span> : null}
            <span className={css("review-chip", `is-${lead.review}`)}>{REVIEW_LABEL[lead.review] ?? lead.review}</span>
          </div>
          {lead.title || lead.company ? (
            <div className="lead-sec">
              <span className="chat-q-label">Role</span>
              <p>{[lead.title, lead.company].filter(Boolean).join(" · ")}</p>
            </div>
          ) : null}
          <div className="lead-sec">
            <span className="chat-q-label">{lead.review === "dismissed" ? "Not a fit" : "Why it fits"}</span>
            <p>{lead.fitReason || "Not assessed yet."}</p>
          </div>
          <div className="lead-sec">
            <span className="chat-q-label">Contact</span>
            <p>
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="auth-link">
                  {lead.email}
                </a>
              ) : lead.profileUrl ? (
                <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer nofollow" className="auth-link">
                  {isProfile ? "Open profile ↗" : "Open post ↗"}
                </a>
              ) : (
                <span className="cell-none">No contact details yet.</span>
              )}
            </p>
          </div>
          {lead.research ? (
            <div className="lead-sec">
              <span className="chat-q-label">Research</span>
              {lead.research.summary ? <p>{lead.research.summary}</p> : null}
              {lead.research.angle ? (
                <p>
                  <strong>Angle:</strong> {lead.research.angle}
                </p>
              ) : null}
            </div>
          ) : null}
          {found && !Number.isNaN(found.getTime()) ? (
            <p className="cell-sub">Found {found.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
