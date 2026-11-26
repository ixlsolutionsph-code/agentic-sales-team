// Asks the sidebar to reload its Leads and Emails badges now (for example
// right after leads are accepted or dismissed).
export const NAV_COUNTS_EVENT = "app:nav-counts";

export function refreshNavCounts(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NAV_COUNTS_EVENT));
}
