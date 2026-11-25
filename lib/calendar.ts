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
