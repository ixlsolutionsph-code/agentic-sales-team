"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { callAction } from "@/lib/auth/call-action";
import type { LiveJob } from "@/lib/agents/derive";
import { loadAgentWork, startRun, type AgentWork } from "@/lib/jobs/actions";
import type { JobKind } from "@/lib/jobs/limits";
import { LIVE_STATUSES, type Task } from "@/lib/jobs/tasks";
import { refreshNavCounts } from "@/lib/navCountsEvent";

const POLL_MS = 3000;
const KICK_EVERY_MS = 15_000;
const EMPTY: AgentWork = { tasks: [], drafts: [], proposals: [], stats: { leads: 0, sent: 0, drafts: 0, replied: 0, researched: 0 } };

// Asks the server to run queued jobs now (POST /api/jobs/run). The queue
// keeps the job if this call fails; a later call or the cron runs it.
export async function kickRunner(): Promise<void> {
  try {
    await fetch("/api/jobs/run", { method: "POST" });
  } catch {
    // The job stays queued.
  }
}

// The agent page's work: tasks, drafts, proposals and numbers. Reloads every
// 3 s while a run is waiting or working.
export function useAgentWork(agentId: string) {
  const [work, setWork] = useState<AgentWork>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const res = await callAction(() => loadAgentWork(agentId));
    if (!alive.current) return null;
    if (res.ok && res.data) {
      setWork(res.data);
      setLoaded(true);
      return res.data;
    }
    setLoaded(true);
    return null;
  }, [agentId]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const live = work.tasks.some((t) => LIVE_STATUSES.has(t.status));
  const waiting = work.tasks.some((t) => t.status === "queued") && !work.tasks.some((t) => t.status === "running");
  const lastKick = useRef(0);
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => {
      // While this page is open, a run that is still waiting gets another
      // nudge (at most every 15 s), so it doesn't depend on the cron alone.
      if (waiting && Date.now() - lastKick.current > KICK_EVERY_MS) {
        lastKick.current = Date.now();
        kickRunner().then(reload);
      } else reload();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [live, waiting, reload]);

  // Queues a run, asks the server to run it, and returns the finished task.
  const run = useCallback(
    async (kind: JobKind, leadIds?: string[]): Promise<{ ok: true; task: Task | null } | { ok: false; error: string }> => {
      const res = await callAction(() => startRun({ agentId, kind, leadIds }));
      if (!res.ok || !res.data) return { ok: false, error: res.ok ? "Something went wrong. Please try again." : res.error };
      const jobId = res.data.jobId;
      await reload();
      await kickRunner();
      const after = await reload();
      refreshNavCounts();
      return { ok: true, task: after?.tasks.find((t) => t.id === jobId) ?? null };
    },
    [agentId, reload],
  );

  const liveJobs: LiveJob[] = work.tasks
    .filter((t) => LIVE_STATUSES.has(t.status))
    .map((t) => ({ agentId, kind: t.kind, status: t.status, leadCount: t.leadCount }));

  return { work, loaded, reload, run, liveJobs };
}
