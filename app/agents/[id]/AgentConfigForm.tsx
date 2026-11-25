"use client";

import { useState, type FormEvent } from "react";
import { CapChips } from "@/components/agents/AgentBits";
import { AGENT_TYPES } from "@/lib/agentTypes";
import { hourLabel } from "@/lib/calendar";
import { BOOKING_HOURS, MEETING_LENGTHS, meetingSettings, type CapSettings } from "@/lib/agents/settings";
import { useApp } from "@/lib/store";
import type { Agent } from "@/lib/types";

// Role, goal and (for meeting bookers) booking settings, saved with
// "Save changes". Ask/Auto is separate and saves at once.
export default function AgentConfigForm({ agent, settings }: { agent: Agent; settings: CapSettings | null }) {
  const { saveAgentConfig, showToast } = useApp();
  const books = agent.capabilities.includes("book-meeting");
  const m = meetingSettings(settings);

  const [role, setRole] = useState(agent.role);
  const [goal, setGoal] = useState(agent.goal);
  const [type, setType] = useState(m.type);
  const [duration, setDuration] = useState(m.duration);
  const [start, setStart] = useState(m.windowStart);
  const [end, setEnd] = useState(m.windowEnd);
  const [weekdays, setWeekdays] = useState(m.weekdaysOnly);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Keep the current role and length in the lists even if they are not presets.
  const roles = AGENT_TYPES.map((t) => t.label);
  if (!roles.includes(role)) roles.unshift(role);
  const lengths: number[] = [...MEETING_LENGTHS];
  if (!lengths.includes(duration)) lengths.push(duration);
  lengths.sort((a, b) => a - b);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (books && end <= start) return setError("The end time must be after the start time.");
    const patch: { role: string; goal: string; settings?: CapSettings } = { role, goal: goal.trim() };
    if (books) {
      patch.settings = {
        "book-meeting": {
          ...(settings?.["book-meeting"] ?? {}),
          type: type.trim() || "Meeting",
          duration,
          windowStart: start,
          windowEnd: end,
          weekdaysOnly: weekdays,
        },
      };
    }
    setBusy(true);
    const res = await saveAgentConfig(agent.id, patch);
    setBusy(false);
    if (res.ok) showToast("Saved");
  }

  return (
    <form className="config-form" onSubmit={onSave} noValidate>
      <label className="auth-field">
        <span className="lp-label">Role</span>
        <select className="lp-input" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="auth-field">
        <span className="lp-label">Goal</span>
        <textarea className="lp-input wiz-textarea" rows={2} maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <div className="auth-field">
        <span className="lp-label">Capabilities</span>
        <CapChips caps={agent.capabilities} />
      </div>

      {books ? (
        <fieldset className="config-meeting">
          <legend className="sub-title">Meeting booking</legend>
          <label className="auth-field">
            <span className="lp-label">Meeting type</span>
            <input className="lp-input" value={type} maxLength={80} onChange={(e) => setType(e.target.value)} />
          </label>
          <label className="auth-field">
            <span className="lp-label">Length</span>
            <select className="lp-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {lengths.map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <div className="auth-field">
            <span className="lp-label" id={`book-between-${agent.id}`}>
              Book between
            </span>
            <div className="config-hours" role="group" aria-labelledby={`book-between-${agent.id}`}>
              <select className="lp-input" aria-label="Start time" value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {BOOKING_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <span>and</span>
              <select className="lp-input" aria-label="End time" value={end} onChange={(e) => setEnd(Number(e.target.value))}>
                {BOOKING_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="config-check">
            <input type="checkbox" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)} />
            <span>Weekdays only</span>
          </label>
        </fieldset>
      ) : null}

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
