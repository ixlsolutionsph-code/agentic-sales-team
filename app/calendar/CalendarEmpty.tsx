"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { hourLabel, hourRows, sameDay, WEEKDAY_SHORT, weekDays, weekLabel } from "@/lib/calendar";

// The current week, Monday first, hour rows × 7 days, with no meetings.
// Built after the page loads so "today" is the viewer's own date.
export default function CalendarEmpty() {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  if (!today) return <div className="cal-grid cal-loading" aria-hidden="true" />;

  const days = weekDays(today);
  return (
    <section className="cal" aria-label="This week">
      <p className="cal-period">{weekLabel(days)}</p>
      <div className="cal-scroll">
        <div className="cal-grid" role="grid" aria-label="Week view, no meetings">
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
              {days.map((d) => (
                <div key={d.toISOString()} className="cal-cell" role="gridcell" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
