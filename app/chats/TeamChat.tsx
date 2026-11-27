"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import CreateTeamButton from "@/components/CreateTeamButton";
import EmptyState from "@/components/EmptyState";
import { AgentAvatar } from "@/components/agents/AgentBits";
import { TeamIcon } from "@/components/teams/TeamBits";
import { visibleAgents } from "@/lib/agents/derive";
import { loadTeamChatLeads, type ChatLead } from "@/lib/chat/actions";
import {
  activeTrigger,
  cardsOf,
  firstName,
  pickChatTeam,
  pickedLeadIds,
  replaceRange,
  segmentText,
  speakerChanged,
  stripMarkers,
  tokenBefore,
  type ChatRow,
  type Trigger,
} from "@/lib/chat/thread";
import { css } from "@/lib/css";
import { useApp } from "@/lib/store";
import { membersOfTeam } from "@/lib/teams/membership";
import type { Agent, Team } from "@/lib/types";
import { useTeamChat } from "@/lib/useTeamChat";
import ApprovalButtons from "./ApprovalButtons";
import LeadPicker from "./LeadPicker";
import QuickReplies from "./QuickReplies";
import RunCard from "./RunCard";
import ScrapeQuestions from "./ScrapeQuestions";
import ScrapeResults from "./ScrapeResults";

// /chats: one team's thread (02-sitemap.md §6, 01-prd.md §7.4).
// The team: the one picked in Recent chats, else the team with the newest
// message, else the first team.
export default function TeamChat() {
  const { teams, chats, activeChatTeam, setActiveChatTeam } = useApp();
  const teamId = pickChatTeam(teams, chats, activeChatTeam);
  const team = teams.find((t) => t.id === teamId) ?? null;

  useEffect(() => {
    if (teamId && teamId !== activeChatTeam) setActiveChatTeam(teamId);
  }, [teamId, activeChatTeam, setActiveChatTeam]);

  if (!team) {
    return (
      <div className="page">
        <EmptyState
          icon="chat"
          title="No conversations yet"
          text="Chats happen with a team. Create one to get started."
          action={<CreateTeamButton label="Create a team" />}
        />
      </div>
    );
  }
  return <TeamThread key={team.id} team={team} />;
}

const NEAR_BOTTOM_PX = 120;

