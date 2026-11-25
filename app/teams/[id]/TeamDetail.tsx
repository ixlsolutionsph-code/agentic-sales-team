"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { Btn } from "@/components/primitives";
import { AgentAvatar, StatusPill } from "@/components/agents/AgentBits";
import { CoverageChip, IconPicker, SoonChip, TeamIcon } from "@/components/teams/TeamBits";
import { agentNow, teamKpis, teamSubtitle, visibleAgents, workingCount } from "@/lib/agents/derive";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import { membersOfTeam } from "@/lib/teams/membership";
import { TEAM_GOAL_MAX, TEAM_NAME_MAX, coverage, teamTemplate } from "@/lib/teams/new";
import type { Agent, Team } from "@/lib/types";
import { useWorkspaceStats } from "@/lib/useWorkspaceStats";
import { loadTeamLeads } from "@/lib/workspace/actions";

type TeamLead = Awaited<ReturnType<typeof loadTeamLeads>>["leads"][number];

// /teams/[id] (02-sitemap.md §6). Pending approvals come in Milestone 9.
export default function TeamDetail({ id }: { id: string }) {
  const { teams } = useApp();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <div className="page">
        <EmptyState
          icon="team"
          title="Team not found"
          text="This team was deleted or the link is wrong."
          action={
            <Link href="/dashboard" className="btn">
              ← Dashboard
            </Link>
          }
        />
      </div>
    );
  }
  return <TeamView team={team} />;
}

