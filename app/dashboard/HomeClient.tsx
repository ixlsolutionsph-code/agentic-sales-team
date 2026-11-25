"use client";

import Link from "next/link";
import { useState } from "react";
import CreateTeamButton from "@/components/CreateTeamButton";
import EmptyState from "@/components/EmptyState";
import { AgentAvatar } from "@/components/agents/AgentBits";
import { TeamIcon } from "@/components/teams/TeamBits";
import { agentNow, teamKpis, teamSubtitle, visibleAgents, workingCount } from "@/lib/agents/derive";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import { membersOfTeam } from "@/lib/teams/membership";
import type { Agent } from "@/lib/types";
import { useWorkspaceStats } from "@/lib/useWorkspaceStats";
import { firstName, greeting, monthWord, ringSpots, sumNumbers } from "@/lib/workspace/statsShape";

const RING_MAX = 8;

// /dashboard (02-sitemap.md §6): greeting, the hub card and the team cards.
export default function HomeClient() {
  const { user, agents, states, config, teams, teamMembers } = useApp();
  const stats = useWorkspaceStats();
  const [filter, setFilter] = useState<string>("all");

  const all = visibleAgents(agents, states, config);
  const filterTeam = teams.find((t) => t.id === filter);
  const shownIds = filterTeam ? membersOfTeam(filterTeam, teamMembers, states) : all.map((a) => a.id);
  const shown = shownIds.map((id) => all.find((a) => a.id === id)).filter((a): a is Agent => !!a);
  const live = workingCount(shownIds, states, stats.liveJobs);
  const tasks = stats.liveJobs.filter((j) => shownIds.includes(j.agentId)).length;
  const worked = sumNumbers(shownIds, stats.perAgent).monthLeads;
  const latest = stats.activity.filter((a) => shownIds.includes(a.agentId)).slice(0, 2);
  const now = new Date();
  const name = firstName(user?.name ?? "");

  return (
    <div className="page dash">
      <div className="dash-head">
        <h2 className="dash-greet" suppressHydrationWarning>
          {greeting(now.getHours())}
          {name ? `, ${name}` : ""}!
        </h2>
        <div className="agent-head-actions">
          <Link href="/agents" className="btn btn-sm">
            All agents
          </Link>
          <CreateTeamButton label="+ New team" className="btn btn-sm btn-accent" />
        </div>
      </div>

      <section className="hub" aria-label="Your agents">
        <div className="hub-top">
          <div className="hub-filters" role="group" aria-label="Show agents from">
            <button type="button" className={css("hub-pill", filter === "all" && "is-on")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                className={css("hub-pill", filter === t.id && "is-on")}
                aria-pressed={filter === t.id}
                onClick={() => setFilter(t.id)}
              >
                <span aria-hidden="true">{t.icon}</span> {t.name}
              </button>
            ))}
          </div>
          <span className="hub-live">
            <span className="hub-live-dot" aria-hidden="true" />
            {live} live
          </span>
        </div>

        <div className="hub-ring">
          <div className="hub-ellipse" aria-hidden="true" />
          <div className="hub-centre">
            <span className="hub-number">{worked}</span>
            <span className="hub-caption" suppressHydrationWarning>
              LEADS WORKED {monthWord(now)}
            </span>
            <span className="hub-sub">
              ⚡ {live} working · {tasks} {tasks === 1 ? "task" : "tasks"}
            </span>
          </div>
          {shown.length ? (
            <ul className="hub-agents">
              {shown.slice(0, RING_MAX).map((a, i) => {
                const spot = ringSpots(Math.min(shown.length, RING_MAX))[i];
                const st = agentNow(a, states[a.id], stats.liveJobs);
                return (
                  <li key={a.id} className="hub-agent" style={{ left: `${spot.left}%`, top: `${spot.top}%` }}>
                    <Link href={`/agents/${encodeURIComponent(a.id)}`} className="hub-agent-link" aria-label={`${a.name}, ${st.task}`}>
                      <AgentAvatar agent={a} size={48} />
                      <span className="hub-agent-name">{a.name}</span>
                      {st.status === "working" ? <span className="hub-badge">{st.task}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hub-empty">{filterTeam ? "No agents on this team yet." : "No agents yet."}</p>
          )}
        </div>
        {shown.length > RING_MAX ? (
          <p className="hub-more">
            +{shown.length - RING_MAX} more.{" "}
            <Link href="/agents" className="hub-link">
              See all agents
            </Link>
          </p>
        ) : null}

        <ul className="hub-activity" aria-label="Latest activity">
          {latest.length ? (
            latest.map((a) => (
              <li key={a.id} className="hub-activity-row">
                {a.text}
              </li>
            ))
          ) : (
            <li className="hub-activity-row is-empty">No activity yet.</li>
          )}
        </ul>
      </section>

      <section aria-labelledby="dash-teams" className="dash-teams">
        <h3 className="agent-section-title" id="dash-teams">
          Teams
        </h3>
        {teams.length ? (
          <ul className="team-grid">
            {teams.map((t) => {
              const ids = membersOfTeam(t, teamMembers, states);
              const k = teamKpis(ids, stats.perAgent);
              const w = workingCount(ids, states, stats.liveJobs);
              return (
                <li key={t.id}>
                  <Link href={`/teams/${encodeURIComponent(t.id)}`} className="card team-card">
                    <span className="team-card-top">
                      <TeamIcon icon={t.icon} size={44} />
                      <span className="member-pick-id">
                        <span className="team-card-name">{t.name}</span>
                        <span className="member-pick-role">{teamSubtitle(t, ids.length)}</span>
                      </span>
                    </span>
                    <span className="team-card-stats">
                      <Stat label="Leads" value={k.leads} />
                      <Stat label="Members" value={ids.length} />
                      <Stat label="Working" value={w} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="team" title="No teams yet" action={<CreateTeamButton label="+ Create your first team" />} />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="team-stat">
      <span className="team-stat-value">{value}</span>
      <span className="team-stat-label">{label}</span>
    </span>
  );
}
