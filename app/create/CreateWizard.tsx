"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";
import { AgentAvatar, CapChip, CapChips } from "@/components/agents/AgentBits";
import {
  AGENT_TYPES,
  CAPABILITIES,
  MEETING_LENGTH_ERROR,
  capabilitiesFor,
  capabilityLabel,
  isEngineReady,
  parseMeetingMinutes,
} from "@/lib/agentTypes";
import { firstSentence, newAgentId } from "@/lib/agents/new";
import type { CapSettings } from "@/lib/agents/settings";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import type { Agent } from "@/lib/types";
import { AGENT_CHARS, AGENT_COLOR, DEFAULT_CHAR } from "@/lib/visuals";

const STEPS = ["Identity", "Type", "Appearance", "Settings", "Goal"] as const;

// "Add new agent": 5 steps, full screen, no shell (02-sitemap.md §6 /create).
export default function CreateWizard() {
  const { wizard, setWizard, resetWizard, createAgent } = useApp();
  const [touchedName, setTouchedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Agent | null>(null);
  const [lengthText, setLengthText] = useState("");
  const headRef = useRef<HTMLHeadingElement>(null);

  // Start fresh each time the wizard opens, with Maya as the default look.
  useEffect(() => {
    resetWizard();
    setWizard({ char: DEFAULT_CHAR });
  }, [resetWizard, setWizard]);

  // Move focus to the step title only when the step actually changes
  // (keyboard and screen readers). On first open the name box keeps focus.
  const shown = useRef({ step: wizard.step, done: false });
  useEffect(() => {
    const done = created !== null;
    if (shown.current.step === wizard.step && shown.current.done === done) return;
    shown.current = { step: wizard.step, done };
    headRef.current?.focus();
  }, [wizard.step, created]);

  const step = wizard.step;
  const name = wizard.name.trim();
  const caps = wizard.type ? capabilitiesFor(wizard.type, wizard.capabilities) : [];
  const books = caps.includes("book-meeting");
  const minutes = lengthText.trim() ? parseMeetingMinutes(lengthText) : null;
  const lengthBad = books && lengthText.trim() !== "" && minutes === null;

  const canContinue =
    (step === 0 && name !== "") || (step === 1 && wizard.type !== "") || step === 2 || (step === 3 && !lengthBad);

  function next() {
    if (step === 0 && !name) {
      setTouchedName(true);
      return;
    }
    if (canContinue) setWizard({ step: step + 1 });
  }

  async function onCreate() {
    setBusy(true);
    setError("");
    // Only save settings when the Settings step set something.
    const settings: CapSettings | null =
      books && lengthText.trim() && minutes !== null ? { "book-meeting": { duration: minutes, length: lengthText.trim() } } : null;
    const res = await createAgent(
      { id: newAgentId(), name, type: wizard.type, capabilities: wizard.capabilities, char: wizard.char, goal: wizard.goal },
      settings,
    );
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(`Couldn't create ${name}. Please try again.`);
      return;
    }
    setCreated(res.data);
    resetWizard();
  }

  if (created) {
    return (
      <WizardFrame>
        <div className="wiz-done">
          <AgentAvatar agent={created} size={96} />
          <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
            Your agent {created.name} is now live!
          </h1>
          <CapChips caps={created.capabilities} />
          <div className="wiz-done-actions">
            <Link href="/agents" className="btn">
              Back to agents
            </Link>
            <Link href={`/agents/${encodeURIComponent(created.id)}`} className="btn btn-accent">
              View agent →
            </Link>
          </div>
        </div>
      </WizardFrame>
    );
  }

  return (
    <WizardFrame>
      <ol className="wiz-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={css("wiz-step", i === step && "is-on", i < step && "is-done")} aria-current={i === step ? "step" : undefined}>
            <span className="wiz-step-num">{i < step ? <AppIcon name="check" size={14} /> : i + 1}</span>
            <span className="wiz-step-label">{s}</span>
          </li>
        ))}
      </ol>
      <p className="wiz-count">
        Step {step + 1} of {STEPS.length}
      </p>

      <form
        className="wiz-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) next();
          else if (!busy) onCreate();
        }}
        noValidate
      >
        {step === 0 ? (
          <section className="wiz-section">
            <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
              Name your agent
            </h1>
            <label className="auth-field">
              <span className="lp-label">Agent name</span>
              <input
                className="lp-input"
                value={wizard.name}
                maxLength={120}
                placeholder="e.g. Maya"
                autoFocus
                aria-invalid={touchedName && !name ? true : undefined}
                aria-describedby={touchedName && !name ? "wiz-name-error" : undefined}
                onChange={(e) => setWizard({ name: e.target.value })}
                onBlur={() => setTouchedName(true)}
              />
            </label>
            {touchedName && !name ? (
              <p className="auth-error" id="wiz-name-error" role="alert">
                A name is required.
              </p>
            ) : null}
          </section>
        ) : null}

        {step === 1 ? (
          <section className="wiz-section">
            <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
              Pick a type
            </h1>
            <div className="type-grid" role="radiogroup" aria-label="Agent type">
              {AGENT_TYPES.map((t) => {
                const on = wizard.type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={css("type-card", on && "is-on")}
                    onClick={() => setWizard({ type: t.id })}
                  >
                    <span className="type-name">{t.label}</span>
                    {t.id === "custom" ? (
                      <span className="cap-none">Pick any capabilities</span>
                    ) : (
                      <CapChips caps={t.capabilities} empty="No capabilities" />
                    )}
                  </button>
                );
              })}
            </div>
            {wizard.type === "custom" ? (
              <fieldset className="cap-picks">
                <legend className="lp-label">Capabilities</legend>
                {CAPABILITIES.map((c) => {
                  const checked = wizard.capabilities.includes(c.id);
                  return (
                    <label key={c.id} className="cap-pick">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setWizard({
                            capabilities: checked ? wizard.capabilities.filter((x) => x !== c.id) : [...wizard.capabilities, c.id],
                          })
                        }
                      />
                      <span>{c.label}</span>
                      {!c.runs ? <span className="cap-soon">· soon</span> : null}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="wiz-section">
            <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
              Choose a look
            </h1>
            <div className="look-grid" role="radiogroup" aria-label="Appearance">
              {AGENT_CHARS.map((c, i) => {
                const on = (wizard.char ?? DEFAULT_CHAR) === i;
                return (
                  <button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={css("look-card", on && "is-on")}
                    onClick={() => setWizard({ char: i })}
                  >
                    <Image src={c.image} alt="" width={120} height={120} className="look-img" />
                    <span className="type-name">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="wiz-section">
            <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
              Settings
            </h1>
            {caps.includes("scrape") ? (
              <p className="wiz-note">
                <strong>Lead scraping:</strong> this agent searches the public web for leads. You tell it what to look for each time
                you start a search.
              </p>
            ) : null}
            {caps
              .filter((c) => !isEngineReady(c))
              .map((c) => (
                <p key={c} className="wiz-note is-soon">
                  <strong>{capabilityLabel(c)}:</strong> Coming soon. This agent keeps the capability and will use it once it launches.
                </p>
              ))}
            {books ? (
              <div className="wiz-field">
                <label className="auth-field">
                  <span className="lp-label">Meeting length</span>
                  <input
                    className="lp-input"
                    value={lengthText}
                    placeholder="30 minutes"
                    maxLength={60}
                    aria-invalid={lengthBad || undefined}
                    aria-describedby="wiz-length-help"
                    onChange={(e) => setLengthText(e.target.value)}
                  />
                </label>
                {lengthBad ? (
                  <p className="auth-error" id="wiz-length-help" role="alert">
                    {MEETING_LENGTH_ERROR}
                  </p>
                ) : (
                  <p className="wiz-help" id="wiz-length-help">
                    Between 5 minutes and 8 hours. Leave it empty for 30 minutes.
                    {minutes !== null ? ` Saved as ${minutes} minutes.` : ""}
                  </p>
                )}
              </div>
            ) : null}
            {!caps.includes("scrape") && !books && caps.every((c) => isEngineReady(c)) ? (
              <p className="wiz-note">Nothing to set up for this type. You can change settings later on the agent&apos;s page.</p>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="wiz-section">
            <h1 className="wiz-title" tabIndex={-1} ref={headRef}>
              Set a goal
            </h1>
            <label className="auth-field">
              <span className="lp-label">What should {name} achieve?</span>
              <textarea
                className="lp-input wiz-textarea"
                value={wizard.goal}
                maxLength={2000}
                rows={4}
                placeholder="e.g. Book 5 meetings a week with HR managers in Manila."
                onChange={(e) => setWizard({ goal: e.target.value })}
              />
            </label>
            <p className="wiz-help">
              Only the first sentence is saved.
              {firstSentence(wizard.goal) ? ` Saved goal: "${firstSentence(wizard.goal)}"` : ""}
            </p>
            <div className="wiz-summary">
              <AgentAvatar agent={{ id: "preview", char: wizard.char ?? DEFAULT_CHAR, color: AGENT_COLOR }} size={48} />
              <div>
                <div className="type-name">{name}</div>
                <div className="wiz-summary-caps">
                  {caps.length ? caps.map((c) => <CapChip key={c} cap={c} />) : <span className="cap-none">No capabilities</span>}
                </div>
              </div>
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="wiz-foot">
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => setWizard({ step: step - 1 })} disabled={busy}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button type="submit" className="btn btn-accent" disabled={!canContinue}>
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? "Creating…" : "Create agent"}
            </button>
          )}
        </div>
      </form>
    </WizardFrame>
  );
}

function WizardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="wiz">
      <header className="wiz-top">
        <span className="side-brand wiz-brand">
          <Image src="/logo-mark.png" alt="" width={28} height={28} />
          <span>Add new agent</span>
        </span>
        <Link href="/agents" className="icon-btn" aria-label="Close and go back to agents">
          <AppIcon name="x" size={20} />
        </Link>
      </header>
      <main className="wiz-main">{children}</main>
    </div>
  );
}
