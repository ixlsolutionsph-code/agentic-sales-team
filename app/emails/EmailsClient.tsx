"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmButton from "@/components/ConfirmButton";
import DraftActions from "@/components/emails/DraftActions";
import EmptyState from "@/components/EmptyState";
import { Btn } from "@/components/primitives";
import { callAction } from "@/lib/auth/call-action";
import { css } from "@/lib/css";
import { clearSent, discardDraft, loadDrafts } from "@/lib/emails/actions";
import { filterDrafts, toLine, type DraftTab } from "@/lib/emails/mailto";
import type { Draft } from "@/lib/emails/store";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { useApp } from "@/lib/store";

const TABS: { id: DraftTab; label: string }[] = [
  { id: "to-send", label: "To send" },
  { id: "sent", label: "Sent" },
  { id: "all", label: "All" },
];

// /emails (02-sitemap.md §6): every draft in one place. The list is on the
// left, the open draft on the right. Nothing is ever sent from here: the
// owner sends from their own mail app and then presses Mark sent.
export default function EmailsClient() {
  const { agents, showToast } = useApp();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<DraftTab>("to-send");
  const [q, setQ] = useState("");
  const [agentId, setAgentId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await callAction(() => loadDrafts());
    if (res.ok && res.data) {
      setDrafts(res.data);
      setState("ready");
    } else setState("error");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? "Deleted agent";
  const count = (t: DraftTab) => filterDrafts(drafts, t, "", "").length;
  const shown = filterDrafts(drafts, tab, q, agentId);
  const open = shown.find((d) => d.id === openId) ?? shown[0] ?? null;

  async function onDiscard(d: Draft) {
    const before = drafts;
    setDrafts((cur) => cur.filter((x) => x.id !== d.id));
    const res = await callAction(() => discardDraft(d.id));
    if (!res.ok) {
      setDrafts(before);
      return showToast(res.error, true);
    }
    refreshNavCounts();
    showToast("Draft discarded");
  }

  async function onClearSent() {
    const before = drafts;
    setDrafts((cur) => cur.filter((x) => x.status !== "sent"));
    const res = await callAction(() => clearSent());
    if (!res.ok) {
      setDrafts(before);
      return showToast(res.error, true);
    }
    showToast(`Cleared ${res.data ?? 0} sent ${res.data === 1 ? "draft" : "drafts"}`);
  }

  if (state === "loading") {
    return (
      <div className="page">
        <p className="sub-empty-text">Loading drafts…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="page">
        <EmptyState
          icon="alert"
          title="Couldn't load your drafts"
          text="Check your connection and try again."
          action={<Btn onClick={() => { setState("loading"); load(); }}>Try again</Btn>}
        />
      </div>
    );
  }
  if (!drafts.length) {
    return (
      <div className="page">
        <EmptyState icon="mail" title="No drafts yet. Ask an agent to draft outreach and the emails show here." />
      </div>
    );
  }

  return (
    <div className="page emails-page">
      <div className="leads-bar">
        <div className="tabs" role="tablist" aria-label="Drafts">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={css("tab", tab === t.id && "is-on")} onClick={() => setTab(t.id)}>
              {t.label} <span className="tab-count">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <div className="leads-filters">
          <label className="filter">
            <span className="sr-only">Search drafts</span>
            <input className="lp-input input-sm" type="search" placeholder="Search lead, company or text" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="filter">
            <span className="sr-only">Filter by agent</span>
            <select className="lp-input select-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">All agents</option>
              {[...new Set(drafts.map((d) => d.agentId))].map((id) => (
                <option key={id} value={id}>
                  {agentName(id)}
                </option>
              ))}
            </select>
          </label>
          {tab === "sent" && count("sent") ? (
            <ConfirmButton label="Clear sent" armedLabel={`Clear ${count("sent")}?`} onConfirm={onClearSent} />
          ) : null}
        </div>
      </div>

      {!shown.length ? (
        <p className="sub-empty">
          <span className="sub-empty-text">No drafts match.</span>
        </p>
      ) : (
        <div className="mail-split">
          <ul className="mail-list" aria-label="Drafts">
            {shown.map((d) => (
              <li key={d.id}>
                <button type="button" className={css("mail-row", open?.id === d.id && "is-on")} aria-current={open?.id === d.id ? "true" : undefined} onClick={() => setOpenId(d.id)}>
                  <span className="mail-row-top">
                    <span className="cell-main side-ellipsis">{d.leadName}</span>
                    {d.status === "sent" ? <span className="review-chip is-accepted">Sent</span> : null}
                  </span>
                  <span className="side-ellipsis mail-subject">{d.subject}</span>
                  <span className="cell-sub side-ellipsis">{d.company || agentName(d.agentId)}</span>
                </button>
              </li>
            ))}
          </ul>
          {open ? (
            <article className="card mail-view" aria-label={`Draft for ${open.leadName}`}>
              <h2 className="mail-view-subject">{open.subject}</h2>
              <p className="cell-sub">{toLine(open)}</p>
              <p className="cell-sub">
                Drafted by {agentName(open.agentId)} ·{" "}
                {new Date(open.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {open.sentAt ? ` · Sent ${new Date(open.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
              </p>
              <pre className="draft-text">{open.body}</pre>
              {open.rationale ? (
                <div className="mail-why">
                  <h3 className="sub-title">Why this angle</h3>
                  <p>{open.rationale}</p>
                </div>
              ) : null}
              <div className="mail-actions">
                <DraftActions draft={open} onChanged={load} />
                {open.status !== "sent" ? (
                  <ConfirmButton label="Discard" armedLabel="Discard?" ariaLabel={`Discard the draft for ${open.leadName}`} onConfirm={() => onDiscard(open)} />
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
