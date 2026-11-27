"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";
import EmptyState from "@/components/EmptyState";
import { AgentAvatar } from "@/components/agents/AgentBits";
import { visibleAgents } from "@/lib/agents/derive";
import type { PendingApproval } from "@/lib/chat/contract";
import { firstName } from "@/lib/chat/thread";
import { css } from "@/lib/css";
import { listPendingApprovals } from "@/lib/pod/actions";
import { useApp } from "@/lib/store";
import { teamsOfAgent } from "@/lib/teams/membership";
import type { Agent } from "@/lib/types";
import { useDismiss } from "@/lib/useDismiss";
import { queueChatSend } from "@/lib/useTeamChat";

// Chat home "/" (02-sitemap.md §6): pick an agent, say what to do, and the
// message goes to that agent's team as "@{First} {message}".
const STARTERS = [
  { text: "Find 25 finance leads in Texas", cap: "scrape" },
  { text: "Draft emails for my ready leads", cap: "outreach" },
  { text: "Score my newest leads", cap: "qualify" },
  { text: "Book meetings with my hot leads", cap: "book-meeting" },
];

const TIPS = [
  "Type @ and a name in a team chat to ask one agent directly.",
  "Type /lead in a team chat to pick leads by name.",
  "Switch a step to Auto on an agent's page, and it runs without asking you first.",
];

const SLIDE_MS = 6000;
const OPEN_TEAM_MODAL_AFTER_MS = 1500;

export default function ChatHome() {
  const { agents, states, config, teams, teamMembers, openTeamModal, setActiveChatTeam } = useApp();
  const router = useRouter();
  const all = useMemo(() => visibleAgents(agents, states, config), [agents, states, config]);
  const onTeam = (a: Agent) => teamsOfAgent(a.id, teams, teamMembers, states).length > 0;
  const [agentId, setAgentId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const modalTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(modalTimer.current), []);

  const agent = all.find((a) => a.id === agentId) ?? all.find(onTeam) ?? all[0] ?? null;

  if (!agent) {
    return (
      <div className="page">
        <EmptyState
          icon="bot"
          title="Hire your first agent"
          text="Agents research leads, write first emails and follow up. Nothing goes out until you approve it."
          action={
            <Link href="/create" className="btn btn-accent">
              Add an agent
            </Link>
          }
        />
      </div>
    );
  }
  const first = firstName(agent.name);

  function send() {
    const msg = text.trim();
    if (!msg || !agent) return;
    const team = teamsOfAgent(agent.id, teams, teamMembers, states)[0];
    if (!team) {
      setError(`${first} isn't on a team yet. Add them to one to chat.`);
      window.clearTimeout(modalTimer.current);
      const id = agent.id;
      modalTimer.current = window.setTimeout(() => openTeamModal({ members: [id] }), OPEN_TEAM_MODAL_AFTER_MS);
      return;
    }
    setError("");
    queueChatSend(team.id, `@${first} ${msg}`);
    setActiveChatTeam(team.id);
    router.push("/chats");
  }

  function pickStarter(s: (typeof STARTERS)[number]) {
    if (!agent?.capabilities.includes(s.cap)) {
      const fit = all.find((a) => a.capabilities.includes(s.cap) && onTeam(a)) ?? all.find((a) => a.capabilities.includes(s.cap));
      if (fit) setAgentId(fit.id);
    }
    setText(s.text);
    setError("");
    input.current?.focus();
  }

  return (
    <div className="page home-chat">
      <h1 className="home-chat-title">What should your team work on?</h1>

      <form
        className="home-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          className="home-input"
          rows={2}
          value={text}
          maxLength={2000}
          placeholder={`What should ${first} do?`}
          aria-label={`What should ${first} do?`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "home-error" : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="home-composer-bar">
          <AgentPicker agents={all} value={agent} onPick={(a) => setAgentId(a.id)} />
          <button type="submit" className="btn btn-accent" disabled={!text.trim()}>
            Send
          </button>
        </div>
      </form>
      {error ? (
        <p className="auth-error home-error" id="home-error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="home-starters" aria-label="Ideas to start with">
        {STARTERS.map((s) => (
          <li key={s.text}>
            <button type="button" className="home-starter" onClick={() => pickStarter(s)}>
              {s.text}
            </button>
          </li>
        ))}
      </ul>

      <Carousel
        onOpenTeam={(teamId) => {
          setActiveChatTeam(teamId);
          router.push("/chats");
        }}
      />
    </div>
  );
}

function AgentPicker({ agents, value, onPick }: { agents: Agent[]; value: Agent; onPick: (a: Agent) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="btn btn-sm home-agent-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ask an agent: ${value.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <AgentAvatar agent={value} size={22} />
        <span>{value.name}</span>
        <AppIcon name="chevron-down" size={16} />
      </button>
      {open ? (
        <div className="menu home-agent-menu" role="menu" aria-label="Ask an agent">
          <div className="menu-heading">Ask an agent</div>
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              className={css("menu-item", a.id === value.id && "is-active")}
              onClick={() => {
                onPick(a);
                setOpen(false);
              }}
            >
              <AgentAvatar agent={a} size={24} />
              <span className="side-ellipsis">{a.name}</span>
              <span className="menu-meta">{a.role}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Slide = { key: string; text: string; teamId?: string };

// One slide per team with waiting approvals, else 3 fixed tips. Moves on
// every 6 s and pauses while the pointer or focus is on it.
function Carousel({ onOpenTeam }: { onOpenTeam: (teamId: string) => void }) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    listPendingApprovals()
      .then((list) => {
        if (alive) setApprovals(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const slides: Slide[] = useMemo(() => {
    const byTeam = new Map<string, { name: string; n: number }>();
    for (const a of approvals) {
      const cur = byTeam.get(a.teamId);
      byTeam.set(a.teamId, { name: a.teamName, n: (cur?.n ?? 0) + 1 });
    }
    if (!byTeam.size) return TIPS.map((t, i) => ({ key: `tip${i}`, text: t }));
    return [...byTeam.entries()].map(([teamId, v]) => ({
      key: teamId,
      teamId,
      text: `${v.n} ${v.n === 1 ? "approval" : "approvals"} waiting in ${v.name}`,
    }));
  }, [approvals]);

  const count = slides.length;
  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [paused, count]);

  const cur = slides[index % count];
  return (
    <section
      className="home-carousel"
      aria-roledescription="carousel"
      aria-label={approvals.length ? "Approvals waiting" : "Tips"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="home-slide" aria-live={paused ? "polite" : "off"} aria-roledescription="slide">
        {cur.teamId ? (
          <button type="button" className="home-slide-btn is-approval" onClick={() => onOpenTeam(cur.teamId as string)}>
            <span className="home-slide-dot" aria-hidden="true" />
            <span>{cur.text}</span>
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <p className="home-slide-tip">{cur.text}</p>
        )}
      </div>
      {count > 1 ? (
        <div className="home-dots">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={css("home-dot", i === index % count && "is-on")}
              aria-label={`Show slide ${i + 1} of ${count}`}
              aria-current={i === index % count ? "true" : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
