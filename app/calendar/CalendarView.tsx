"use client";

import { useEffect, useMemo, useState } from "react";
import { css } from "@/lib/css";
import {
  WEEKDAY_SHORT,
  hourLabel,
  hourRows,
  meetingCounts,
  monthLabel,
  monthWeeks,
  rowHour,
  sameDay,
  shiftAnchor,
  weekDays,
  weekLabel,
} from "@/lib/calendar";
import { loadMeetings } from "@/lib/meetings/actions";
import type { Meeting } from "@/lib/meetings/store";

// /calendar (02-sitemap.md): cards Meetings, Upcoming, This week, Leads ·
// Week / Month toggle, ‹ ›, period label · Week: hour rows × 7 days · Month:
// Monday first, up to 4 dots per day then "+N". Reads only booked meetings.
const DOTS = 4;

export default function CalendarView() {
  const [today, setToday] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [view, setView] = useState<"week" | "month">("week");
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setAnchor(now);
    loadMeetings().then(setMeetings).catch(() => setMeetings([]));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const d = new Date(m.whenAt);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return map;
  }, [meetings]);

  if (!today || !anchor) return <div className="cal-grid cal-loading" aria-hidden="true" />;
  const counts = meetingCounts(meetings, today);
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = weekDays(anchor);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <section className="cal" aria-label="Calendar">
      <div className="cal-cards">
        <Card label="Meetings" value={counts.meetings} />
        <Card label="Upcoming" value={counts.upcoming} />
        <Card label="This week" value={counts.thisWeek} />
        <Card label="Leads" value={counts.leads} />
      </div>

      <div className="cal-bar">
        <div className="seg-ctl" role="radiogroup" aria-label="View">
          {(["week", "month"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={css("seg-btn", view === v && "is-on")} onClick={() => setView(v)}>
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div className="cal-nav">
          <button type="button" className="icon-btn" aria-label={view === "week" ? "Previous week" : "Previous month"} onClick={() => setAnchor(shiftAnchor(anchor, view, -1))}>
            ‹
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setAnchor(today)}>
            Today
          </button>
          <button type="button" className="icon-btn" aria-label={view === "week" ? "Next week" : "Next month"} onClick={() => setAnchor(shiftAnchor(anchor, view, 1))}>
            ›
          </button>
        </div>
        <p className="cal-period" aria-live="polite">
          {view === "week" ? weekLabel(days) : monthLabel(anchor)}
        </p>
      </div>

      {view === "week" ? (
        <div className="cal-scroll">
          <div className="cal-grid" role="grid" aria-label="Week view">
            <div className="cal-corner" />
            {days.map((d, i) => (
              <div key={d.toISOString()} className={css("cal-day", sameDay(d, today) && "is-today")} role="columnheader">
                <span className="cal-dow">{WEEKDAY_SHORT[i]}</span>
                <span className="cal-date">{d.getDate()}</span>
              </div>
            ))}
            {hourRows().map((h) => (
              <div key={h} className="cal-row" role="row">
                <div className="cal-hour" role="rowheader">
                  {hourLabel(h)}
                </div>
                {days.map((d) => {
                  const here = (byDay.get(dayKey(d)) ?? []).filter((m) => rowHour(new Date(m.whenAt)) === h);
                  return (
                    <div key={d.toISOString()} className="cal-cell" role="gridcell">
                      {here.map((m) => (
                        <div key={m.id} className="cal-meet" title={`${m.title} with ${m.leadName} · ${m.whenLabel}`}>
                          <span className="cal-meet-time">{time(m.whenAt)}</span> {m.leadName}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cal-scroll">
          <div className="cal-month" role="grid" aria-label="Month view">
            {WEEKDAY_SHORT.map((w) => (
              <div key={w} className="cal-month-dow" role="columnheader">
                {w}
              </div>
            ))}
            {monthWeeks(anchor).flat().map((d) => {
              const list = byDay.get(dayKey(d)) ?? [];
              return (
                <div
                  key={d.toISOString()}
                  role="gridcell"
                  className={css("cal-month-cell", d.getMonth() !== anchor.getMonth() && "is-other", sameDay(d, today) && "is-today")}
                  aria-label={`${d.toDateString()}: ${list.length} ${list.length === 1 ? "meeting" : "meetings"}`}
                >
                  <span className="cal-month-date">{d.getDate()}</span>
                  {list.length ? (
                    <span className="cal-dots">
                      {list.slice(0, DOTS).map((m) => (
                        <span key={m.id} className="cal-dot" title={`${time(m.whenAt)} · ${m.leadName}`} />
                      ))}
                      {list.length > DOTS ? <span className="cal-more">+{list.length - DOTS}</span> : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="card cal-card">
      <span className="cal-card-label">{label}</span>
      <span className="cal-card-value">{value}</span>
    </div>
  );
}
