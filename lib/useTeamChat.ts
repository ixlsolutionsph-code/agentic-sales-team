"use client";

// The team chat on the client (01-prd.md §7.4, 05-build-guide.md M9):
// sending with pacing, the 4000 ms thread poll (plus pending approvals),
// following queued jobs, Clear chat, and the unread counts of Recent chats.
import { useCallback, useEffect, useRef, useState } from "react";
import { callAction } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { clearChat as clearChatAction, loadChatUnread, loadThread, teamChat } from "@/lib/chat/actions";
import type { ChatResult, FollowJob, PendingApproval } from "@/lib/chat/contract";
import { revealStep, PACE } from "@/lib/chat/pace";
import { LOCAL_ERROR, STILL_WORKING, lastStoredId, markSeen, mergeThread, runIdsOf, type ChatRow } from "@/lib/chat/thread";
import { loadTasks } from "@/lib/jobs/actions";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { approveJob, listPendingApprovals, rejectJob } from "@/lib/pod/actions";
import { useApp } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

const THREAD_POLL_MS = 4000;
const UNREAD_POLL_MS = 10_000;
const FOLLOW_FAST_MS = 2500;
const FOLLOW_SLOW_MS = 15_000;
const FOLLOW_TRIES = 40;
const ENDED = new Set(["done", "failed", "dismissed", "needs_approval"]);

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, Math.max(0, ms)));

// ---- Runners ----

async function post(url: string, body?: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // The job stays queued; a later call or the cron runs it.
  }
}

// Asks the server to run a queued job now: a search goes to /api/scrape
// first, then /api/jobs/run picks up what the chain queued after it.
export async function kickJob(job: FollowJob): Promise<void> {
  if (job.kind === "scrape") await post("/api/scrape", { jobId: job.jobId });
  await post("/api/jobs/run");
}

// ---- Last-seen ids (per workspace, in this browser) ----

export const CHAT_SEEN_EVENT = "app:chat-seen";
export const CHAT_CLEARED_EVENT = "app:chat-cleared";
const seenKey = (ws: string) => `ast.chatSeen.${ws}`;

export function readSeen(ws: string): Record<string, number> | null {
  try {
    const raw = window.localStorage.getItem(seenKey(ws));
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === "number" && n > 0) out[k] = n;
    return out;
  } catch {
    return null;
  }
}

function writeSeen(ws: string, seen: Record<string, number>): void {
  try {
    window.localStorage.setItem(seenKey(ws), JSON.stringify(seen));
  } catch {
    // Storage full or blocked: counts just stay as they are.
  }
}

export function noteSeen(ws: string, teamId: string, id: number): void {
  const cur = readSeen(ws) ?? {};
  const next = markSeen(cur, teamId, id);
  if (next === cur) return;
  writeSeen(ws, next);
  window.dispatchEvent(new CustomEvent(CHAT_SEEN_EVENT, { detail: teamId }));
}

// ---- Chat home → /chats hand-over ----

// Chat home queues the message here and opens /chats, so the team chat sends
// it with the typing dots and the 2 s pacing.
let pendingSend: { teamId: string; text: string } | null = null;
export function queueChatSend(teamId: string, text: string): void {
  pendingSend = { teamId, text };
}
function takePendingSend(teamId: string): string | null {
  if (!pendingSend || pendingSend.teamId !== teamId) return null;
  const t = pendingSend.text;
  pendingSend = null;
  return t;
}

// ---- The hook ----

