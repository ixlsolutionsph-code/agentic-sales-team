"use client";

import { useEffect, useRef, useState } from "react";
import { getScrapeProgress, type ScrapeProgress as Progress } from "@/lib/jobs/actions";
import { css } from "@/lib/css";

// The live timeline of one lead search (01-prd.md §7.3): plan, search, gate,
// extract, save. Reloads every 1.2 s and stops when the search ends or after
// 3 minutes. Used on the agent page now and in the team chat (Milestone 9).
const POLL_MS = 1200;
const STOP_AFTER_MS = 180_000;
const ENDED = new Set(["done", "failed", "dismissed"]);

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export default function ScrapeProgress({ jobId, onEnd }: { jobId: string; onEnd?: (p: Progress) => void }) {
  const [p, setP] = useState<Progress | null>(null);
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    ended.current = false;
    let alive = true;
    const started = Date.now();
    let timer: number | undefined;
    async function tick() {
      const next = await getScrapeProgress(jobId).catch(() => null);
      if (!alive) return;
      if (next) setP(next);
      if (next && ENDED.has(next.status)) {
        if (!ended.current) {
          ended.current = true;
          onEndRef.current?.(next);
        }
        return;
      }
      if (Date.now() - started < STOP_AFTER_MS) timer = window.setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  const steps = p?.steps ?? [];
  const waiting = !p || p.status === "queued";
  return (
    <div className="scrape-card" aria-live="polite">
      {waiting && !steps.length ? <p className="sub-empty-text">Starting the search…</p> : null}
      <ol className="scrape-steps">
        {steps.map((s) => (
          <li key={s.id} className="scrape-step">
            <span className={css("task-dot", s.status === "active" ? "is-running" : "is-done")} aria-hidden="true" />
            <div className="task-main">
              <div className="cell-main">{s.label}</div>
              {s.detail ? <div className="cell-sub">{s.detail}</div> : null}
              {s.items?.length ? (
                <ul className="task-items">
                  {s.items.map((it, i) => (
                    <li key={i} className={css("scrape-item", `is-${it.kind}`)}>
                      {it.url ? (
                        <a href={it.url} target="_blank" rel="noopener noreferrer nofollow">
                          {it.title} ↗
                        </a>
                      ) : (
                        it.title
                      )}
                      {it.meta ? <span className="cell-none"> · {it.meta}</span> : null}
                    </li>
                  ))}
                  {s.more ? <li className="cell-none">+{s.more} more</li> : null}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {p?.status === "done" ? (
        <p className="scrape-summary">
          {plural(p.sources, "source")} · {p.dropped} dropped · {plural(p.leadsFound, "lead")}
        </p>
      ) : null}
      {p?.status === "failed" ? <p className="scrape-summary is-error">{p.error}</p> : null}
    </div>
  );
}
