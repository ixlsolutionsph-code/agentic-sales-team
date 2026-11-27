"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmButton from "@/components/ConfirmButton";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { Btn } from "@/components/primitives";
import { visibleAgents } from "@/lib/agents/derive";
import { LEAD_FIELD_LIMITS } from "@/lib/ai/untrusted";
import { callAction } from "@/lib/auth/call-action";
import { css } from "@/lib/css";
import {
  addLead,
  advanceLead,
  deleteLead,
  importLeads,
  loadLeadExtras,
  loadWorkbook,
  reviewLeads,
} from "@/lib/leads/actions";
import type { LeadExtras } from "@/lib/leads/store";
import {
  LEAD_CSV_MAX,
  LEAD_STAGES,
  STAGE_LABELS,
  importedText,
  leadTier,
  nextStage,
  type Lead,
  type LeadStage,
} from "@/lib/leads/types";
import { bookMeetingForLead } from "@/lib/meetings/actions";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { loadTasks, startRun } from "@/lib/jobs/actions";
import { teammatesOf } from "@/lib/teams/membership";
import { kickRunner } from "@/lib/useAgentWork";
import { useApp } from "@/lib/store";
import { safeUrl } from "@/lib/url/safeUrl";

type Tab = "active" | "pending";

// /leads (02-sitemap.md §6): Active and Pending tabs, filters, Import CSV,
// + Add lead, Run outreach per lead, and the lead details window.
export default function LeadsClient() {
  const { agents, states, config, teams, teamMembers, showToast } = useApp();
  const [outreachBusy, setOutreachBusy] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Tab>("active");
  const [agentFilter, setAgentFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const live = visibleAgents(agents, states, config);
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? "Deleted agent";

  const load = useCallback(async () => {
    const res = await callAction(() => loadWorkbook());
    if (res.ok && res.data) {
      setLeads(res.data);
      setState("ready");
    } else setState("error");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = leads.filter((l) => l.review === "accepted");
  const pending = leads.filter((l) => l.review === "pending");
  const shown = active.filter((l) => (!agentFilter || l.agentId === agentFilter) && (!stageFilter || l.status === stageFilter));
  const openLead = leads.find((l) => l.id === openId) ?? null;

  // Who writes the email for a lead: its own agent if it drafts emails, else
  // the first teammate that does.
  function writerFor(l: Lead): string | null {
    const can = (id: string) => live.some((a) => a.id === id && a.capabilities.includes("outreach") && !states[id]?.paused);
    if (can(l.agentId)) return l.agentId;
    return teammatesOf(l.agentId, teams, teamMembers, states).find(can) ?? null;
  }

  async function onOutreach(l: Lead) {
    const writer = writerFor(l);
    if (!writer) return;
    setOutreachBusy(l.id);
    const res = await callAction(() => startRun({ agentId: writer, kind: "outreach", leadIds: [l.id] }));
    if (!res.ok) {
      setOutreachBusy(null);
      return showToast(res.error, true);
    }
    await kickRunner();
    const [task] = await loadTasks([res.data!.jobId]).catch(() => []);
    setOutreachBusy(null);
    refreshNavCounts();
    if (!task || task.status === "queued" || task.status === "running") return showToast("Drafting… The email will appear in Emails shortly.");
    if (task.status === "failed") return showToast(task.summary, true);
    if (task.summary.startsWith("Drafted 1")) return showToast(`Draft for ${l.name} is ready in Emails`);
    showToast(task.summary);
  }

  function patch(id: string, p: Partial<Lead>) {
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  async function onAdvance(l: Lead) {
    const to = nextStage(l.status);
    if (!to) return;
    patch(l.id, { status: to });
    const res = await callAction(() => advanceLead(l.id));
    if (!res.ok) {
      patch(l.id, { status: l.status });
      showToast(res.error, true);
    } else if (res.data && res.data !== to) patch(l.id, { status: res.data });
  }

  async function onDelete(l: Lead) {
    const before = leads;
    setLeads((cur) => cur.filter((x) => x.id !== l.id));
    if (openId === l.id) setOpenId(null);
    const res = await callAction(() => deleteLead(l.id));
    if (!res.ok) {
      setLeads(before);
      showToast(res.error, true);
    } else refreshNavCounts();
  }

  async function onReview(ids: string[] | "all", review: "accepted" | "dismissed") {
    const before = leads;
    const hit = ids === "all" ? new Set(pending.map((l) => l.id)) : new Set(ids);
    setLeads((cur) => (review === "dismissed" ? cur.filter((l) => !hit.has(l.id)) : cur.map((l) => (hit.has(l.id) ? { ...l, review } : l))));
    const res = await callAction(() => reviewLeads(ids, review));
    if (!res.ok) {
      setLeads(before);
      showToast(res.error, true);
      return;
    }
    refreshNavCounts();
    if (ids === "all") {
      const n = res.data ?? hit.size;
      showToast(`${review === "accepted" ? "Accepted" : "Dismissed"} ${n} ${n === 1 ? "lead" : "leads"}`);
    }
  }

  if (state === "loading") {
    return (
      <div className="page">
        <p className="sub-empty-text">Loading leads…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="page">
        <EmptyState
          icon="alert"
          title="Couldn't load your leads"
          text="Check your connection and try again."
          action={<Btn onClick={() => { setState("loading"); load(); }}>Try again</Btn>}
        />
      </div>
    );
  }

  return (
    <div className="page leads-page">
      <div className="leads-bar">
        <div className="tabs" role="tablist" aria-label="Leads">
          <button type="button" role="tab" aria-selected={tab === "active"} className={css("tab", tab === "active" && "is-on")} onClick={() => setTab("active")}>
            Active
          </button>
          <button type="button" role="tab" aria-selected={tab === "pending"} className={css("tab", tab === "pending" && "is-on")} onClick={() => setTab("pending")}>
            Pending <span className="tab-count">{pending.length}</span>
          </button>
        </div>
        <div className="agent-head-actions">
          <Btn size="sm" onClick={() => setImportOpen(true)}>
            Import CSV
          </Btn>
          <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>
            + Add lead
          </Btn>
        </div>
      </div>

      {tab === "active" ? (
        <div role="tabpanel" className="leads-panel">
          {active.length ? (
            <div className="leads-filters">
              <label className="filter">
                <span className="sr-only">Filter by agent</span>
                <select className="lp-input select-sm" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
                  <option value="">All agents</option>
                  {[...new Set(active.map((l) => l.agentId))].map((id) => (
                    <option key={id} value={id}>
                      {agentName(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span className="sr-only">Filter by stage</span>
                <select className="lp-input select-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                  <option value="">All stages</option>
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {!active.length ? (
            <EmptyState icon="leads" title="No leads yet." />
          ) : !shown.length ? (
            <p className="sub-empty">
              <span className="sub-empty-text">No leads match these filters.</span>
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Lead</th>
                    <th scope="col">Company</th>
                    <th scope="col">Agent</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Score</th>
                    <th scope="col">
                      <span className="sr-only">Run outreach</span>
                    </th>
                    <th scope="col">
                      <span className="sr-only">Advance</span>
                    </th>
                    <th scope="col">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <button type="button" className="cell-link" onClick={() => setOpenId(l.id)}>
                          {l.name}
                        </button>
                        {l.title ? <div className="cell-sub">{l.title}</div> : null}
                      </td>
                      <td>{l.company || <span className="cell-none">-</span>}</td>
                      <td className="cell-nowrap">{agentName(l.agentId)}</td>
                      <td>
                        <span className={css("stage-pill", `stage-${l.status}`)}>{STAGE_LABELS[l.status]}</span>
                      </td>
                      <td className="cell-nowrap">
                        <Score score={l.score} />
                      </td>
                      <td>
                        {(() => {
                          const writer = writerFor(l);
                          return (
                            <Btn
                              size="sm"
                              disabled={!writer || outreachBusy !== null}
                              title={writer ? undefined : "No agent on this lead's team drafts emails."}
                              onClick={() => onOutreach(l)}
                              aria-label={`Run outreach for ${l.name}`}
                            >
                              {outreachBusy === l.id ? "Running…" : "Run outreach"}
                            </Btn>
                          );
                        })()}
                      </td>
                      <td>
                        <Btn size="sm" disabled={!nextStage(l.status)} onClick={() => onAdvance(l)} aria-label={`Advance ${l.name}`}>
                          Advance
                        </Btn>
                      </td>
                      <td className="cell-end">
                        <ConfirmButton label="Delete" armedLabel="Delete?" ariaLabel={`Delete ${l.name}`} onConfirm={() => onDelete(l)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="leads-panel">
          {pending.length ? (
            <>
              <div className="pending-head">
                <p className="sub-empty-text">Scraped candidates. Accept the good ones.</p>
                <div className="agent-head-actions">
                  <ConfirmButton label="Accept all" armedLabel={`Accept ${pending.length}?`} onConfirm={() => onReview("all", "accepted")} />
                  <ConfirmButton label="Dismiss all" armedLabel={`Dismiss ${pending.length}?`} onConfirm={() => onReview("all", "dismissed")} />
                </div>
              </div>
              <ul className="pending-list">
                {pending.map((l) => {
                  const url = safeUrl(l.profileUrl);
                  return (
                    <li key={l.id} className="card pending-row">
                      <div className="pending-main">
                        <button type="button" className="cell-link" onClick={() => setOpenId(l.id)}>
                          {l.name}
                        </button>
                        <div className="cell-sub">{[l.title, l.company].filter(Boolean).join(" · ") || agentName(l.agentId)}</div>
                        {l.fitReason ? <p className="pending-why">Why: {l.fitReason}</p> : null}
                        <div className="pending-chips">
                          {l.platform ? <span className="attr-chip">{l.platform}</span> : null}
                          <span className="review-chip is-pending">Pending</span>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="auth-link">
                              View post ↗
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="agent-head-actions">
                        <Btn size="sm" variant="primary" onClick={() => onReview([l.id], "accepted")} aria-label={`Accept ${l.name}`}>
                          Accept
                        </Btn>
                        <Btn size="sm" onClick={() => onReview([l.id], "dismissed")} aria-label={`Dismiss ${l.name}`}>
                          Dismiss
                        </Btn>
                        <ConfirmButton label="Delete" armedLabel="Delete?" ariaLabel={`Delete ${l.name}`} onConfirm={() => onDelete(l)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState icon="leads" title="No candidates awaiting review." />
          )}
        </div>
      )}

      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        agents={live.map((a) => ({ id: a.id, name: a.name }))}
        onAdded={(l) => {
          setLeads((cur) => [l, ...cur]);
          setTab("active");
          showToast(`${l.name} added`);
        }}
      />
      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        agents={live.map((a) => ({ id: a.id, name: a.name }))}
        onImported={(list, skipped, name) => {
          setLeads((cur) => [...list, ...cur]);
          setTab("active");
          showToast(`${importedText(list.length, name)}${skipped ? `. Skipped ${skipped} ${skipped === 1 ? "row" : "rows"} (no email or already added).` : ""}`);
        }}
      />
      <LeadDetails
        lead={openLead}
        agentName={openLead ? agentName(openLead.agentId) : ""}
        onClose={() => setOpenId(null)}
        onReview={(review) => openLead && onReview([openLead.id], review)}
        onBooked={load}
      />
    </div>
  );
}

function Score({ score }: { score: number }) {
  const tier = leadTier(score);
  if (!tier) return <span className="cell-none">-</span>;
  return (
    <span>
      {score} <span className={css("tier", `tier-${tier.toLowerCase()}`)}>{tier}</span>
    </span>
  );
}

type AgentOpt = { id: string; name: string };

function AgentSelect({ agents, value, onChange }: { agents: AgentOpt[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="auth-field">
      <span className="lp-label">Assign to agent</span>
      <select className="lp-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pick an agent</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoAgents() {
  return <p className="sub-empty-text">Create an agent first. Every lead belongs to an agent.</p>;
}

function AddLeadModal({ open, onClose, agents, onAdded }: { open: boolean; onClose: () => void; agents: AgentOpt[]; onAdded: (l: Lead) => void }) {
  const [f, setF] = useState({ name: "", title: "", company: "", email: "" });
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setF({ name: "", title: "", company: "", email: "" });
      setAgentId(agents.length === 1 ? agents[0].id : "");
      setError("");
    }
    // Only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ready = f.name.trim() && f.email.trim() && agentId;

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const res = await callAction(() => addLead(f, agentId));
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong. Please try again." : res.error);
    onAdded(res.data);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Add a lead"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!ready || busy} onClick={save}>
            {busy ? "Saving…" : "Add lead"}
          </Btn>
        </>
      }
    >
      {agents.length ? (
        <form
          className="team-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          <label className="auth-field">
            <span className="lp-label">Name</span>
            <input className="lp-input" value={f.name} maxLength={LEAD_FIELD_LIMITS.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus />
          </label>
          <div className="form-row">
            <label className="auth-field">
              <span className="lp-label">Title</span>
              <input className="lp-input" value={f.title} maxLength={LEAD_FIELD_LIMITS.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </label>
            <label className="auth-field">
              <span className="lp-label">Company</span>
              <input className="lp-input" value={f.company} maxLength={LEAD_FIELD_LIMITS.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
            </label>
          </div>
          <label className="auth-field">
            <span className="lp-label">Email</span>
            <input
              className="lp-input"
              type="email"
              value={f.email}
              maxLength={LEAD_FIELD_LIMITS.email}
              placeholder="name@company.com"
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </label>
          <AgentSelect agents={agents} value={agentId} onChange={setAgentId} />
          <p className="wiz-help form-help">Name, email and agent are required.</p>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <NoAgents />
      )}
    </Modal>
  );
}

function ImportLeadsModal({
  open,
  onClose,
  agents,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  agents: AgentOpt[];
  onImported: (list: Lead[], skipped: number, agentName: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setAgentId(agents.length === 1 ? agents[0].id : "");
      setError("");
    }
    // Only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run() {
    if (!file || !agentId || busy) return;
    if (file.size > 1_000_000) return setError("That file is too large.");
    setBusy(true);
    setError("");
    const text = await file.text();
    const res = await callAction(() => importLeads(text, agentId));
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong. Please try again." : res.error);
    onImported(res.data.leads, res.data.skipped, agents.find((a) => a.id === agentId)?.name ?? "");
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Import leads"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          {agents.length ? (
            <Btn variant="primary" disabled={!file || !agentId || busy} onClick={run}>
              {busy ? "Importing…" : "Import"}
            </Btn>
          ) : null}
        </>
      }
    >
      {agents.length ? (
        <div className="team-form">
          <p className="sub-empty-text">
            A CSV file with up to {LEAD_CSV_MAX} leads. The first row names the columns: name, email, title, company. Rows with no
            email, or an email this agent already has, are skipped.
          </p>
          <label className="auth-field">
            <span className="lp-label">CSV file</span>
            <input
              className="file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError("");
              }}
              data-autofocus
            />
          </label>
          <AgentSelect agents={agents} value={agentId} onChange={setAgentId} />
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <NoAgents />
      )}
    </Modal>
  );
}

function LeadDetails({
  lead,
  agentName,
  onClose,
  onReview,
  onBooked,
}: {
  lead: Lead | null;
  agentName: string;
  onClose: () => void;
  onReview: (review: "accepted" | "dismissed") => void;
  onBooked: () => void;
}) {
  const [extras, setExtras] = useState<LeadExtras | null>(null);
  const id = lead?.id ?? null;

  useEffect(() => {
    let alive = true;
    setExtras(null);
    if (!id) return;
    loadLeadExtras(id)
      .then((res) => {
        if (alive) setExtras(res.ok && res.data ? res.data : { matches: [], drafts: [] });
      })
      .catch(() => alive && setExtras({ matches: [], drafts: [] }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!lead) return null;
  const url = safeUrl(lead.profileUrl);
  const tier = leadTier(lead.score);

  return (
    <Modal open title={lead.name} onClose={onClose} width={640}>
      <div className="lead-detail">
        <div className="lead-detail-chips">
          <span className={css("review-chip", `is-${lead.review}`)}>{lead.review === "pending" ? "Pending review" : "Accepted"}</span>
          <span className={css("stage-pill", `stage-${lead.status}`)}>{STAGE_LABELS[lead.status as LeadStage]}</span>
          {tier ? (
            <span className={css("tier", `tier-${tier.toLowerCase()}`)}>
              {tier} · {lead.score}
            </span>
          ) : null}
        </div>
        <dl className="agent-facts">
          <div>
            <dt>Role</dt>
            <dd>{lead.title || "-"}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{lead.company || "-"}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="auth-link">
                  {lead.email}
                </a>
              ) : url ? (
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="auth-link">
                  Open profile ↗
                </a>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{agentName}</dd>
          </div>
          <div>
            <dt>Why it fits</dt>
            <dd>{lead.fitReason || "Not assessed yet."}</dd>
          </div>
          <div>
            <dt>Found</dt>
            <dd>{new Date(lead.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</dd>
          </div>
        </dl>

        <section className="lead-sec">
          <h3 className="sub-title">Research</h3>
          {lead.research?.summary ? (
            <>
              <p>{lead.research.summary}</p>
              {lead.research.angle ? (
                <p>
                  <strong>Angle:</strong> {lead.research.angle}
                </p>
              ) : null}
            </>
          ) : (
            <p className="sub-empty-text">No research yet. Ask a Research Agent to research this lead.</p>
          )}
        </section>

        <section className="lead-sec">
          <h3 className="sub-title">Matches</h3>
          {!extras ? (
            <p className="sub-empty-text">Loading…</p>
          ) : extras.matches.length ? (
            <ul className="lead-list">
              {extras.matches.map((m, i) => (
                <li key={i}>
                  <strong>{m.productName}</strong> · {m.score}
                  {m.reason ? <div className="cell-sub">{m.reason}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="sub-empty-text">No matches yet. Ask a Matchmaker to match this lead with your products.</p>
          )}
        </section>

        <section className="lead-sec">
          <h3 className="sub-title">Emails</h3>
          {!extras ? (
            <p className="sub-empty-text">Loading…</p>
          ) : extras.drafts.length ? (
            <ul className="lead-list">
              {extras.drafts.map((d) => (
                <li key={d.id}>
                  <strong>{d.subject}</strong> · {d.status === "sent" ? "Sent" : "Draft"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="sub-empty-text">No drafts yet.</p>
          )}
        </section>

        <BookMeetingBox leadId={lead.id} onBooked={onBooked} />

        {lead.review === "pending" ? (
          <div className="agent-head-actions">
            <Btn variant="primary" onClick={() => onReview("accepted")}>
              Accept
            </Btn>
            <Btn
              onClick={() => {
                onReview("dismissed");
                onClose();
              }}
            >
              Dismiss
            </Btn>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// "Book a meeting" on the lead (03-user-journey.md J5): type a time in plain
// words; it books at once inside the booking agent's hours.
function BookMeetingBox({ leadId, onBooked }: { leadId: string; onBooked: () => void }) {
  const { showToast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const res = await callAction(() => bookMeetingForLead(leadId, text, tz));
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong. Please try again." : res.error);
    setText("");
    showToast(`Meeting booked for ${res.data.label}`);
    onBooked();
  }

  return (
    <section className="lead-sec">
      <h3 className="sub-title">Book a meeting</h3>
      <form className="meet-box" onSubmit={book}>
        <label className="sr-only" htmlFor={`meet-${leadId}`}>
          When should the meeting be?
        </label>
        <input
          id={`meet-${leadId}`}
          className="lp-input"
          placeholder="For example: tomorrow 2pm"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <Btn type="submit" variant="primary" disabled={busy || !text.trim()}>
          {busy ? "Booking…" : "Book"}
        </Btn>
      </form>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
    </section>
  );
}