function TeamView({ team }: { team: Team }) {
  const { agents, states, config, teamMembers, setTeamMembers, deleteTeam, showToast } = useApp();
  const router = useRouter();
  const stats = useWorkspaceStats();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const all = visibleAgents(agents, states, config);
  const memberIds = membersOfTeam(team, teamMembers, states);
  const members = memberIds.map((mid) => all.find((a) => a.id === mid)).filter((a): a is Agent => !!a);
  const working = workingCount(memberIds, states, stats.liveJobs);
  const kpis = teamKpis(memberIds, stats.perAgent);
  const rows = coverage(team.template, members.map((m) => m.capabilities));
  const soon = teamTemplate(team.template).soon;
  const nowWorking = members.filter((m) => agentNow(m, states[m.id], stats.liveJobs).status === "working");
  const activity = stats.activity.filter((a) => memberIds.includes(a.agentId)).slice(0, 6);
  const leads = useTeamLeads(memberIds);

  function removeMember(agent: Agent) {
    setTeamMembers(
      team.id,
      memberIds.filter((m) => m !== agent.id),
    ).then((res) => {
      if (res.ok) showToast(`${agent.name} removed from ${team.name}`);
    });
  }

  async function onDelete() {
    setBusy(true);
    const res = await deleteTeam(team.id);
    if (res.ok) {
      showToast(`${team.name} deleted`);
      router.push("/dashboard");
    } else setBusy(false);
  }

  return (
    <div className="page team-page">
      <Link href="/dashboard" className="auth-link back-link">
        ← Dashboard
      </Link>

      <header className="team-head">
        <TeamIcon icon={team.icon} size={64} />
        <div className="team-head-id">
          <h2 className="agent-head-name">{team.name}</h2>
          <p className="agent-head-role">{teamSubtitle(team, memberIds.length)}</p>
          <p className="team-head-line">
            {memberIds.length} {memberIds.length === 1 ? "member" : "members"} · {working} working now
          </p>
        </div>
        <div className="agent-head-actions">
          {confirmDelete ? (
            <>
              <span className="team-confirm-text">Delete this team?</span>
              <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} disabled={busy}>
                Confirm
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setEditOpen(true)}>
                Edit
              </button>
              <button type="button" className="btn btn-sm btn-accent" onClick={() => setAddOpen(true)}>
                + Add agents
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete team
              </button>
            </>
          )}
        </div>
      </header>

      <div className="perf-grid" aria-label="Team numbers">
        <Kpi label="Meetings" value={kpis.meetings} />
        <Kpi label="In pipeline" value={kpis.pipeline} />
        <Kpi label="Leads" value={kpis.leads} />
        <Kpi label="Avg lead score" value={kpis.avgScore} />
      </div>

      <section className="card team-card-sec" aria-labelledby="sec-working">
        <h3 className="agent-section-title" id="sec-working">
          Working now
        </h3>
        {nowWorking.length ? (
          <ul className="working-strip">
            {nowWorking.map((m) => (
              <li key={m.id} className="working-item">
                <AgentAvatar agent={m} size={28} />
                <span className="working-name">{m.name}</span>
                <span className="working-task">{agentNow(m, states[m.id], stats.liveJobs).task}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub-empty-text">Nobody is working right now.</p>
        )}
      </section>

      {rows.length || soon.length ? (
        <div className="team-coverage" aria-label="Capabilities this team needs">
          {rows.map((r) => (
            <CoverageChip key={r.cap} cap={r.cap} covered={r.covered} missingWord />
          ))}
          {soon.map((c) => (
            <SoonChip key={c} cap={c} />
          ))}
        </div>
      ) : null}

      <section className="card team-card-sec" aria-labelledby="sec-members">
        <h3 className="agent-section-title" id="sec-members">
          Members
        </h3>
        {members.length ? (
          <ul className="team-members">
            {members.map((m) => {
              const n = stats.perAgent[m.id]?.leads ?? 0;
              return (
                <li key={m.id} className="team-member">
                  <Link href={`/agents/${encodeURIComponent(m.id)}`} className="team-member-link">
                    <AgentAvatar agent={m} size={40} />
                    <span className="member-pick-id">
                      <span className="member-pick-name">{m.name}</span>
                      <span className="member-pick-role">{m.role}</span>
                    </span>
                  </Link>
                  <StatusPill status={agentNow(m, states[m.id], stats.liveJobs).status} />
                  <span className="team-member-leads">
                    {n} {n === 1 ? "lead" : "leads"}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${m.name} from ${team.name}`}
                    title="Remove from team"
                    onClick={() => removeMember(m)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="sub-empty-text">No agents on this team yet. Use &quot;Add agents&quot; to build it out.</p>
        )}
      </section>

      <section className="card team-card-sec" aria-labelledby="sec-leads">
        <h3 className="agent-section-title" id="sec-leads">
          Team leads
        </h3>
        {leads.leads.length ? (
          <>
            <ul className="team-leads">
              {leads.leads.map((l) => (
                <LeadRow key={l.id} lead={l} agent={all.find((a) => a.id === l.agentId)} />
              ))}
            </ul>
            {leads.total > leads.leads.length ? (
              <p className="sub-empty-text">
                Showing {leads.leads.length} of {leads.total}.{" "}
                <Link href="/leads" className="auth-link">
                  See all in Leads →
                </Link>
              </p>
            ) : null}
          </>
        ) : (
          <p className="sub-empty-text">No leads in this team&apos;s book yet.</p>
        )}
      </section>

      <section className="card team-card-sec" aria-labelledby="sec-goal">
        <h3 className="agent-section-title" id="sec-goal">
          Shared goal
        </h3>
        <p className="team-goal">{team.goal ? <>🎯 {team.goal}</> : <span className="sub-empty-text">No shared goal yet. Use Edit to add one.</span>}</p>
      </section>

      <section className="card team-card-sec" aria-labelledby="sec-activity">
        <h3 className="agent-section-title" id="sec-activity">
          Recent activity
        </h3>
        {activity.length ? (
          <ul className="activity-list">
            {activity.map((a) => (
              <li key={a.id} className="activity-row">
                <span>{a.text}</span>
                <time className="activity-time" dateTime={a.createdAt}>
                  {shortDate(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub-empty-text">No activity yet.</p>
        )}
      </section>

      <EditTeamModal team={team} open={editOpen} onClose={() => setEditOpen(false)} />
      <AddAgentsModal team={team} memberIds={memberIds} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

// The first 12 leads of the team's book, reloaded when the members change.
function useTeamLeads(memberIds: string[]) {
  const key = memberIds.join(",");
  const ids = useMemo(() => (key ? key.split(",") : []), [key]);
  const [data, setData] = useState<{ leads: TeamLead[]; total: number }>({ leads: [], total: 0 });
  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setData({ leads: [], total: 0 });
      return;
    }
    loadTeamLeads(ids)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ids]);
  return data;
}

function LeadRow({ lead, agent }: { lead: TeamLead; agent?: Agent }) {
  const sub = [lead.title, lead.company].filter(Boolean).join(" · ");
  return (
    <li className="team-lead">
      <span className="member-pick-id">
        <span className="member-pick-name">{lead.name}</span>
        {sub ? <span className="member-pick-role">{sub}</span> : null}
      </span>
      <span className="team-lead-meta">{agent?.name ?? ""}</span>
      <span className="team-lead-meta">{lead.status}</span>
      <span className="team-lead-score">{lead.score}</span>
    </li>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="perf-stat">
      <span className="perf-value">{value}</span>
      <span className="perf-label">{label}</span>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EditTeamModal({ team, open, onClose }: { team: Team; open: boolean; onClose: () => void }) {
  const { editTeam, showToast } = useApp();
  const [name, setName] = useState(team.name);
  const [icon, setIcon] = useState(team.icon);
  const [goal, setGoal] = useState(team.goal);

  // Start from the saved values each time the window opens.
  useEffect(() => {
    if (open) {
      setName(team.name);
      setIcon(team.icon);
      setGoal(team.goal);
    }
  }, [open, team.name, team.icon, team.goal]);

  async function onSave() {
    if (!name.trim()) return;
    onClose();
    const res = await editTeam(team.id, { name, icon, goal });
    if (res.ok) showToast("Saved");
  }

  return (
    <Modal
      open={open}
      title="Edit team"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!name.trim()} onClick={onSave}>
            Save changes
          </Btn>
        </>
      }
    >
      <form
        className="team-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        noValidate
      >
        <label className="auth-field">
          <span className="lp-label">Team name</span>
          <input className="lp-input" value={name} maxLength={TEAM_NAME_MAX} onChange={(e) => setName(e.target.value)} data-autofocus />
        </label>
        {!name.trim() ? (
          <p className="auth-error" role="alert">
            A team name is required.
          </p>
        ) : null}
        <IconPicker value={icon} onChange={setIcon} />
        <label className="auth-field">
          <span className="lp-label">Shared goal</span>
          <textarea className="lp-input wiz-textarea" rows={3} maxLength={TEAM_GOAL_MAX} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}

function AddAgentsModal({ team, memberIds, open, onClose }: { team: Team; memberIds: string[]; open: boolean; onClose: () => void }) {
  const { agents, states, config, setTeamMembers, showToast } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const others = visibleAgents(agents, states, config).filter((a) => !memberIds.includes(a.id));

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  async function onAdd() {
    if (!picked.length) return;
    onClose();
    const res = await setTeamMembers(team.id, [...memberIds, ...picked]);
    if (res.ok) showToast(picked.length === 1 ? `1 agent added to ${team.name}` : `${picked.length} agents added to ${team.name}`);
  }

  return (
    <Modal
      open={open}
      title={`Add agents to ${team.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          {others.length ? (
            <Btn variant="primary" disabled={!picked.length} onClick={onAdd}>
              {picked.length ? `Add ${picked.length}` : "Add"}
            </Btn>
          ) : null}
        </>
      }
    >
      {others.length ? (
        <ul className="member-picks">
          {others.map((a) => {
            const on = picked.includes(a.id);
            return (
              <li key={a.id}>
                <label className={css("member-pick", on && "is-on")}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setPicked((cur) => (on ? cur.filter((x) => x !== a.id) : [...cur, a.id]))}
                  />
                  <AgentAvatar agent={a} size={32} />
                  <span className="member-pick-id">
                    <span className="member-pick-name">{a.name}</span>
                    <span className="member-pick-role">{a.role}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sub-empty-text">Every agent is already on this team.</p>
      )}
    </Modal>
  );
}
