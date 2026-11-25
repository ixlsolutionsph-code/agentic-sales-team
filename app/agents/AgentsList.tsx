"use client";

import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { AgentAvatar, StatusPill } from "@/components/agents/AgentBits";
import { agentNow, visibleAgents } from "@/lib/agents/derive";
import { EMPTY_STATS, workLine } from "@/lib/agents/stats";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import type { Agent } from "@/lib/types";
import { useConfirmClick } from "@/lib/useConfirmClick";

// /agents: one card per agent. Delete needs a second click ("Delete?").
export default function AgentsList() {
  const { agents, states, config } = useApp();
  const list = visibleAgents(agents, states, config);

  if (!list.length) {
    return (
      <EmptyState
        icon="bot"
        title="No agents yet"
        action={
          <Link href="/create" className="btn btn-accent">
            + Create your first agent
          </Link>
        }
      />
    );
  }

  return (
    <ul className="agent-grid">
      {list.map((a) => (
        <li key={a.id}>
          <AgentCard agent={a} />
        </li>
      ))}
    </ul>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const { states, removeAgent } = useApp();
  const now = agentNow(agent, states[agent.id]);
  const del = useConfirmClick();

  return (
    <article className="card agent-card-app" aria-label={agent.name}>
      <div className="agent-card-top">
        <AgentAvatar agent={agent} size={48} />
        <div className="agent-card-id">
          <h2 className="agent-card-name">{agent.name}</h2>
          <p className="agent-card-role">{agent.role}</p>
        </div>
        <StatusPill status={now.status} />
      </div>
      <p className="agent-card-task">{now.task}</p>
      <p className="agent-card-work">{workLine(EMPTY_STATS)}</p>
      <div className="agent-card-actions">
        <button
          type="button"
          className={css("btn btn-sm", del.armed && "btn-danger")}
          aria-label={del.armed ? `Confirm delete ${agent.name}` : `Delete ${agent.name}`}
          onClick={() => del.click(() => removeAgent(agent.id))}
        >
          {del.armed ? "Delete?" : "Delete"}
        </button>
        <Link href={`/agents/${encodeURIComponent(agent.id)}`} className="btn btn-sm btn-accent" aria-label={`Open ${agent.name}`}>
          Open
        </Link>
      </div>
    </article>
  );
}
