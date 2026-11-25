"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import { AgentAvatar, CapChips, StatusPill } from "@/components/agents/AgentBits";
import { capabilityLabel, isEngineReady } from "@/lib/agentTypes";
import { agentNow, visibleAgents } from "@/lib/agents/derive";
import { agentSections, type SectionId } from "@/lib/agents/sections";
import { capMode, withMode } from "@/lib/agents/settings";
import { EMPTY_STATS, replyRate } from "@/lib/agents/stats";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import type { Agent } from "@/lib/types";
import AgentConfigForm from "./AgentConfigForm";

// /agents/[id]: header, sticky section tabs, sections, Configuration.
// Run buttons come in Milestones 7–8; the sections show empty states now.
export default function AgentDetail({ id }: { id: string }) {
  const { agents, states, config } = useApp();
  const agent = visibleAgents(agents, states, config).find((a) => a.id === id);

  if (!agent) {
    return (
      <div className="page">
        <EmptyState
          icon="bot"
          title="Agent not found"
          text="This agent was deleted or the link is wrong."
          action={
            <Link href="/agents" className="btn">
              ← All agents
            </Link>
          }
        />
      </div>
    );
  }
  return <AgentView agent={agent} />;
}

function AgentView({ agent }: { agent: Agent }) {
  const { states, config, setAgentPaused, removeAgent, showToast, saveAgentConfig } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionId>("overview");
  const now = agentNow(agent, states[agent.id]);
  const paused = states[agent.id]?.paused === true;
  const sections = agentSections(agent.capabilities);
  const settings = config[agent.id]?.settings ?? null;
  const has = (cap: string) => agent.capabilities.includes(cap);

  function goTo(id: SectionId) {
    setActiveTab(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onPause() {
    setBusy(true);
    const res = await setAgentPaused(agent.id, !paused);
    setBusy(false);
    if (res.ok) showToast(paused ? `${agent.name} resumed` : `${agent.name} paused`);
  }

  async function onDelete() {
    setBusy(true);
    const res = await removeAgent(agent.id);
    if (res.ok) {
      showToast(`${agent.name} deleted`);
      router.push("/agents");
    } else setBusy(false);
  }

  return (
    <div className="page agent-page">
      <Link href="/agents" className="auth-link back-link">
        ← All agents
      </Link>

      <header className="agent-head">
        <AgentAvatar agent={agent} size={72} />
        <div className="agent-head-id">
          <div className="agent-head-row">
            <h2 className="agent-head-name">{agent.name}</h2>
            <StatusPill status={now.status} />
          </div>
          <p className="agent-head-role">{agent.role}</p>
          {agent.goal ? (
            <p className="agent-head-goal">
              <span aria-hidden="true">🎯</span> {agent.goal}
            </p>
          ) : null}
        </div>
        <div className="agent-head-actions">
          <button type="button" className="btn btn-sm" onClick={onPause} disabled={busy}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => goTo("configuration")}>
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        </div>
      </header>

      <nav className="agent-tabs" aria-label="Agent sections">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={css("agent-tab", activeTab === s.id && "is-on")}
            aria-current={activeTab === s.id ? "true" : undefined}
            onClick={() => goTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <Section id="overview" title="Overview">
        <dl className="agent-facts">
          <div>
            <dt>Status</dt>
            <dd>{now.task}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{agent.role}</dd>
          </div>
          <div>
            <dt>Capabilities</dt>
            <dd>
              <CapChips caps={agent.capabilities} />
            </dd>
          </div>
          <div>
            <dt>Goal</dt>
            <dd>{agent.goal || "No goal set."}</dd>
          </div>
        </dl>
      </Section>

      {has("scrape") || has("qualify") ? (
        <Section id="leads" title="Leads">
          {has("scrape") ? <SubEmpty title="Find leads" text="No leads found yet." /> : null}
          {has("qualify") ? <SubEmpty title="Qualify leads" text="No leads qualified yet." /> : null}
        </Section>
      ) : null}
      {has("research") ? (
        <Section id="research" title="Research">
          <SubEmpty title="Research leads" text="No leads researched yet." />
        </Section>
      ) : null}
      {has("outreach") ? (
        <Section id="emails" title="Emails">
          <SubEmpty title="Run outreach" text="No drafts yet." />
        </Section>
      ) : null}
      {has("proposal") ? (
        <Section id="proposals" title="Proposals">
          <SubEmpty title="Generate proposals" text="No proposals yet." />
        </Section>
      ) : null}
      {has("follow-up") ? (
        <Section id="reach-outs" title="Reach Outs">
          <SubEmpty title="Follow-ups" text="Coming soon." />
        </Section>
      ) : null}
      {has("book-meeting") ? (
        <Section id="meetings" title="Meetings">
          <SubEmpty title="Booked meetings" text="No meetings booked yet." />
        </Section>
      ) : null}

      <Section id="tasks" title="Tasks">
        <p className="sub-empty-text">No tasks yet.</p>
      </Section>

      <Section id="performance" title="Performance">
        <div className="perf-grid">
          <Stat label="Leads worked" value={String(EMPTY_STATS.leads)} />
          <Stat label="Drafts sent" value={String(EMPTY_STATS.sent)} />
          <Stat label="Reply rate" value={`${replyRate(EMPTY_STATS)}%`} />
          <Stat label="Researched" value={String(EMPTY_STATS.researched)} />
        </div>
      </Section>

      <Section id="configuration" title="Configuration">
        <AgentConfigForm agent={agent} settings={settings} />
        <div className="autonomy">
          <h4 className="sub-title">Autonomy</h4>
          <p className="sub-empty-text">Ask: the agent waits for you to press Proceed. Auto: it starts at once. Saved as soon as you choose.</p>
          {agent.capabilities.length ? (
            <ul className="autonomy-list">
              {agent.capabilities.map((cap) => {
                const mode = capMode(settings, cap);
                const ready = isEngineReady(cap);
                return (
                  <li key={cap} className="autonomy-row">
                    <span className="autonomy-label">
                      {capabilityLabel(cap)}
                      {!ready ? <span className="cap-soon"> · Coming soon</span> : null}
                    </span>
                    <div className="seg-ctl" role="radiogroup" aria-label={`${capabilityLabel(cap)}: Ask or Auto`}>
                      {(["ask", "auto"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={mode === m}
                          disabled={!ready}
                          className={css("seg-btn", mode === m && "is-on")}
                          onClick={() => {
                            if (mode !== m) saveAgentConfig(agent.id, { settings: withMode(settings, cap, m) });
                          }}
                        >
                          {m === "ask" ? "Ask" : "Auto"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sub-empty-text">This agent has no capabilities.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: SectionId; title: string; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="card agent-section" aria-labelledby={`sec-${id}-title`}>
      <h3 id={`sec-${id}-title`} className="agent-section-title">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SubEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="sub-empty">
      <h4 className="sub-title">{title}</h4>
      <p className="sub-empty-text">{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="perf-stat">
      <span className="perf-value">{value}</span>
      <span className="perf-label">{label}</span>
    </div>
  );
}
