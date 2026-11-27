// Meeting times in plain words ("tomorrow 2pm", "next Tue 10am") in the
// owner's time zone (01-prd.md §7.6 meetingTime, F12). The AI reads the words
// with the next 14 days and their UTC offsets in front of it; without AI (or
// on an error) a simple reader is used, where a bare 1–7 means PM.
// Pure apart from the injected AI function.
import type { AIJson } from "./engine";
import { UNTRUSTED_RULE, cleanField, fence } from "./untrusted";

export type MeetingTime = { iso: string; hasTime: boolean; date: string }; // date = yyyy-mm-dd in the zone
export type BookingRules = { type: string; duration: number; windowStart: number; windowEnd: number; weekdaysOnly: boolean };

export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz.trim()) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return tz.trim();
  } catch {
    return "UTC";
  }
}

type Parts = { y: number; m: number; d: number; h: number; min: number; wd: number }; // wd: 0 = Sunday
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function partsIn(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WD.indexOf(p.weekday) };
}

// Minutes the zone is ahead of UTC at that moment.
export function offsetMinutes(date: Date, tz: string): number {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

// The UTC moment of a wall-clock time in the zone.
export function zonedTime(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const first = new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
  return new Date(guess.getTime() - offsetMinutes(first, tz) * 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (p: { y: number; m: number; d: number }) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

// The calendar day `n` days after today in the zone.
function dayAfter(now: Date, tz: string, n: number): { y: number; m: number; d: number; wd: number } {
  const t = partsIn(now, tz);
  const base = new Date(Date.UTC(t.y, t.m - 1, t.d + n, 12));
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate(), wd: base.getUTCDay() };
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// The day the words name, as days from today, or null.
function readDay(t: string, now: Date, tz: string): number | null {
  const isoDay = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDay) {
    for (let n = 0; n < 370; n++) {
      const x = dayAfter(now, tz, n);
      if (x.y === +isoDay[1] && x.m === +isoDay[2] && x.d === +isoDay[3]) return n;
    }
    return null;
  }
  if (/\btoday\b|\btonight\b/.test(t)) return 0;
  if (/\btomorrow\b|\btmrw\b/.test(t)) return 1;
  const wd = t.match(/\b(next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\b/);
  if (wd) {
    const want = DAY_NAMES.findIndex((n) => n.startsWith(wd[2].slice(0, 3)));
    const today = dayAfter(now, tz, 0).wd;
    let diff = (want - today + 7) % 7;
    if (diff === 0 || wd[1]) diff = diff === 0 ? 7 : diff; // "monday" on a Monday = next week
    return diff;
  }
  const md = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/) ?? t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (md) {
    const [mon, day] = /^\d/.test(md[1]) ? [md[2], +md[1]] : [md[1], +md[2]];
    const m = MONTH_NAMES.indexOf(mon.slice(0, 3)) + 1;
    for (let n = 0; n < 370; n++) {
      const x = dayAfter(now, tz, n);
      if (x.m === m && x.d === day) return n;
    }
  }
  return null;
}

// The time the words name, as [hour, minute], or null. A number counts as a
// time with am/pm, with a colon, or after "at" / "around" / "by" / "@".
// A bare 1–7 means PM.
function readClock(t: string): [number, number] | null {
  if (/\bnoon\b|\bmidday\b/.test(t)) return [12, 0];
  const re = /(\bat\s+|\baround\s+|\bby\s+|@\s*)?\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d/-])/g;
  for (const x of t.matchAll(re)) {
    const lead = Boolean(x[1]);
    const ap = x[4]?.[0];
    if (!lead && !ap && !x[3]) continue;
    let h = +x[2];
    const min = x[3] ? +x[3] : 0;
    if (h > 23 || min > 59) continue;
    if (ap === "p" && h < 12) h += 12;
    else if (ap === "a" && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12;
    return [h, min];
  }
  return null;
}

// The simple reader. null when no day and no time are named.
export function parseMeetingTimeRule(text: string, now: Date, tzIn: string): MeetingTime | null {
  const tz = safeTimeZone(tzIn);
  const t = ` ${cleanField(text, 300).toLowerCase()} `;
  const clock = readClock(t);
  let n = readDay(t, now, tz);
  if (n === null && !clock) return null;
  if (n === null) {
    // A time with no day: today if it is still ahead, else tomorrow.
    const p = partsIn(now, tz);
    n = clock && clock[0] * 60 + clock[1] > p.h * 60 + p.min ? 0 : 1;
  }
  const day = dayAfter(now, tz, n);
  const [h, min] = clock ?? [9, 0];
  return { iso: zonedTime(day.y, day.m, day.d, h, min, tz).toISOString(), hasTime: Boolean(clock), date: ymd(day) };
}

const SCHEMA = {
  type: "object",
  properties: { date: { type: "string" }, time: { type: "string" } },
  required: ["date", "time"],
};

// The next 14 days with their weekday and UTC offset, for the prompt.
export function dayList(now: Date, tz: string): string {
  const lines: string[] = [];
  for (let n = 0; n < 14; n++) {
    const d = dayAfter(now, tz, n);
    const off = offsetMinutes(zonedTime(d.y, d.m, d.d, 12, 0, tz), tz);
    const sign = off >= 0 ? "+" : "-";
    lines.push(`${ymd(d)} ${DAY_NAMES[d.wd]}${n === 0 ? " (today)" : n === 1 ? " (tomorrow)" : ""} UTC${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`);
  }
  return lines.join("\n");
}

// Reads a meeting time. The AI is asked first (temperature 0, 120 tokens);
// the simple reader is used without AI, on an error or an unusable answer.
export async function parseMeetingTime(text: string, now: Date, tzIn: string, ai: AIJson | null): Promise<MeetingTime | null> {
  const tz = safeTimeZone(tzIn);
  const rule = parseMeetingTimeRule(text, now, tz);
  if (!ai) return rule;
  try {
    const p = partsIn(now, tz);
    const prompt = [
      `It is now ${ymd(p)} ${pad(p.h)}:${pad(p.min)} in the time zone ${tz}. The next 14 days:`,
      dayList(now, tz),
      "Read the meeting date and time from this message:",
      fence(cleanField(text, 300)),
      'date: yyyy-mm-dd, or "" if no day is named. time: HH:MM in 24 hours, or "" if no time is named. A bare 1 to 7 with no am or pm means PM.',
    ].join("\n\n");
    const r = await ai<Record<string, unknown>>(`You read dates and times. ${UNTRUSTED_RULE}`, prompt, SCHEMA, { temperature: 0, maxTokens: 120 });
    const date = typeof r?.date === "string" ? r.date.trim() : "";
    const time = typeof r?.time === "string" ? r.time.trim() : "";
    const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!dm && !tm) return rule;
    const day = dm ? { y: +dm[1], m: +dm[2], d: +dm[3] } : rule ? { y: +rule.date.slice(0, 4), m: +rule.date.slice(5, 7), d: +rule.date.slice(8, 10) } : dayAfter(now, tz, 0);
    const h = tm ? +tm[1] : 9;
    const min = tm ? +tm[2] : 0;
    if (h > 23 || min > 59) return rule;
    return { iso: zonedTime(day.y, day.m, day.d, h, min, tz).toISOString(), hasTime: Boolean(tm), date: ymd(day) };
  } catch {
    return rule;
  }
}