export function useTeamChat(teamId: string) {
  const { chats, setChatThread, user, showToast } = useApp();
  const ws = user?.workspaceId ?? "";
  const [rows, setRows] = useState<ChatRow[]>(() => chats[teamId] ?? []);
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingApproval[] | null>(null);
  const [sentTick, setSentTick] = useState(0);
  const [ready, setReady] = useState(false);

  const alive = useRef(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const known = useRef(new Set<number>((chats[teamId] ?? []).map((m) => m.id)));
  const cursor = useRef(lastStoredId(chats[teamId] ?? []));
  const queue = useRef<ChatMessage[]>([]);
  const running = useRef(false);
  const notBefore = useRef(0);
  const dotsUp = useRef(false);
  const dotsSince = useRef(0);
  const live = useRef(false);
  const followed = useRef(new Set<string>());
  const localId = useRef(0);
  const pulling = useRef<Promise<void> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Keep the store's copy (used for "the team with the newest message").
  useEffect(() => {
    setChatThread(
      teamId,
      rows.filter((r) => !r.local),
    );
  }, [rows, teamId, setChatThread]);

  // Everything visible counts as seen while the tab is open.
  useEffect(() => {
    if (!ws) return;
    const mark = () => {
      if (document.visibilityState === "visible") noteSeen(ws, teamId, lastStoredId(rowsRef.current));
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [rows, ws, teamId]);

  const lastVisibleWho = () => {
    const list = rowsRef.current;
    return list.length ? list[list.length - 1].who : null;
  };

  // Shows queued replies one at a time behind typing dots.
  const runQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (alive.current && queue.current.length) {
      const m = queue.current[0];
      const step = revealStep(lastVisibleWho(), m.who, Date.now(), notBefore.current);
      if (dotsUp.current) {
        // The dots are already up (the team was thinking): no second pause.
        setTyping(m.who);
        await sleep(Math.max(step.typingMs - (Date.now() - dotsSince.current), notBefore.current - Date.now()));
      } else {
        await sleep(step.pauseMs);
        if (!alive.current) break;
        setTyping(m.who);
        dotsUp.current = true;
        dotsSince.current = Date.now();
        await sleep(Math.max(step.typingMs, notBefore.current - Date.now()));
      }
      queue.current.shift();
      rowsRef.current = mergeThread(rowsRef.current, [m]);
      setRows(rowsRef.current);
      notBefore.current = 0;
      dotsUp.current = false;
      setTyping(null);
    }
    running.current = false;
  }, []);

  const followRef = useRef<(job: FollowJob) => void>(() => {});

  // Adds stored messages. Paced: agent rows wait in the reveal queue.
  const ingest = useCallback(
    (list: ChatMessage[], paced: boolean) => {
      const fresh = list.filter((m) => !known.current.has(m.id));
      if (!fresh.length) return;
      for (const m of fresh) {
        known.current.add(m.id);
        if (m.id > cursor.current) cursor.current = m.id;
      }
      if (!paced) {
        rowsRef.current = mergeThread(rowsRef.current, fresh);
        setRows(rowsRef.current);
        return;
      }
      const mine = fresh.filter((m) => m.who === "me");
      const others = fresh.filter((m) => m.who !== "me");
      if (mine.length) {
        rowsRef.current = mergeThread(rowsRef.current, mine);
        setRows(rowsRef.current);
      }
      if (others.length) {
        queue.current.push(...others);
        void runQueue();
        for (const id of runIdsOf(others)) followRef.current({ jobId: id, kind: "" });
      }
    },
    [runQueue],
  );

  const refreshPending = useCallback(async () => {
    const p = await listPendingApprovals(teamId).catch(() => null);
    if (alive.current && p) setPending(p);
  }, [teamId]);

  const pullThread = useCallback(async () => {
    if (pulling.current) return pulling.current;
    const run = (async () => {
      const list = await loadThread(teamId, cursor.current).catch(() => null);
      if (!alive.current) return;
      if (list) ingest(list, live.current);
      live.current = true;
      await refreshPending();
    })();
    pulling.current = run;
    try {
      await run;
    } finally {
      pulling.current = null;
    }
  }, [teamId, ingest, refreshPending]);

  const addLocal = useCallback((who: string, text: string, error = false) => {
    localId.current += 1;
    const row: ChatRow = { id: -localId.current, who, text, createdAt: new Date().toISOString(), local: true, error };
    rowsRef.current = [...rowsRef.current, row];
    setRows(rowsRef.current);
  }, []);

  // Kicks the runner for a job and polls it: every 2.5 s × 40, then posts the
  // "Still working…" line and polls every 15 s × 40.
  const followJob = useCallback(
    (job: FollowJob) => {
      if (!job.jobId || followed.current.has(job.jobId)) return;
      followed.current.add(job.jobId);
      void (async () => {
        let kind = job.kind;
        const status = async () => (await loadTasks([job.jobId]).catch(() => []))[0] ?? null;
        if (!kind) {
          const t = await status();
          if (!t || ENDED.has(t.status)) return;
          kind = t.kind;
        }
        void kickJob({ jobId: job.jobId, kind });
        for (const [every, tries] of [
          [FOLLOW_FAST_MS, FOLLOW_TRIES],
          [FOLLOW_SLOW_MS, FOLLOW_TRIES],
        ] as const) {
          for (let i = 0; i < tries; i++) {
            await sleep(every);
            if (!alive.current) return;
            const t = await status();
            if (!t || ENDED.has(t.status)) {
              // The chain may have queued the next step: run it, then show the result.
              if (t?.status === "done") void post("/api/jobs/run");
              await pullThread();
              refreshNavCounts();
              return;
            }
          }
          if (every === FOLLOW_FAST_MS && alive.current) addLocal("system", STILL_WORKING);
        }
      })();
    },
    [pullThread, addLocal],
  );
  followRef.current = followJob;

  const takeResult = useCallback(
    (res: { ok: true; data?: ChatResult } | { ok: false; error: string }, onError: (e: string) => void) => {
      if (res.ok && res.data) {
        ingest(res.data.messages, true);
        for (const j of res.data.follow) followJob(j);
        void refreshPending();
      } else onError(res.ok ? LOCAL_ERROR : res.error);
    },
    [ingest, followJob, refreshPending],
  );

  const sendTeamChat = useCallback(
    async (text: string, leadIds?: string[]) => {
      const msg = text.trim();
      if (!msg) return;
      addLocal("me", msg);
      setSentTick((n) => n + 1);
      notBefore.current = Date.now() + PACE.firstReplyMinMs;
      setBusy(true);
      // The dots come up after the usual pause while the team thinks.
      const dots = window.setTimeout(() => {
        dotsUp.current = true;
        dotsSince.current = Date.now();
        setTyping((cur) => cur ?? "");
      }, PACE.pauseNewMs);
      let tz: string | undefined;
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        tz = undefined;
      }
      const res = await callAction(() => teamChat(teamId, msg, leadIds?.length ? leadIds : undefined, tz));
      window.clearTimeout(dots);
      if (!alive.current) return;
      setBusy(false);
      takeResult(res, async (error) => {
        // Wait out the pacing so the error does not flash up at once.
        await sleep(notBefore.current - Date.now());
        if (!alive.current) return;
        dotsUp.current = false;
        setTyping(null);
        addLocal("system", error && error !== MSG.serverDown ? error : LOCAL_ERROR, true);
      });
      if (!res.ok) return;
      if (!queue.current.length) {
        dotsUp.current = false;
        setTyping(null);
      }
    },
    [teamId, addLocal, takeResult],
  );

  // Proceed / Cancel on a waiting step.
  const decide = useCallback(
    async (jobId: string, proceed: boolean) => {
      setBusy(true);
      const res = await callAction(() => (proceed ? approveJob(jobId) : rejectJob(jobId)));
      if (!alive.current) return;
      setBusy(false);
      takeResult(res, (error) => showToast(error, true));
    },
    [takeResult, showToast],
  );

  const reset = useCallback(() => {
    queue.current = [];
    known.current = new Set();
    rowsRef.current = [];
    setRows([]);
    setTyping(null);
    dotsUp.current = false;
    setPending([]);
  }, []);

  const clearChat = useCallback(async () => {
    const res = await callAction(() => clearChatAction(teamId));
    if (!alive.current) return false;
    if (!res.ok) {
      showToast(res.error, true);
      return false;
    }
    reset();
    window.dispatchEvent(new CustomEvent(CHAT_CLEARED_EVENT, { detail: teamId }));
    return true;
  }, [teamId, reset, showToast]);

  // Cleared from the sidebar.
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail === teamId) reset();
    };
    window.addEventListener(CHAT_CLEARED_EVENT, on);
    return () => window.removeEventListener(CHAT_CLEARED_EVENT, on);
  }, [teamId, reset]);

  // First load (no delay), then a message queued by chat home, then the poll.
  useEffect(() => {
    let timer: number | undefined;
    let stop = false;
    const loop = async () => {
      await pullThread();
      if (stop) return;
      timer = window.setTimeout(loop, THREAD_POLL_MS);
    };
    void (async () => {
      await pullThread();
      if (stop) return;
      setReady(true);
      const queued = takePendingSend(teamId);
      if (queued) void sendTeamChat(queued);
      timer = window.setTimeout(loop, THREAD_POLL_MS);
    })();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
    // Runs once per team (the component is keyed by team).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const pendingIds = pending ? new Set(pending.map((p) => p.jobId)) : null;
  const queued = queue.current.length > 0;

  return {
    rows,
    typing,
    busy: busy || queued || typing !== null,
    ready,
    pendingIds,
    sentTick,
    sendTeamChat,
    pullThread,
    followJob,
    decide,
    clearChat,
  };
}

// ---- Unread counts for Recent chats ----

// Unread agent messages per team, polled every 10 s, and again when a chat is
// read. The first time in a workspace, everything already loaded counts as seen.
export function useChatUnread(): Record<string, number> {
  const { user, chats } = useApp();
  const ws = user?.workspaceId ?? "";
  const [counts, setCounts] = useState<Record<string, number>>({});
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  useEffect(() => {
    if (!ws) return;
    if (readSeen(ws) == null) {
      const seed: Record<string, number> = {};
      for (const [k, list] of Object.entries(chatsRef.current)) {
        const id = lastStoredId(list);
        if (id > 0) seed[k] = id;
      }
      writeSeen(ws, seed);
    }
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      const c = await loadChatUnread(readSeen(ws) ?? {}).catch(() => null);
      if (alive && c) setCounts(c);
    };
    const loop = async () => {
      await load();
      if (alive) timer = window.setTimeout(loop, UNREAD_POLL_MS);
    };
    void loop();
    const onSeen = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      setCounts((cur) => (cur[t] ? { ...cur, [t]: 0 } : cur));
    };
    window.addEventListener(CHAT_SEEN_EVENT, onSeen);
    window.addEventListener(CHAT_CLEARED_EVENT, onSeen);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener(CHAT_SEEN_EVENT, onSeen);
      window.removeEventListener(CHAT_CLEARED_EVENT, onSeen);
    };
  }, [ws]);

  return counts;
}
