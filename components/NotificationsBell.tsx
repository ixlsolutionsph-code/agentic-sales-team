"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { dismissNotice, loadNotices } from "@/lib/activity/actions";
import type { Notice } from "@/lib/activity/store";
import { useApp } from "@/lib/store";
import { useDismiss } from "@/lib/useDismiss";
import AppIcon from "./AppIcon";

// The notifications bell (02-sitemap.md): the last 12 undismissed activity
// rows, reloaded every 30 s. The pink badge counts rows newer than the last
// time the panel was opened (kept in this browser). "Clear all", a × per
// row, and each row links to its agent. Empty: "No recent activity."
const POLL_MS = 30_000;
const seenKey = (ws: string) => `ast.bellSeen.${ws}`;

export default function NotificationsBell() {
  const { user } = useApp();
  const ws = user?.workspaceId ?? "";
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notice[]>([]);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const load = useCallback(() => {
    loadNotices()
      .then(setList)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ws) return;
    setSeen(Number(window.localStorage.getItem(seenKey(ws))) || 0);
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [ws, load]);

  const unseen = list.filter((n) => new Date(n.createdAt).getTime() > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && list.length && ws) {
      const newest = Math.max(...list.map((n) => new Date(n.createdAt).getTime()));
      window.localStorage.setItem(seenKey(ws), String(newest));
      setSeen(newest);
    }
  }

  async function dismiss(id: string | null) {
    setList((cur) => (id ? cur.filter((n) => n.id !== id) : []));
    await dismissNotice(id);
    load();
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn bell-btn"
        aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <AppIcon name="bell" size={20} />
        {unseen ? <span className="bell-badge">{unseen > 9 ? "9+" : unseen}</span> : null}
      </button>
      {open ? (
        <div className="menu menu-right bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <span className="menu-heading">Notifications</span>
            {list.length ? (
              <button type="button" className="link-btn" onClick={() => dismiss(null)}>
                Clear all
              </button>
            ) : null}
          </div>
          {list.length ? (
            <ul className="bell-list">
              {list.map((n) => (
                <li key={n.id} className="bell-row">
                  <Link href={`/agents/${n.agentId}`} className="bell-link" onClick={() => setOpen(false)}>
                    <span className="bell-text">{n.text}</span>
                    <time className="activity-time" dateTime={n.createdAt}>
                      {new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </time>
                  </Link>
                  <button type="button" className="bell-x" aria-label={`Dismiss: ${n.text}`} onClick={() => dismiss(n.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="menu-empty">No recent activity.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
