import { requireUser } from "@/lib/auth/guard";
import CalendarEmpty from "./CalendarEmpty";

// Milestone 10 adds meetings, the summary cards and the Week / Month views.
// Until then: an empty week grid (02-sitemap.md: "No meetings: an empty grid").
export default async function CalendarPage() {
  await requireUser();
  return (
    <div className="page">
      <CalendarEmpty />
    </div>
  );
}
