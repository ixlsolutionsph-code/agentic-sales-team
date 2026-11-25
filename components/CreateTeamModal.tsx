"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { capabilityLabel, TEAM_TEMPLATES, type CapabilityId } from "@/lib/agentTypes";
import { visibleAgents } from "@/lib/agents/derive";
import { newAgentId } from "@/lib/agents/new";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import {
  DEFAULT_TEAM_ICON,
  TEAM_GOAL_MAX,
  TEAM_NAME_MAX,
  coverage,
  gapAgentType,
  newTeamId,
  teamTemplate,
} from "@/lib/teams/new";
import { AgentAvatar } from "./agents/AgentBits";
import Modal from "./Modal";
import { Btn } from "./primitives";
import { CoverageChip, IconPicker, SoonChip } from "./teams/TeamBits";

// The global "Create a team" modal (02-sitemap.md §6): name, icon, template,
// members, coverage of the template's required capabilities, a quick Create
// for each gap, and the shared goal. Create opens the new team's page.
export default function CreateTeamModal() {
  const { teamModal, setTeamModal, closeTeamModal, agents, states, config, createAgent, createTeam, showToast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gapNames, setGapNames] = useState<Partial<Record<CapabilityId, string>>>({});
  const [gapBusy, setGapBusy] = useState<CapabilityId | null>(null);

  const list = visibleAgents(agents, states, config);
  const icon = teamModal.icon || DEFAULT_TEAM_ICON;
  const template = teamModal.template || "custom";
  const members = teamModal.members.filter((id) => list.some((a) => a.id === id));
  const memberCaps = list.filter((a) => members.includes(a.id)).map((a) => a.capabilities);
  const rows = coverage(template, memberCaps);
  const soon = teamTemplate(template).soon;
  const missing = rows.filter((r) => !r.covered).map((r) => r.cap);
  const name = teamModal.name.trim();

  function close() {
    setError("");
    setGapNames({});
    closeTeamModal();
  }

  function toggle(id: string) {
    setTeamModal({ members: members.includes(id) ? members.filter((m) => m !== id) : [...members, id] });
  }

  // Makes the suggested agent for a gap in place and ticks it.
  async function createForGap(cap: CapabilityId) {
    const t = gapAgentType(cap);
    const agentName = (gapNames[cap] ?? t.name).trim();
    if (!agentName) return;
    setGapBusy(cap);
    const res = await createAgent({ id: newAgentId(), name: agentName, type: t.type, capabilities: t.capabilities, char: null, goal: "" }, null);
    setGapBusy(null);
    if (!res.ok || !res.data) {
      showToast(`Couldn't create ${agentName}. Please try again.`, true);
      return;
    }
    setTeamModal({ members: [...members, res.data.id] });
    setGapNames((cur) => {
      const next = { ...cur };
      delete next[cap];
      return next;
    });
  }

  async function onCreate() {
    if (!name || busy) return;
    setBusy(true);
    setError("");
    const res = await createTeam({ id: newTeamId(), name, icon, template, members, goal: teamModal.goal });
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.ok ? "Something went wrong. Please try again." : res.error);
      return;
    }
    const id = res.data.id;
    close();
    router.push(`/teams/${encodeURIComponent(id)}`);
  }

  return (
    <Modal
      open={teamModal.open}
      title="Create a team"
      onClose={close}
      width={720}
      footer={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn variant="primary" disabled={!name || busy} onClick={onCreate}>
            {busy ? "Creating…" : "Create"}
          </Btn>
        </>
      }
    >
      <form
        className="team-form"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate();
        }}
        noValidate
      >
        <label className="auth-field">
          <span className="lp-label">Team name</span>
          <input
            className="lp-input"
            placeholder="e.g. EMEA Enterprise"
            value={teamModal.name}
            maxLength={TEAM_NAME_MAX}
            onChange={(e) => setTeamModal({ name: e.target.value })}
            data-autofocus
          />
        </label>

        <IconPicker value={icon} onChange={(v) => setTeamModal({ icon: v })} />

        <fieldset className="team-fieldset">
          <legend className="lp-label">Template</legend>
          <div className="tpl-grid" role="radiogroup" aria-label="Template">
            {TEAM_TEMPLATES.map((t) => {
              const on = template === t.id;
              const caps = [...t.required.map(capabilityLabel), ...t.soon.map((c) => `${capabilityLabel(c)} (soon)`)];
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={css("tpl-card", on && "is-on")}
                  onClick={() => setTeamModal({ template: t.id })}
                >
                  <span className="tpl-name">{t.label}</span>
                  <span className="tpl-caps">{caps.length ? caps.join(", ") : "Any agents"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="team-fieldset">
          <legend className="lp-label">
            Members <span className="team-count">· {members.length} selected</span>
          </legend>
          {list.length ? (
            <ul className="member-picks">
              {list.map((a) => {
                const on = members.includes(a.id);
                return (
                  <li key={a.id}>
                    <label className={css("member-pick", on && "is-on")}>
                      <input type="checkbox" checked={on} onChange={() => toggle(a.id)} />
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
            <p className="cap-none">No agents yet. You can create the ones this team needs below.</p>
          )}
        </fieldset>

        {rows.length || soon.length ? (
          <div className="team-coverage" aria-label="Capabilities this template needs">
            {rows.map((r) => (
              <CoverageChip key={r.cap} cap={r.cap} covered={r.covered} />
            ))}
            {soon.map((c) => (
              <SoonChip key={c} cap={c} />
            ))}
          </div>
        ) : null}

        {missing.length ? (
          <div className="gap-box">
            <p className="gap-title">Missing capabilities. Create an agent that has them:</p>
            <ul className="gap-list">
              {missing.map((cap) => {
                const t = gapAgentType(cap);
                const value = gapNames[cap] ?? t.name;
                return (
                  <li key={cap} className="gap-row">
                    <span className="gap-cap">
                      {capabilityLabel(cap)}
                      <span className="gap-type"> · {t.label}</span>
                    </span>
                    <input
                      className="lp-input gap-input"
                      aria-label={`Name for the new ${t.label}`}
                      value={value}
                      maxLength={120}
                      onChange={(e) => setGapNames((cur) => ({ ...cur, [cap]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (value.trim() && gapBusy === null) createForGap(cap);
                        }
                      }}
                    />
                    <Btn size="sm" disabled={!value.trim() || gapBusy !== null} onClick={() => createForGap(cap)}>
                      {gapBusy === cap ? "Creating…" : "Create"}
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <label className="auth-field">
          <span className="lp-label">Shared goal</span>
          <textarea
            className="lp-input wiz-textarea"
            rows={3}
            maxLength={TEAM_GOAL_MAX}
            placeholder="e.g. Book 10 meetings a month with HR managers in Manila."
            value={teamModal.goal}
            onChange={(e) => setTeamModal({ goal: e.target.value })}
          />
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
