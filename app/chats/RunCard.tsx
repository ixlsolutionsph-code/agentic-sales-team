"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { loadTasks } from "@/lib/jobs/actions";
import type { Task } from "@/lib/jobs/tasks";
import ScrapeProgress from "./ScrapeProgress";

// The live timeline of a job (⟦run:jobId⟧). A lead search shows its steps;
// other jobs show their task line, reloaded every 3.5 s until they end.
const POLL_MS = 3500;
const ENDED = new Set(["done", "failed", "dismissed"]);
const STATUS: Record<string, string> = {
  needs_approval: "Waiting for you",
  queued: "Starting…",
  running: "Working…",
  done: "Done",
  failed: "Failed",
  dismissed: "Stopped",
};

export default function RunCard({ jobId }: { jobId: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    async function tick() {
      const t = (await loadTasks([jobId]).catch(() => []))[0] ?? null;
      if (!alive) return;
      setTask(t);
      setLoaded(true);
      if (t && t.kind !== "scrape" && !ENDED.has(t.status)) timer = window.setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  if (!loaded) return <div className="scrape-card chat-run"><p className="sub-empty-text">Loading…</p></div>;
  if (!task) return null;
  if (task.kind === "scrape") return <ScrapeProgress jobId={jobId} />;
  return (
    <div className="scrape-card chat-run" aria-live="polite">
      <div className="scrape-step">
        <span className={css("task-dot", `is-${task.status}`)} aria-hidden="true" />
        <div className="task-main">
          <div className="cell-main">{task.label}</div>
          <div className="cell-sub">{task.status === "failed" && task.error ? task.error : task.status === "done" ? task.summary : STATUS[task.status] ?? task.status}</div>
        </div>
      </div>
    </div>
  );
}
