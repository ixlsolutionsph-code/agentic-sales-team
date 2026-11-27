"use client";

import { useState } from "react";
import ScrapeProgress from "@/app/chats/ScrapeProgress";
import { Btn } from "@/components/primitives";
import { callAction } from "@/lib/auth/call-action";
import { startSearch, type ScrapeProgress as Progress } from "@/lib/jobs/actions";
import { LIVE_STATUSES, type Task } from "@/lib/jobs/tasks";
import { refreshNavCounts } from "@/lib/navCountsEvent";
import { useApp } from "@/lib/store";

// Find leads on the agent page (02-sitemap.md): asks what to look for, runs
// the search at once with a target of 10 (no Proceed), shows each step live,
// then says how many leads wait in Pending.
export default function FindLeads({
  agentId,
  agentName,
  tasks,
  disabled,
  onChanged,
}: {
  agentId: string;
  agentName: string;
  tasks: Task[];
  disabled?: boolean;
  onChanged: () => void;
}) {
  const { showToast } = useApp();
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  // A search still running from before (for example after a page reload).
  const live = tasks.find((t) => t.kind === "scrape" && LIVE_STATUSES.has(t.status));
  const shown = jobId ?? live?.id ?? null;
  const busy = starting || Boolean(live);
  const first = agentName.split(" ")[0] || agentName;

  async function onClick() {
    const text = window.prompt(`What leads should ${first} look for?`);
    if (text === null || !text.trim()) return;
    setStarting(true);
    const res = await callAction(() => startSearch({ agentId, instruction: text.trim() }));
    setStarting(false);
    if (!res.ok || !res.data) return showToast(res.ok ? "Something went wrong. Please try again." : res.error, true);
    const id = res.data.jobId;
    setJobId(id);
    onChanged();
    // Runs the search now. If this call is lost, the cron runs it within a minute.
    fetch("/api/scrape", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: id }) }).catch(() => {});
  }

  function onEnd(p: Progress) {
    onChanged();
    refreshNavCounts();
    if (p.status === "done") showToast(`Found ${p.leadsFound} ${p.leadsFound === 1 ? "lead" : "leads"} to review. Open the Pending tab in the Leads module.`);
    else if (p.status === "failed") showToast(p.error || "That search didn't complete. Please try again.", true);
  }

  return (
    <div className="scrape-wrap">
      <div className="run-row">
        <div>
          <h4 className="sub-title">Find leads</h4>
          <p className="sub-empty-text">
            Searches LinkedIn, Facebook and Reddit for up to 10 new leads. They wait in Leads → Pending for your review.
          </p>
        </div>
        <Btn size="sm" variant="primary" onClick={onClick} disabled={busy || disabled}>
          {busy ? "Finding…" : "Find leads"}
        </Btn>
      </div>
      {shown ? <ScrapeProgress key={shown} jobId={shown} onEnd={onEnd} /> : null}
    </div>
  );
}