const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d).replace(/\s?([AP]M)$/, " $1");

// "Tue, Jul 15 · 2:00–2:30 PM" in the zone.
export function meetingLabel(iso: string, durationMin: number, tzIn: string): string {
  const tz = safeTimeZone(tzIn);
  const a = new Date(iso);
  const b = new Date(a.getTime() + durationMin * 60000);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(a);
  const s = fmtTime(a, tz);
  const e = fmtTime(b, tz);
  const sameHalf = s.slice(-2) === e.slice(-2);
  return `${day} · ${sameHalf ? s.slice(0, -3) : s}–${e}`;
}

// "Friday, Nov 27" for a yyyy-mm-dd day.
export function dayLabel(date: string, tzIn: string): string {
  const tz = safeTimeZone(tzIn);
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" }).format(zonedTime(y, m, d, 12, 0, tz));
}

// Why a time can't be booked, or null when it fits the agent's window
// (start at or after windowStart, end at or before windowEnd, a weekday when
// weekdays only, not in the past).
export function bookingProblem(iso: string, rules: BookingRules, tzIn: string, now: Date): string | null {
  const tz = safeTimeZone(tzIn);
  const a = new Date(iso);
  if (a.getTime() <= now.getTime()) return "That time has already passed. Pick a time in the future.";
  const p = partsIn(a, tz);
  if (rules.weekdaysOnly && (p.wd === 0 || p.wd === 6)) return "I only book meetings on weekdays. Pick a day from Monday to Friday.";
  const start = p.h * 60 + p.min;
  const end = start + rules.duration;
  if (start < rules.windowStart * 60 || end > rules.windowEnd * 60) {
    return `That is outside my booking hours (${hourWord(rules.windowStart)} to ${hourWord(rules.windowEnd)}). Pick a time inside them.`;
  }
  return null;
}

export const inBookingWindow = (iso: string, rules: BookingRules, tz: string, now: Date) => bookingProblem(iso, rules, tz, now) === null;

function hourWord(h: number): string {
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12} ${ap}`;
}

// Up to 6 hourly start times on a day inside the window (no 12), still ahead.
export function daySlots(date: string, rules: BookingRules, tzIn: string, now: Date): { label: string; iso: string }[] {
  const tz = safeTimeZone(tzIn);
  const [y, m, d] = date.split("-").map(Number);
  const out: { label: string; iso: string }[] = [];
  for (let h = rules.windowStart; h < rules.windowEnd && out.length < 6; h++) {
    if (h === 12) continue;
    const iso = zonedTime(y, m, d, h, 0, tz).toISOString();
    if (bookingProblem(iso, rules, tz, now)) continue;
    out.push({ label: hourWord(h), iso });
  }
  return out;
}

export const WHEN_CHOICES = ["Tomorrow 10 AM", "Tomorrow 2 PM", "Next Monday 10 AM"] as const;

// The "when?" quick replies: "Tomorrow 10 AM", "Tomorrow 2 PM", "Next Monday
// 10 AM" (01-prd.md §7.4). When tomorrow can't be booked (a weekend with
// weekdays only), the next bookable day is named instead ("Monday 10 AM").
export function whenChoices(rules: BookingRules, tzIn: string, now: Date): string[] {
  const tz = safeTimeZone(tzIn);
  let n = 1;
  for (; n < 8; n++) {
    const d = dayAfter(now, tz, n);
    if (!rules.weekdaysOnly || (d.wd !== 0 && d.wd !== 6)) break;
  }
  const name = n === 1 ? "Tomorrow" : DAY_NAMES[dayAfter(now, tz, n).wd].replace(/^./, (c) => c.toUpperCase());
  const out = [`${name} 10 AM`, `${name} 2 PM`];
  if (name !== "Monday") out.push("Next Monday 10 AM");
  else out.push("Tuesday 10 AM");
  return out;
}
