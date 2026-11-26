"use client";

import { useState } from "react";
import DraftActions from "@/components/emails/DraftActions";
import { Btn } from "@/components/primitives";
import { callAction } from "@/lib/auth/call-action";
import { css } from "@/lib/css";
import { markProposalSent } from "@/lib/emails/actions";
import { copyText, toLine } from "@/lib/emails/mailto";
import type { Draft, Proposal } from "@/lib/emails/store";
import type { JobKind } from "@/lib/jobs/limits";
import { LIVE_STATUSES, type Task } from "@/lib/jobs/tasks";
import { useApp } from "@/lib/store";

export const BUSY_LABELS: Record<string, string> = {
  scrape: "Finding…",
  qualify: "Qualifying…",
  research: "Researching…",
  outreach: "Running…",
  proposal: "Drafting…",
};

const GENERIC = "Something went wrong. Please try again.";

// A run button: queues the run, shows its busy label while it waits or
// works, then shows the result as a message.
export function RunButton({
  kind,
  label,
  tasks,
  disabled,
  run,
}: {
  kind: JobKind;
  label: string;
  tasks: Task[];
  disabled?: boolean;
  run: (kind: JobKind) => Promise<{ ok: true; task: Task | null } | { ok: false; error: string }>;
}) {
  const { showToast } = useApp();
  const [starting, setStarting] = useState(false);
  const live = tasks.some((t) => t.kind === kind && LIVE_STATUSES.has(t.status));
  const busy = starting || live;

  async function onClick() {
    setStarting(true);
    const res = await run(kind);
    setStarting(false);
    if (!res.ok) return showToast(res.error || GENERIC, true);
    const t = res.task;
    if (!t || LIVE_STATUSES.has(t.status)) return; // still working: the Tasks list shows progress
    if (t.status === "failed") showToast(t.summary || GENERIC, true);
    else showToast(t.summary);
  }

  return (
    <Btn size="sm" variant="primary" onClick={onClick} disabled={busy || disabled}>
      {busy ? BUSY_LABELS[kind] ?? "Working…" : label}
    </Btn>
  );
}

export function DraftList({ drafts, onChanged }: { drafts: Draft[]; onChanged: () => void }) {
  if (!drafts.length) return <p className="sub-empty-text">No drafts yet.</p>;
  return (
    <ul className="work-list">
      {drafts.map((d) => (
        <li key={d.id} className="work-item">
          <div className="work-head">
            <span className="cell-main">{d.subject}</span>
            <span className={css("review-chip", d.status === "sent" ? "is-accepted" : "is-pending")}>{d.status === "sent" ? "Sent" : "Draft"}</span>
          </div>
          <div className="cell-sub">{toLine(d)}</div>
          <details className="work-body">
            <summary>Show the email</summary>
            <pre className="draft-text">{d.body}</pre>
            {d.rationale ? <p className="cell-sub">Why this angle: {d.rationale}</p> : null}
          </details>
          <DraftActions draft={d} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}

export function ProposalList({ proposals, onChanged }: { proposals: Proposal[]; onChanged: () => void }) {
  const { showToast } = useApp();
  if (!proposals.length) return <p className="sub-empty-text">No proposals yet.</p>;

  async function copy(p: Proposal) {
    try {
      await navigator.clipboard.writeText(copyText(p.title, p.body));
      showToast("Copied");
    } catch {
      showToast("Couldn't copy. Select the text and copy it by hand.", true);
    }
  }

  async function sent(p: Proposal) {
    const res = await callAction(() => markProposalSent(p.id));
    if (!res.ok) return showToast(res.error, true);
    showToast("Proposal marked as sent");
    onChanged();
  }

  return (
    <ul className="work-list">
      {proposals.map((p) => (
        <li key={p.id} className="work-item">
          <div className="work-head">
            <span className="cell-main">{p.title}</span>
            <span className={css("review-chip", p.status === "sent" ? "is-accepted" : "is-pending")}>{p.status === "sent" ? "Sent" : "Draft"}</span>
          </div>
          <div className="cell-sub">
            For {p.leadName}
            {p.company ? ` · ${p.company}` : ""}
            {p.products.length ? ` · ${p.products.join(", ")}` : ""}
          </div>
          <details className="work-body">
            <summary>Show the proposal</summary>
            <pre className="draft-text">{p.body}</pre>
          </details>
          <div className="draft-actions">
            <Btn size="sm" onClick={() => copy(p)}>
              Copy
            </Btn>
            {p.status !== "sent" ? (
              <Btn size="sm" onClick={() => sent(p)}>
                Mark sent
              </Btn>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

const STATUS_TEXT: Record<string, string> = {
  needs_approval: "Waiting",
  queued: "Queued",
  running: "Working",
  done: "Done",
  failed: "Failed",
  dismissed: "Cancelled",
};

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className="sub-empty-text">No tasks yet.</p>;
  return (
    <ul className="task-list">
      {tasks.map((t) => (
        <li key={t.id} className="task-row">
          <span className={css("task-dot", `is-${t.status}`)} aria-hidden="true" />
          <div className="task-main">
            <div className="cell-main">
              {t.label}
              {t.leadCount ? <span className="cell-none"> · up to {t.leadCount} leads</span> : null}
            </div>
            <div className={css("cell-sub", t.status === "failed" && "is-error")}>{t.summary}</div>
            {t.steps.find((s) => s.id === "work")?.items?.length ? (
              <ul className="task-items">
                {t.steps
                  .find((s) => s.id === "work")!
                  .items!.map((it, i) => (
                    <li key={i} className={css("task-item", it.kind === "failed" && "is-error")}>
                      {it.title}
                      {it.meta ? ` · ${it.meta}` : ""}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
          <div className="task-side">
            <span className="task-status">{STATUS_TEXT[t.status] ?? t.status}</span>
            <time className="activity-time" dateTime={t.createdAt}>
              {new Date(t.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
