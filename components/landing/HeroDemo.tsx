"use client";

import Image from "next/image";
import { Fragment, useEffect, useState } from "react";
import { HERO_LOOP_MS, HERO_SCRIPT, beatsVisibleAt, type AgentKey } from "@/lib/landing";
import Icon from "./Icon";
import { AGENTS, AGENT_ORDER } from "./content";

const TIMELINE = [
  { label: "Plan the search", meta: "3 queries" },
  { label: "Search the web", meta: "9 sources" },
  { label: "Check each source", meta: "3 dropped" },
  { label: "Pick out leads", meta: "12 found" },
  { label: "Save", meta: "12 new leads saved" },
];

// Mentions like "@Pat" get a lime highlight.
function withMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="demo-mention">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Avatar({ agent }: { agent: AgentKey }) {
  return <Image className="demo-avatar" src={`/agents/${agent}.jpg`} alt="" width={32} height={32} />;
}

export default function HeroDemo({ play, reduced }: { play: boolean; reduced: boolean }) {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!play || reduced) return;
    const start = performance.now();
    const id = window.setInterval(() => setT((performance.now() - start) % HERO_LOOP_MS), 100);
    return () => window.clearInterval(id);
  }, [play, reduced]);

  const now = reduced ? Number.MAX_SAFE_INTEGER : t;
  const visible = HERO_SCRIPT.slice(0, beatsVisibleAt(now));
  const next = HERO_SCRIPT[visible.length];
  const typing = next && next.kind === "agent" && next.at - now < 900 ? next.agent : null;

  const timelineBeat = HERO_SCRIPT.find((b) => b.kind === "timeline")!;
  const stepsDone = Math.min(TIMELINE.length, Math.floor((now - timelineBeat.at) / 650));
  const approvalBeat = HERO_SCRIPT.find((b) => b.kind === "approval")!;
  const pressed = now - approvalBeat.at > 1500;

  return (
    <div className="demo" aria-label="A short demo of the agents at work in a team chat">
      <div className="demo-bar">
        <div className="demo-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="demo-title">Outbound team</span>
        <span className="lp-label lp-label-muted">4 agents</span>
        <div className="demo-members" aria-hidden="true">
          {AGENT_ORDER.map((a) => (
            <Image key={a} src={`/agents/${a}.jpg`} alt="" width={24} height={24} />
          ))}
        </div>
      </div>
      <div className="demo-body" aria-live="off">
        {visible.map((beat, i) => {
          if (beat.kind === "user") {
            return (
              <div key={i} className="demo-row me">
                <div className="demo-bubble">{beat.text}</div>
              </div>
            );
          }
          if (beat.kind === "agent") {
            return (
              <div key={i} className="demo-row">
                <Avatar agent={beat.agent} />
                <div className="demo-bubble">
                  <span className="demo-name">{AGENTS[beat.agent].name}</span>
                  {withMentions(beat.text)}
                </div>
              </div>
            );
          }
          if (beat.kind === "timeline") {
            if (now >= approvalBeat.at) {
              return (
                <div key={i} className="demo-card">
                  <span className="demo-step is-done">
                    <span className="demo-step-dot">
                      <Icon name="check" />
                    </span>
                    <span>9 sources · 3 dropped · 12 leads</span>
                  </span>
                </div>
              );
            }
            return (
              <div key={i} className="demo-card">
                <span className="lp-label">Theo is searching</span>
                <ul className="demo-steps">
                  {TIMELINE.map((s, j) => {
                    const state = j < stepsDone ? "is-done" : j === stepsDone ? "is-active" : "is-waiting";
                    return (
                      <li key={s.label} className={`demo-step ${state}`}>
                        <span className="demo-step-dot">{j < stepsDone ? <Icon name="check" /> : null}</span>
                        <span>{s.label}</span>
                        {j < stepsDone ? <span className="demo-step-meta">{s.meta}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          }
          return (
            <div key={i} className="demo-card">
              <span className="lp-label">{AGENTS[beat.agent].name} is waiting for you</span>
              <p className="lp-body" style={{ marginTop: 6 }}>
                {beat.text}
              </p>
              <div className="demo-actions">
                <span className={`btn${pressed ? " is-pressed" : ""}`}>
                  {pressed ? <Icon name="check" /> : null}
                  Proceed
                </span>
                <span className="btn">Cancel</span>
              </div>
            </div>
          );
        })}
        {typing ? (
          <div className="demo-row">
            <Avatar agent={typing} />
            <div className="demo-bubble demo-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>
      <div className="demo-composer" aria-hidden="true">
        <span>Message your team, or type @ to pick an agent</span>
        <Icon name="send" />
      </div>
    </div>
  );
}
