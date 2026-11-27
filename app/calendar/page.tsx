import { requireUser } from "@/lib/auth/guard";
import CalendarView from "./CalendarView";

// The calendar (02-sitemap.md): only booked meetings, by week or month.
export default async function CalendarPage() {
  await requireUser();
  return (
    <div className="page">
      <CalendarView />
    </div>
  );
}