function TeamThread({ team }: { team: Team }) {
  const { agents, states, config, teamMembers } = useApp();
  const chat = useTeamChat(team.id);
  const all = useMemo(() => visibleAgents(agents, states, config), [agents, states, config]);
  const members = membersOfTeam(team, teamMembers, states)
    .map((id) => all.find((a) => a.id === id))
    .filter((a): a is Agent => !!a);
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const mentionable = useMemo(() => all.flatMap((a) => [firstName(a.name), a.name.replace(/\s+/g, "")]), [all]);

  // ---- Autoscroll: stick to the bottom only for new messages, when I just
  // sent, or when I am within 120 px of the bottom.
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastSent = useRef(chat.sentTick);
  const firstScroll = useRef(true);
  const count = chat.rows.length;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const justSent = chat.sentTick !== lastSent.current;
    lastSent.current = chat.sentTick;
    if (firstScroll.current || justSent || nearBottom.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current || reduce ? "auto" : "smooth" });
      nearBottom.current = true;
    }
    firstScroll.current = false;
  }, [count, chat.typing, chat.sentTick, chat.busy]);

  // Who the dots name while the team thinks: the @mentioned member, else the
  // last agent who spoke, else the first member.
  const guess = useMemo(() => {
    const lastMine = [...chat.rows].reverse().find((r) => r.who === "me");
    const at = lastMine ? /@([\p{L}\p{N}_'-]+)/u.exec(lastMine.text)?.[1]?.toLowerCase() : undefined;
    const named = at ? members.find((m) => firstName(m.name).toLowerCase() === at || m.name.replace(/\s+/g, "").toLowerCase() === at) : undefined;
    if (named) return named;
    const lastAgent = [...chat.rows].reverse().find((r) => byId.has(r.who));
    return (lastAgent && byId.get(lastAgent.who)) || members[0];
  }, [chat.rows, members, byId]);
  const typingAgent = chat.typing === null ? null : chat.typing ? byId.get(chat.typing) ?? null : guess ?? null;

  const last = chat.rows[chat.rows.length - 1];
  const showCards = !!last && last.who !== "me" && !chat.busy;
  const send = (text: string, leadIds?: string[]) => void chat.sendTeamChat(text, leadIds);

  return (
    <div className="chat-page">
      <ChatHeader team={team} members={members} onClear={chat.clearChat} />

      <div
        className="chat-scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        }}
      >
        <div className="chat-thread" role="log" aria-live="polite" aria-relevant="additions" aria-label={`${team.name} chat`}>
          {chat.rows.length === 0 && chat.ready ? (
            <p className="chat-empty">No messages yet. Say hello to {team.name}, or ask for something.</p>
          ) : null}
          {chat.rows.map((r, i) => (
            <MessageRow
              key={r.id}
              row={r}
              prev={chat.rows[i - 1]}
              agent={byId.get(r.who)}
              mentionable={mentionable}
            />
          ))}
        </div>
        {showCards && last ? (
          <Cards
            row={last}
            teamId={team.id}
            pendingIds={chat.pendingIds}
            disabled={chat.busy}
            onSend={send}
            onDecide={chat.decide}
          />
        ) : null}
        {chat.typing !== null ? <TypingDots agent={typingAgent} /> : null}
      </div>

      <Composer teamId={team.id} members={members} busy={chat.busy} onSend={send} />
    </div>
  );
}

function ChatHeader({ team, members, onClear }: { team: Team; members: Agent[]; onClear: () => Promise<boolean> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const names = members.map((m) => firstName(m.name)).join(", ");

  async function clear() {
    setBusy(true);
    const ok = await onClear();
    setBusy(false);
    if (ok) setConfirm(false);
  }

  return (
    <header className="chat-head">
      <TeamIcon icon={team.icon} size={40} />
      <div className="chat-head-id">
        <h1 className="chat-head-name">{team.name}</h1>
        <p className="chat-head-members">{names || "No members yet"}</p>
      </div>
      {members.length ? (
        <span className="chat-head-avatars" aria-hidden="true">
          {members.slice(0, 5).map((m) => (
            <AgentAvatar key={m.id} agent={m} size={28} />
          ))}
        </span>
      ) : null}
      <div className="chat-head-actions">
        {confirm ? (
          <>
            <span className="team-confirm-text">Clear this chat?</span>
            <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={clear}>
              Clear
            </button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setConfirm(true)}>
            Clear chat
          </button>
        )}
      </div>
    </header>
  );
}

function InfoIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function MessageRow({ row, prev, agent, mentionable }: { row: ChatRow; prev?: ChatRow; agent?: Agent; mentionable: string[] }) {
  const text = stripMarkers(row.text);
  if (row.who === "system") {
    if (!text) return null;
    return (
      <div className={css("chat-system", row.error && "is-error")}>
        <InfoIcon />
        <span>
          <RichText text={text} mentionable={mentionable} links />
        </span>
      </div>
    );
  }
  if (row.who === "me") {
    if (!text) return null;
    return (
      <div className="chat-row is-me">
        <span className="sr-only">You: </span>
        <div className="chat-bubble is-me">
          <RichText text={text} mentionable={mentionable} links={false} />
        </div>
      </div>
    );
  }
  const head = speakerChanged(prev, row);
  const name = agent?.name ?? "Former agent";
  return (
    <div className={css("chat-row is-agent", head && "is-first")}>
      <span className="chat-avatar-slot">{head && agent ? <AgentAvatar agent={agent} size={32} /> : null}</span>
      <div className="chat-agent-body">
        {head ? <div className="chat-name">{name}</div> : <span className="sr-only">{name}: </span>}
        {text ? (
          <div className="chat-bubble">
            <RichText text={text} mentionable={mentionable} links />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RichText({ text, mentionable, links }: { text: string; mentionable: string[]; links: boolean }) {
  const parts = segmentText(text, mentionable, links);
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === "lead")
          return (
            <span key={i} className="chat-lead-pill">
              {p.text}
            </span>
          );
        if (p.t === "mention")
          return (
            <span key={i} className="chat-mention">
              {p.text}
            </span>
          );
        if (p.t === "link")
          return (
            <Link key={i} href={p.href} className="chat-link">
              {p.text}
            </Link>
          );
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

function Cards({
  row,
  teamId,
  pendingIds,
  disabled,
  onSend,
  onDecide,
}: {
  row: ChatRow;
  teamId: string;
  pendingIds: Set<string> | null;
  disabled: boolean;
  onSend: (text: string) => void;
  onDecide: (jobId: string, proceed: boolean) => Promise<void>;
}) {
  const c = cardsOf(row.text);
  const approveOpen = !!c.approve && (pendingIds === null || pendingIds.has(c.approve));
  return (
    <div className="chat-cards">
      {c.run ? <RunCard jobId={c.run} /> : null}
      {c.leads.length ? <ScrapeResults teamId={teamId} ids={c.leads} /> : null}
      {c.scrape ? <ScrapeQuestions card={c.scrape} disabled={disabled} onSend={onSend} /> : null}
      {c.writepick ? <LeadPicker pick={c.writepick} disabled={disabled} onSend={onSend} /> : null}
      {approveOpen && c.approve ? <ApprovalButtons jobId={c.approve} disabled={disabled} onDecide={onDecide} /> : null}
      {c.replies.length ? <QuickReplies replies={c.replies} disabled={disabled} onSend={onSend} /> : null}
    </div>
  );
}

function TypingDots({ agent }: { agent: Agent | null }) {
  const label = agent ? `${firstName(agent.name)} is typing` : "Typing";
  return (
    <div className="chat-row is-agent chat-typing" role="status">
      <span className="chat-avatar-slot">{agent ? <AgentAvatar agent={agent} size={32} /> : null}</span>
      <div className="chat-agent-body">
        <div className="chat-name">{label}</div>
        <div className="chat-bubble chat-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

// ---- Composer with the @ list (≤ 5 members) and the /lead list (≤ 6 leads) ----

type Option = { key: string; label: string; sub?: string; tone?: "accepted" | "pending"; insert: string; lead?: { id: string; name: string } };

function Composer({ teamId, members, busy, onSend }: { teamId: string; members: Agent[]; busy: boolean; onSend: (text: string, leadIds?: string[]) => void }) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [leads, setLeads] = useState<ChatLead[] | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const nextCaret = useRef<number | null>(null);

  const trigger: Trigger | null = closedAt === text ? null : activeTrigger(text, caret);

  // The /lead list loads the team's leads the first time it opens.
  useEffect(() => {
    if (trigger?.kind !== "lead" || leads) return;
    let alive = true;
    loadTeamChatLeads(teamId)
      .then((l) => {
        if (alive) setLeads(l);
      })
      .catch(() => {
        if (alive) setLeads([]);
      });
    return () => {
      alive = false;
    };
  }, [trigger?.kind, leads, teamId]);

  useLayoutEffect(() => {
    if (nextCaret.current == null || !input.current) return;
    input.current.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  });

  const options: Option[] = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (trigger.kind === "mention") {
      return members
        .filter((m) => !q || firstName(m.name).toLowerCase().startsWith(q) || m.name.toLowerCase().startsWith(q))
        .slice(0, 5)
        .map((m) => ({ key: m.id, label: m.name, sub: m.role, insert: `@${firstName(m.name)} ` }));
    }
    return (leads ?? [])
      .filter((l) => l.review !== "dismissed")
      .filter((l) => !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q))
      .slice(0, 6)
      .map((l) => ({
        key: l.id,
        label: l.name,
        sub: l.company,
        tone: l.review === "accepted" ? ("accepted" as const) : ("pending" as const),
        insert: `«${l.name}» `,
        lead: { id: l.id, name: l.name },
      }));
  }, [trigger, members, leads]);
  const open = !!trigger && (options.length > 0 || (trigger.kind === "lead" && leads !== null));
  const activeIdx = Math.min(active, Math.max(0, options.length - 1));

  function update(value: string, pos: number) {
    setText(value);
    setCaret(pos);
    setActive(0);
  }

  function choose(o: Option) {
    if (!trigger) return;
    const r = replaceRange(text, trigger.start, caret, o.insert);
    if (o.lead) {
      const lead = o.lead;
      setPicked((cur) => (cur.some((p) => p.id === lead.id) ? cur : [...cur, lead]));
    }
    nextCaret.current = r.caret;
    update(r.text, r.caret);
    input.current?.focus();
  }

  function submit() {
    const msg = text.trim();
    if (!msg || busy) return;
    onSend(msg, pickedLeadIds(msg, picked));
    setText("");
    setCaret(0);
    setPicked([]);
    setClosedAt(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && options.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((activeIdx + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((activeIdx - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(options[activeIdx]);
        return;
      }
    }
    if (open && e.key === "Escape") {
      e.preventDefault();
      setClosedAt(text);
      return;
    }
    if (e.key === "Backspace") {
      const el = e.currentTarget;
      if (el.selectionStart === el.selectionEnd) {
        const start = tokenBefore(text, el.selectionStart);
        if (start >= 0) {
          e.preventDefault();
          const r = replaceRange(text, start, el.selectionStart, "");
          nextCaret.current = r.caret;
          update(r.text, r.caret);
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const listId = `chat-pick-${teamId}`;
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {open ? (
        <div className="menu chat-popup" id={listId} role="listbox" aria-label={trigger?.kind === "lead" ? "Leads" : "Team members"}>
          {options.length ? (
            options.map((o, i) => (
              <div
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                className={css("menu-item chat-option", i === activeIdx && "is-active")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                <span className="chat-option-name">{o.label}</span>
                {o.sub ? <span className="menu-meta">{o.sub}</span> : null}
                {o.tone ? <span className={css("review-chip", `is-${o.tone}`)}>{o.tone === "accepted" ? "Accepted" : "Pending"}</span> : null}
              </div>
            ))
          ) : (
            <p className="menu-empty">No leads match.</p>
          )}
        </div>
      ) : null}
      <textarea
        ref={input}
        className="chat-input"
        rows={1}
        value={text}
        placeholder="Message the team. Use @mention for an agent and /lead to pick leads…"
        aria-label="Message the team"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && options.length ? `${listId}-${activeIdx}` : undefined}
        onChange={(e) => update(e.target.value, e.target.selectionStart)}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
      />
      <button type="submit" className="btn btn-accent chat-send" disabled={busy || !text.trim()}>
        Send
      </button>
    </form>
  );
}
