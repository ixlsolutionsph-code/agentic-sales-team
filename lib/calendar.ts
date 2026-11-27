// Calendar grid helpers. Weeks start on Monday.

export const DAY_START_HOUR = 8; // first hour row (8 AM)
export const DAY_END_HOUR = 18; // last hour row (6 PM)

// The 7 days (Monday first) of the week that holds `today`, at local midnight.
export function weekDays(today: Date): Date[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function hourRows(): number[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
}

export function hourLabel(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "Nov 23 – 29, 2026", or "Nov 30 – Dec 6, 2026" across months.
export function weekLabel(days: Date[]): string {
  const a = days[0];
  const b = days[days.length - 1];
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  const year = a.getFullYear() === b.getFullYear() ? `${b.getFullYear()}` : "";
  return year ? `${left} – ${right}, ${year}` : `${left}, ${a.getFullYear()} – ${right}, ${b.getFullYear()}`;
}

// ---- Milestone 10: months and meeting counts ----

export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// The weeks (Monday first) that cover the month of `anchor`; days of the
// month before and after are included to fill the weeks.
export function monthWeeks(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = weekDays(first)[0];
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i));
    if (w > 0 && week[0].getMonth() !== anchor.getMonth()) break;
    weeks.push(week);
  }
  return weeks;
}

export const monthLabel = (anchor: Date) => `${MONTHS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;

// The anchor moved by one week or one month.
export function shiftAnchor(anchor: Date, view: "week" | "month", step: number): Date {
  return view === "week"
    ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * step)
    : new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
}

// The summary cards: Meetings, Upcoming, This week, Leads (02-sitemap.md).
export function meetingCounts(list: { whenAt: string; leadId: string }[], now: Date): { meetings: number; upcoming: number; thisWeek: number; leads: number } {
  const days = weekDays(now);
  const from = days[0].getTime();
  const to = new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate() + 1).getTime();
  let upcoming = 0;
  let thisWeek = 0;
  for (const m of list) {
    const t = new Date(m.whenAt).getTime();
    if (t >= now.getTime()) upcoming++;
    if (t >= from && t < to) thisWeek++;
  }
  return { meetings: list.length, upcoming, thisWeek, leads: new Set(list.map((m) => m.leadId)).size };
}

// The hour row a meeting goes in (clamped to the rows shown).
export const rowHour = (d: Date) => Math.min(DAY_END_HOUR, Math.max(DAY_START_HOUR, d.getHours()));
